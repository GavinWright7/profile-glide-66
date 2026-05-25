/**
 * sharing.ts — location-based live presence discovery with background support.
 *
 * FOREGROUND: setInterval heartbeat (10 s) + poll (5 s)
 * BACKGROUND: Geolocation.watchPosition piggyback — callbacks fire because
 *             UIBackgroundModes: [location] is declared in Info.plist.
 *             Each callback checks if ≥15 s have passed and sends a heartbeat.
 *
 * Why this works in background:
 *   iOS suspends JS timers when the app is backgrounded, BUT if you have
 *   UIBackgroundModes: [location] declared, Core Location keeps calling the
 *   Capacitor watchPosition callback even while the app is backgrounded.
 *   We piggyback the heartbeat on those callbacks.
 *
 * Persistence:
 *   Sharing on/off + user + token saved in localStorage.
 *   Call tryAutoResume(user, token) after auth loads to restore session.
 *
 * Backend timeout: 45 s — far exceeds the worst-case network jitter.
 *   Foreground: heartbeat every 10 s  → 4.5× margin
 *   Background: heartbeat every 15 s  → 3× margin
 */

import { Geolocation }  from '@capacitor/geolocation';
import { App }          from '@capacitor/app';
import { Capacitor }    from '@capacitor/core';
import { APPLE_TESTER_USER_ID, AUTH_401_EVENT, hasNonDemoSessionReady } from '../auth/authService';
import type { AuthUser } from '../auth/authService';
import { apiPost, apiGet, apiPatch } from '../api/client';

// ── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_FG_MS   = 3_000;    // foreground: heartbeat every 3 s
const HEARTBEAT_BG_MS   = 15_000;   // background: heartbeat every 15 s (via watchPosition)
const POLL_FG_MS        = 5_000;    // foreground: nearby poll every 5 s
const MAX_LOGS          = 50;

// localStorage keys
const SK_ON    = 'pg_sharing_on';
const SK_BG    = 'pg_bg_sharing';
const SK_USER  = 'pg_sharing_user';
const SK_TOKEN = 'pg_sharing_token';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NearbyShareUser {
  userId:         string;
  fullName:       string;
  headline:       string;
  photoUrl:       string;
  linkedinUrl:    string;
  distanceMeters: number;
  bio?: string;
  interests?: string[];
  career?: string;
  relevanceScore?: number;
  /** Coordinates for directional arrow (from Redis GEO). */
  latitude?:      number;
  longitude?:     number;
}

export interface SharingFilters {
  industries?: string[];
  subcategories?: string[];
}

export interface SharingState {
  isSharing:               boolean;
  locationPermission:      'granted' | 'denied' | 'prompt' | 'unknown';
  currentLocation:         { lat: number; lng: number } | null;
  nearbyUsers:             NearbyShareUser[];
  lastHeartbeatAt:         Date | null;
  lastPollAt:              Date | null;
  error:                   string | null;
  logs:                    string[];
  sortBy:                  'distance' | 'relevance';
  radiusMeters:            number;
  filters:                 SharingFilters;
  requiresPremiumPaywall:  boolean;
  // Background / lifecycle
  appLifecycle:            'foreground' | 'background';
  backgroundSharingEnabled: boolean;
  heartbeatIntervalMs:     number;
}

// ── Module-level state ───────────────────────────────────────────────────────

function loadBgPref(): boolean {
  try { return localStorage.getItem(SK_BG) !== 'false'; } catch { return true; }
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lng);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lng);
  const dLat = lat2 - lat1;
  const dLng = lon2 - lon1;
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

/** Free: 500 ft; premium: 2000 ft */
const FREE_RADIUS = 152.4;
const PREMIUM_RADIUS = 609.6;

let state: SharingState = {
  isSharing:                false,
  locationPermission:       'unknown',
  currentLocation:          null,
  nearbyUsers:              [],
  lastHeartbeatAt:          null,
  lastPollAt:               null,
  error:                    null,
  logs:                     [],
  sortBy:                   'distance',
  radiusMeters:             FREE_RADIUS,
  filters:                  {},
  requiresPremiumPaywall:   false,
  appLifecycle:             'foreground',
  backgroundSharingEnabled: loadBgPref(),
  heartbeatIntervalMs:      HEARTBEAT_FG_MS,
};

const subscribers = new Set<() => void>();

function setState(patch: Partial<SharingState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}

function addLog(msg: string) {
  const ts   = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = `${ts} ${msg}`;
  console.log('[Sharing]', line);
  setState({ logs: [...state.logs.slice(-(MAX_LOGS - 1)), line] });
}

// ── Internal refs ────────────────────────────────────────────────────────────

let _location:            { lat: number; lng: number } | null = null;
let _heartbeatTimer:      ReturnType<typeof setInterval> | null = null;
let _pollTimer:           ReturnType<typeof setInterval> | null = null;
let _watchId:             string | null = null;        // watchPosition ID (background)
let _fgWatchId:          string | null = null;        // foreground GPS watch — keeps _location live
let _lastHeartbeatTime    = 0;                         // ms since epoch of last heartbeat
let _lastSentLocation:    { lat: number; lng: number } | null = null;
let _isStarting           = false;
let _lifecycleInitialized = false;
let _autoResumeAttempted  = false;
let _findPersonActive = false;
let _cachedDiscoverable = false;
let _resumeUser: AuthUser | null = null;
let _resumeToken: string | null = null;

// ── App lifecycle listener ───────────────────────────────────────────────────

function initLifecycleListener() {
  if (_lifecycleInitialized) return;
  _lifecycleInitialized = true;

  // Stop sharing when session expires (401) — tear down timers without calling API
  window.addEventListener(AUTH_401_EVENT, () => {
    if (state.isSharing) {
      addLog('auth expired — halting sharing');
      forceHaltSharingLoops();
    }
  });

  App.addListener('appStateChange', ({ isActive }) => {
    const lifecycle: SharingState['appLifecycle'] = isActive ? 'foreground' : 'background';
    setState({ appLifecycle: lifecycle });

    if (isActive) {
      void resumeDiscoverableIfNeeded('appStateChange');
    }

    if (!state.isSharing) return;

    if (isActive) {
      // ── Returning to foreground ───────────────────────────────────────────
      if (state.isSharing && !hasNonDemoSessionReady()) {
        addLog('lifecycle: foreground — session invalid, halting sharing');
        forceHaltSharingLoops();
        return;
      }
      addLog('lifecycle: foreground — resuming normal discovery');
      stopBackgroundWatch();
      startForegroundIntervals();
      void doHeartbeat();
      void doNearbyPoll();
    } else {
      // ── Entering background ───────────────────────────────────────────────
      clearForegroundIntervals();
      void sendKeepalive('lifecycle: background');
      if (state.backgroundSharingEnabled) {
        addLog('lifecycle: backgrounded — continuing via watchPosition (UIBackgroundModes: location)');
        void startBackgroundWatch();
      } else {
        addLog('lifecycle: backgrounded — background sharing disabled, pausing');
        // Paused; no heartbeats until foregrounded again.
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void resumeDiscoverableIfNeeded('visibilitychange');
    }
  });
}

// ── Discoverable persistence ─────────────────────────────────────────────────

async function persistDiscoverablePreference(isDiscoverable: boolean): Promise<void> {
  if (!hasNonDemoSessionReady()) return;
  try {
    const res = await apiPatch('/profile/discoverable', { isDiscoverable });
    if (!res.ok) {
      addLog(`discoverable: server ${res.status} saving preference`);
    }
  } catch (err) {
    addLog(`discoverable: save error ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function setCachedDiscoverablePreference(isDiscoverable: boolean, user?: AuthUser | null, token?: string | null) {
  _cachedDiscoverable = isDiscoverable;
  if (user) _resumeUser = user;
  if (token) _resumeToken = token;
}

async function resumeDiscoverableIfNeeded(reason: string): Promise<void> {
  if (!_cachedDiscoverable) return;
  if (!hasNonDemoSessionReady()) return;
  const user = _resumeUser;
  const token = _resumeToken;
  if (!user || !token) return;

  if (!state.isSharing) {
    addLog(`${reason}: re-starting discoverable broadcast`);
    _autoResumeAttempted = false;
    await tryAutoResume(user, token);
    return;
  }

  addLog(`${reason}: refreshing discoverable broadcast`);
  void doHeartbeat();
  void doNearbyPoll();
}

// ── Foreground intervals ─────────────────────────────────────────────────────

function startForegroundIntervals() {
  if (Capacitor.isNativePlatform()) void startForegroundWatch();
  clearForegroundIntervals();
  _heartbeatTimer = setInterval(() => { void doHeartbeat(); }, HEARTBEAT_FG_MS);
  _pollTimer      = setInterval(() => { void doNearbyPoll(); }, POLL_FG_MS);
  setState({ heartbeatIntervalMs: HEARTBEAT_FG_MS });
  addLog(`intervals: heartbeat=${HEARTBEAT_FG_MS / 1000}s  poll=${POLL_FG_MS / 1000}s`);
}

function clearForegroundIntervals() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_pollTimer)      { clearInterval(_pollTimer);      _pollTimer      = null; }
  stopForegroundWatch();
}

// ── Background watchPosition ─────────────────────────────────────────────────
// iOS fires the watchPosition callback in background when UIBackgroundModes: [location]
// is declared.  We throttle to HEARTBEAT_BG_MS so we don't spam the backend.

async function startBackgroundWatch() {
  if (_watchId !== null) return;
  if (!Capacitor.isNativePlatform()) return;

  setState({ heartbeatIntervalMs: HEARTBEAT_BG_MS });
  addLog(`background: starting watchPosition (heartbeat every ${HEARTBEAT_BG_MS / 1000}s)`);

  try {
    _watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos, err) => {
        if (err || !pos) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        _location = loc;
        setState({ currentLocation: loc });

        const now = Date.now();
        if (now - _lastHeartbeatTime >= HEARTBEAT_BG_MS) {
          _lastHeartbeatTime = now;
          void doHeartbeat();
          void doNearbyPoll();   // piggyback poll with every background heartbeat
        }
      }
    );
    addLog(`background: watchPosition active id=${_watchId}`);
  } catch (err) {
    addLog(`background watch error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function stopBackgroundWatch() {
  if (_watchId !== null) {
    Geolocation.clearWatch({ id: _watchId }).catch(() => {});
    addLog(`background: watchPosition stopped id=${_watchId}`);
    _watchId = null;
  }
}

async function startForegroundWatch() {
  if (_fgWatchId !== null) return;
  if (!Capacitor.isNativePlatform()) return;
  try {
    _fgWatchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      (pos, err) => {
        if (err || !pos) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        _location = loc;
        setState({ currentLocation: loc });
      }
    );
  } catch (err) {
    addLog(`fgWatch error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function stopForegroundWatch() {
  if (_fgWatchId !== null) {
    Geolocation.clearWatch({ id: _fgWatchId }).catch(() => {});
    _fgWatchId = null;
  }
}

// ── Location helpers ─────────────────────────────────────────────────────────

async function checkPermission(): Promise<SharingState['locationPermission']> {
  try {
    const perm = await Geolocation.checkPermissions();
    return perm.location as SharingState['locationPermission'];
  } catch { return 'unknown'; }
}

async function requestPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm   = await Geolocation.requestPermissions();
      const granted = perm.location === 'granted';
      setState({ locationPermission: granted ? 'granted' : 'denied' });
      return granted;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { setState({ locationPermission: 'granted' }); resolve(true); },
        () => { setState({ locationPermission: 'denied'  }); resolve(false); }
      );
    });
  } catch { return false; }
}

async function getPosition(highAccuracy = true): Promise<{ lat: number; lng: number } | null> {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: highAccuracy,
      timeout: highAccuracy ? 10000 : 3000,
    });
    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    _location = loc;
    setState({ currentLocation: loc });
    return loc;
  } catch (err) {
    addLog(`getPosition error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── API helpers ──────────────────────────────────────────────────────────────
// Uses centralized api/client — token read fresh from storage per request, no stale _token.

export function setSortBy(sort: 'distance' | 'relevance') {
  setState({ sortBy: sort });
}

export function setRadiusMeters(meters: number) {
  setState({ radiusMeters: Math.min(meters, PREMIUM_RADIUS) });
}

export function setPremiumRadius(isPremium: boolean) {
  setState({ radiusMeters: isPremium ? PREMIUM_RADIUS : FREE_RADIUS });
}

export function setFilters(filters: SharingFilters) {
  setState({ filters });
}

export function setRequiresPremiumPaywall(show: boolean) {
  setState({ requiresPremiumPaywall: show });
}

export function clearRequiresPremiumPaywall() {
  setState({ requiresPremiumPaywall: false });
}

export function setFindPersonActive(active: boolean) {
  _findPersonActive = active;
}

// ── Heartbeat + Poll ─────────────────────────────────────────────────────────

async function sendKeepalive(reason: string): Promise<void> {
  if (!state.isSharing || !hasNonDemoSessionReady()) return;
  try {
    const res = await apiPost('/sharing/heartbeat/keepalive', {});
    if (res.ok) {
      _lastHeartbeatTime = Date.now();
      setState({ lastHeartbeatAt: new Date() });
      addLog(`${reason}: keepalive ✓`);
    } else {
      addLog(`${reason}: keepalive server ${res.status}`);
    }
  } catch (err) {
    addLog(`${reason}: keepalive error ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function doHeartbeat() {
  if (!state.isSharing) return;
  if (!hasNonDemoSessionReady()) {
    addLog('heartbeat: no session — halting');
    forceHaltSharingLoops();
    return;
  }
  const loc = await getPosition(true);
  if (!loc) { addLog('heartbeat: no location — skipping'); return; }
  const isStationary = _lastSentLocation ? metersBetween(_lastSentLocation, loc) < 2 : false;
  try {
    if (isStationary) {
      const res = await apiPost('/sharing/heartbeat/keepalive', {});
      if (res.ok) {
        _lastHeartbeatTime = Date.now();
        setState({ lastHeartbeatAt: new Date() });
      } else {
        addLog(`heartbeat: server ${res.status}`);
      }
    } else {
      const res = await apiPost('/sharing/heartbeat', {
        latitude:  loc.lat,
        longitude: loc.lng,
      });
      if (res.ok) {
        _lastSentLocation = loc;
        _lastHeartbeatTime = Date.now();
        setState({ lastHeartbeatAt: new Date() });
      } else {
        addLog(`heartbeat: server ${res.status}`);
      }
    }
  } catch (err) {
    addLog(`heartbeat error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function doNearbyPoll() {
  if (_findPersonActive) return;
  if (!state.isSharing) return;
  if (!hasNonDemoSessionReady()) {
    forceHaltSharingLoops();
    return;
  }
  const loc = _location;
  if (!loc) return;
  const params: Record<string, string> = {
    latitude:  String(loc.lat),
    longitude: String(loc.lng),
    sort:      state.sortBy,
    radiusMeters: String(state.radiusMeters),
  };
  const ind = state.filters.industries;
  const subs = state.filters.subcategories;
  if (ind?.length) params.filterIndustries = ind.join(',');
  if (subs?.length) params.filterSubcategories = subs.join(',');
  try {
    const res = await apiGet('/sharing/nearby', params);
    if (res.ok) {
      const data = await res.json() as { users: NearbyShareUser[] };
      const prev  = state.nearbyUsers.length;
      const next  = data.users?.length ?? 0;
      setState({ nearbyUsers: data.users ?? [], lastPollAt: new Date(), requiresPremiumPaywall: false });
      if (next > prev) addLog(`nearby: ${next} user(s) found`);
      if (next < prev && next === 0) addLog(`nearby: all users left (stopped sharing / out of range / heartbeat expired)`);
      if (next < prev && next  > 0) addLog(`nearby: ${prev - next} user(s) left (${next} remaining)`);
    } else {
      const body = await res.json().catch(() => ({})) as { requiresPremium?: boolean };
      if (res.status === 403 && body.requiresPremium) {
        setState({ requiresPremiumPaywall: true });
      }
      addLog(`poll: server ${res.status}`);
    }
  } catch (err) {
    addLog(`poll error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

function persistSession(user: AuthUser, token: string) {
  try {
    localStorage.setItem(SK_ON,    'true');
    localStorage.setItem(SK_USER,  JSON.stringify(user));
    localStorage.setItem(SK_TOKEN, token);
  } catch { /* ignore storage errors */ }
}

function clearSharingPersistence() {
  try {
    localStorage.removeItem(SK_ON);
    localStorage.removeItem(SK_USER);
    localStorage.removeItem(SK_TOKEN);
  } catch { /* ignore */ }
}

/**
 * Tear down sharing timers, geolocation watches, and persisted sharing keys.
 * Does not call the backend (safe when token is already gone).
 */
export function forceHaltSharingLoops(): void {
  _isStarting = false;
  clearForegroundIntervals();
  stopBackgroundWatch();
  stopForegroundWatch();
  clearSharingPersistence();
  setState({
    isSharing: false,
    nearbyUsers: [],
    lastHeartbeatAt: null,
    heartbeatIntervalMs: HEARTBEAT_FG_MS,
  });
  _location = null;
  _lastSentLocation = null;
  _lastHeartbeatTime = 0;
  _autoResumeAttempted = false;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSharingState(): SharingState {
  return state;
}

export function subscribeToSharingState(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Toggle whether sharing continues when the app is backgrounded.
 * Default: ON. Persists across launches.
 */
export function setBackgroundSharingEnabled(enabled: boolean) {
  try { localStorage.setItem(SK_BG, String(enabled)); } catch { /* ignore */ }
  setState({ backgroundSharingEnabled: enabled });
  addLog(`background sharing: ${enabled ? 'enabled ✓' : 'disabled'}`);

  // If currently in background with bg disabled → stop watch immediately
  if (!enabled && _watchId !== null) {
    stopBackgroundWatch();
  }
  // If currently in background with bg just enabled → start watch
  if (enabled && state.isSharing && state.appLifecycle === 'background' && _watchId === null) {
    void startBackgroundWatch();
  }
}

/**
 * Call once after the user is authenticated.
 * If sharing was active when the app last ran, resumes automatically.
 * Skips for Apple Tester / demo users.
 */
export async function tryAutoResume(user: AuthUser, token: string): Promise<void> {
  if (user.id === APPLE_TESTER_USER_ID) return;
  if (!hasNonDemoSessionReady()) return;
  if (_autoResumeAttempted || state.isSharing) return;
  _autoResumeAttempted = true;
  _resumeUser = user;
  _resumeToken = token;
  _cachedDiscoverable = user.isDiscoverable === true || localStorage.getItem(SK_ON) === 'true';
  try {
    if (_cachedDiscoverable) {
      addLog('auto-resume: restoring discoverable session');
      await startSharing(user, token, { skipPersist: user.isDiscoverable === true });
    }
  } catch { /* ignore */ }
}

/**
 * Start demo sharing (Apple Tester): no backend, empty nearby (no placeholder users).
 */
function startDemoSharing(): void {
  if (state.isSharing) return;
  setState({
    isSharing: true,
    nearbyUsers: [],
    lastPollAt: new Date(),
    error: null,
  });
  addLog('startDemoSharing: demo mode active ✓');
}

/**
 * Start sharing: request location → register with backend → heartbeat + poll loops.
 * Background-capable once UIBackgroundModes: [location] is in Info.plist.
 * For Apple Tester users, uses demo mode (no backend).
 */
export async function startSharing(
  user: AuthUser,
  token: string,
  options: { skipPersist?: boolean } = {}
): Promise<void> {
  if (_isStarting) { addLog('startSharing: already starting'); return; }
  if (state.isSharing) { addLog('startSharing: already sharing'); return; }

  if (user.id === APPLE_TESTER_USER_ID) {
    startDemoSharing();
    return;
  }

  if (!hasNonDemoSessionReady()) {
    addLog('startSharing: no valid session');
    return;
  }

  _isStarting = true;
  setState({ error: null });
  initLifecycleListener();   // safe to call multiple times — no-op after first

  try {
    // ── 1. Location permission ────────────────────────────────────────────────
    addLog('startSharing: checking location permission');
    let perm = await checkPermission();
    setState({ locationPermission: perm });

    if (perm !== 'granted') {
      addLog('startSharing: requesting location permission');
      const ok = await requestPermission();
      if (!ok) {
        setState({ error: 'Location permission required.' });
        addLog('startSharing: permission denied — aborting');
        return;
      }
      perm = 'granted';
    }
    addLog('startSharing: location permission ✓');

    // Optimistic UI: show Discoverable immediately while we fetch location + register
    setState({ isSharing: true });

    // ── 2. Initial position (low accuracy = fast, uses cell/wifi) ─────────────
    addLog('startSharing: getting current location');
    const loc = await getPosition(false);
    if (!loc) {
      setState({ error: 'Could not get current location.', isSharing: false });
      return;
    }
    addLog(`startSharing: location ✓  ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);

    // ── 3. Register with backend (uses centralized api client, token from storage) ───
    const startBody = { latitude: loc.lat, longitude: loc.lng };

    addLog('startSharing: registering with backend');

    let res: Response;
    try {
      res = await apiPost('/sharing/start', startBody);
    } catch (fetchErr) {
      const err = fetchErr as Error & { cause?: unknown };
      const detail = [
        err.message,
        err.name && err.name !== 'Error' ? `(${err.name})` : '',
        err.cause ? `cause: ${String(err.cause)}` : '',
      ].filter(Boolean).join(' ');
      const msg = `Network error: ${detail || 'request failed'}. Check backend URL and connectivity.`;
      addLog(`startSharing FAILED: ${msg}`);
      console.error('[Sharing] fetch error:', fetchErr);
      setState({ error: msg, isSharing: false });
      return;
    }

    const status = res.status;
    let resBody: unknown;
    try {
      const text = await res.text();
      resBody = text ? (JSON.parse(text) as object) : {};
    } catch {
      resBody = {};
    }

    if (!res.ok) {
      const body = resBody as { error?: string };
      const msg = `Backend error ${status}: ${body?.error ?? 'unknown'}`;
      setState({ error: msg, isSharing: false });
      addLog(msg);
      return;
    }
    addLog('startSharing: registered ✓');

    // ── 4. Persist + start loops ──────────────────────────────────────────────
    persistSession(user, token);
    _resumeUser = user;
    _resumeToken = token;
    _cachedDiscoverable = true;
    if (!options.skipPersist) {
      void persistDiscoverablePreference(true);
    }
    _lastHeartbeatTime = Date.now();
    setState({ isSharing: true, lastHeartbeatAt: new Date() });

    startForegroundIntervals();
    void doNearbyPoll();   // populate radar immediately, don't wait 5 s

    addLog('startSharing: active ✓  (backgrounding will continue via watchPosition)');

  } catch (err) {
    const e = err as Error & { cause?: unknown };
    const msg = e.message || String(err);
    const detail = e.cause ? ` (${String(e.cause)})` : '';
    const full = `startSharing failed: ${msg}${detail}`;
    addLog(`startSharing FAILED: ${full}`);
    console.error('[Sharing] startSharing error:', err);
    setState({ error: full, isSharing: false });
    clearForegroundIntervals();
    clearSharingPersistence();
  } finally {
    _isStarting = false;
  }
}

/**
 * Stop sharing: halts timers, notifies backend when a JWT is still valid.
 */
export async function stopSharing(): Promise<void> {
  addLog('stopSharing called');
  const notifyBackend = hasNonDemoSessionReady();
  forceHaltSharingLoops();
  _cachedDiscoverable = false;

  if (notifyBackend) {
    void persistDiscoverablePreference(false);
    try {
      const res = await apiPost('/sharing/stop', {});
      if (!res.ok) addLog(`stopSharing: server ${res.status}`);
    } catch (err) {
      addLog(`stopSharing backend error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  addLog('stopSharing: done');
}
