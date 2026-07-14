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
import { Preferences }  from '@capacitor/preferences';
import { BackgroundGeolocation } from '../plugins/backgroundGeolocation';
import { APPLE_TESTER_USER_ID, AUTH_401_EVENT, hasNonDemoSessionReady } from '../auth/authService';
import type { AuthUser } from '../auth/authService';
import { apiPost, apiGet, apiPatch } from '../api/client';

// ── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_FG_MS   = 5_000;    // foreground: heartbeat every 5 s (debug interval)
const HEARTBEAT_BG_MS   = 300_000;  // background: location persist every 5 min
const POLL_FG_MS        = 5_000;    // foreground: nearby poll every 5 s
const LOCATION_REFRESH_MS = 60_000; // keep last_seen_at fresh while discoverable
const MAX_LOGS          = 50;

export const BG_LOCATION_KEY = 'pg_bg_location_granted';

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
let _locationRefreshTimer: ReturnType<typeof setInterval> | null = null;
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
let _bgWatcherId: string | null = null;

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

export type SharingToggleResult = {
  ok: boolean;
  error?: string;
  user?: AuthUser;
  token?: string;
};

function userFacingSharingError(status: number, body?: { error?: string }): string {
  if (status === 429) {
    return 'Please wait a moment before trying again.';
  }
  const msg = body?.error?.trim();
  if (
    msg &&
    !/backend|network|socket|broadcast|presence|session|redis|timeout|fetch/i.test(msg)
  ) {
    return msg;
  }
  if (status >= 500) return 'Something went wrong. Please try again.';
  return 'Unable to update discoverability. Please try again.';
}

/** iOS Simulator default + removed SF fallback — never send to the backend. */
const KNOWN_FAKE_GPS: ReadonlyArray<{ lat: number; lng: number }> = [
  { lat: 37.785834, lng: -122.406417 },
  { lat: 37.7749, lng: -122.4194 },
];

function isKnownFakeGpsCoord(lat: number, lng: number): boolean {
  return KNOWN_FAKE_GPS.some(
    (c) => Math.abs(c.lat - lat) < 0.0001 && Math.abs(c.lng - lng) < 0.0001
  );
}

function isValidGpsCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !isKnownFakeGpsCoord(lat, lng)
  );
}

export function isBackgroundLocationGranted(): boolean {
  try {
    return localStorage.getItem(BG_LOCATION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBackgroundLocationGranted(granted: boolean): void {
  try {
    localStorage.setItem(BG_LOCATION_KEY, granted ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export async function stopAlwaysOnTracking(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!_bgWatcherId) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id: _bgWatcherId });
    console.log('[BGLocation] watcher removed');
  } catch (err) {
    console.warn('[BGLocation] removeWatcher failed', err);
  } finally {
    _bgWatcherId = null;
  }
}

export async function startAlwaysOnTracking(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (_bgWatcherId) return;

  try {
    _bgWatcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'AirLinks is keeping you discoverable.',
        backgroundTitle: 'AirLinks Location Active',
        requestPermissions: false,
        stale: false,
        distanceFilter: 15,
      },
      async (location, error) => {
        if (error || !location) return;
        if (!isValidGpsCoord(location.latitude, location.longitude)) return;

        const isDisc = localStorage.getItem(SK_ON) === 'true';
        if (!isDisc) return;

        try {
          await apiPatch('/profile/location', {
            latitude: location.latitude,
            longitude: location.longitude,
          });
          console.log('[BGLocation] updated', location.latitude, location.longitude);
        } catch (err) {
          console.warn('[BGLocation] update failed', err);
        }
      }
    );
    console.log('[BGLocation] always-on watcher started');
  } catch (err) {
    _bgWatcherId = null;
    console.warn('[BGLocation] failed to start watcher', err);
  }
}

async function persistDiscoverablePreference(
  isDiscoverable: boolean,
  location?: { lat: number; lng: number } | null
): Promise<{ user: AuthUser; token: string } | null> {
  if (!hasNonDemoSessionReady()) return null;

  const payload: Record<string, unknown> = { isDiscoverable };
  if (isDiscoverable && location && isValidGpsCoord(location.lat, location.lng)) {
    payload.latitude = location.lat;
    payload.longitude = location.lng;
    console.log('[Sharing] PATCH /profile/discoverable with GPS', {
      lat: location.lat,
      lng: location.lng,
    });
  }

  const res = await apiPatch('/profile/discoverable', payload);
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    user?: AuthUser;
    token?: string;
  };
  if (!res.ok) {
    throw new Error(userFacingSharingError(res.status, body));
  }
  if (body.user && body.token) {
    setCachedDiscoverablePreference(isDiscoverable, body.user, body.token);
    return { user: body.user, token: body.token };
  }
  return null;
}

export function setCachedDiscoverablePreference(isDiscoverable: boolean, user?: AuthUser | null, token?: string | null) {
  _cachedDiscoverable = isDiscoverable;
  if (user) _resumeUser = user;
  if (token) _resumeToken = token;
}

async function persistDiscoverableLocationToDb(reason: string): Promise<void> {
  if (!_cachedDiscoverable || !hasNonDemoSessionReady()) return;
  const loc = await getPosition(true);
  if (!loc || !isValidGpsCoord(loc.lat, loc.lng)) {
    console.warn('[Sharing] skip PATCH /profile/location — invalid GPS', { reason, loc });
    return;
  }
  _location = loc;
  setState({ currentLocation: loc });
  console.log('[Sharing] PATCH /profile/location', {
    reason,
    lat: loc.lat,
    lng: loc.lng,
  });
  try {
    const res = await apiPatch('/profile/location', {
      latitude: loc.lat,
      longitude: loc.lng,
    });
    if (res.ok) {
      addLog(`${reason}: location persisted ✓`);
    } else {
      addLog(`${reason}: location persist ${res.status}`);
    }
  } catch (err) {
    addLog(`${reason}: location persist error ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function resumeDiscoverableIfNeeded(reason: string): Promise<void> {
  if (!_cachedDiscoverable) return;
  if (!hasNonDemoSessionReady()) return;
  const user = _resumeUser;
  const token = _resumeToken;
  if (!user || !token) return;

  void persistDiscoverableLocationToDb(reason);

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
  _locationRefreshTimer = setInterval(() => {
    if (state.isSharing && _cachedDiscoverable) {
      void persistDiscoverableLocationToDb('interval 60s');
    }
  }, LOCATION_REFRESH_MS);
  setState({ heartbeatIntervalMs: HEARTBEAT_FG_MS });
  addLog(`intervals: heartbeat=${HEARTBEAT_FG_MS / 1000}s  poll=${POLL_FG_MS / 1000}s  location=${LOCATION_REFRESH_MS / 1000}s`);
}

function clearForegroundIntervals() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_pollTimer)      { clearInterval(_pollTimer);      _pollTimer      = null; }
  if (_locationRefreshTimer) { clearInterval(_locationRefreshTimer); _locationRefreshTimer = null; }
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
        if (!isValidGpsCoord(loc.lat, loc.lng)) return;
        _location = loc;
        setState({ currentLocation: loc });

        const now = Date.now();
        if (now - _lastHeartbeatTime >= HEARTBEAT_BG_MS) {
          _lastHeartbeatTime = now;
          void doHeartbeat();
          void persistDiscoverableLocationToDb('background watch');
          void doNearbyPoll();
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
        if (!isValidGpsCoord(loc.lat, loc.lng)) return;
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
      maximumAge: 0,
    });
    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (!isValidGpsCoord(loc.lat, loc.lng)) {
      addLog(`getPosition rejected: invalid or fake GPS (${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)})`);
      return null;
    }
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
  if (!loc) {
    addLog('heartbeat: no GPS');
    return;
  }
  _location = loc;
  setState({ currentLocation: loc });
  try {
    const res = await apiPost('/sharing/heartbeat', {
      latitude: loc.lat,
      longitude: loc.lng,
    });
    if (res.ok) {
      _lastSentLocation = loc;
      _lastHeartbeatTime = Date.now();
      setState({ lastHeartbeatAt: new Date() });
    } else {
      addLog(`heartbeat: server ${res.status}`);
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
  const loc = await getPosition(false);
  if (!loc) {
    addLog('poll: no GPS');
    return;
  }
  _location = loc;
  setState({ currentLocation: loc });
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

async function persistSession(user: AuthUser, token: string) {
  try {
    localStorage.setItem(SK_ON,    'true');
    localStorage.setItem(SK_USER,  JSON.stringify(user));
    localStorage.setItem(SK_TOKEN, token);
    void Preferences.set({ key: 'pg_sharing_on', value: 'true' });
    void Preferences.set({ key: 'pg_sharing_token', value: token });
  } catch { /* ignore storage errors */ }
}

function clearSharingPersistence() {
  try {
    localStorage.removeItem(SK_ON);
    localStorage.removeItem(SK_USER);
    localStorage.removeItem(SK_TOKEN);
    void Preferences.set({ key: 'pg_sharing_on', value: 'false' });
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
 * Flip discoverable UI instantly on tap — before GPS/API work completes.
 */
export function showDiscoverableImmediately(user: AuthUser, token: string): void {
  if (user.id === APPLE_TESTER_USER_ID) {
    startDemoSharing();
    return;
  }
  _cachedDiscoverable = true;
  _resumeUser = user;
  _resumeToken = token;
  setState({ isSharing: true, error: null });
  void persistSession(user, token);
}

/**
 * Flip discoverable UI off instantly on tap — before backend stop completes.
 */
export function showNotDiscoverableImmediately(): void {
  forceHaltSharingLoops();
  _cachedDiscoverable = false;
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
): Promise<SharingToggleResult> {
  if (_isStarting) {
    addLog('startSharing: already starting');
    return { ok: true };
  }
  if (state.isSharing && _heartbeatTimer !== null) {
    addLog('startSharing: already sharing');
    return { ok: true };
  }

  if (user.id === APPLE_TESTER_USER_ID) {
    startDemoSharing();
    return { ok: true };
  }

  if (!hasNonDemoSessionReady()) {
    addLog('startSharing: no valid session');
    return { ok: false, error: 'Please sign in again.' };
  }

  _isStarting = true;
  _cachedDiscoverable = true;
  _resumeUser = user;
  _resumeToken = token;
  setState({ isSharing: true, error: null });
  void persistSession(user, token);
  initLifecycleListener();

  try {
    addLog('startSharing: checking location permission');
    let perm = await checkPermission();
    setState({ locationPermission: perm });

    if (perm !== 'granted') {
      const ok = await requestPermission();
      if (!ok) {
        _cachedDiscoverable = false;
        clearSharingPersistence();
        setState({ error: 'Location access is required to go discoverable.', isSharing: false });
        return { ok: false, error: 'Location access is required to go discoverable.' };
      }
    }

    const loc = await getPosition(false);
    if (!loc || !isValidGpsCoord(loc.lat, loc.lng)) {
      const msg = 'Could not determine your location. Please try again.';
      _cachedDiscoverable = false;
      clearSharingPersistence();
      clearForegroundIntervals();
      setState({ error: msg, isSharing: false });
      return { ok: false, error: msg };
    }

    _location = loc;
    setState({ currentLocation: loc });

    let res: Response;
    try {
      res = await apiPost('/sharing/start', { latitude: loc.lat, longitude: loc.lng });
    } catch (fetchErr) {
      addLog(`startSharing FAILED: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
      console.error('[Sharing] fetch error:', fetchErr);
      const msg = 'Unable to connect. Check your internet and try again.';
      _cachedDiscoverable = false;
      clearSharingPersistence();
      clearForegroundIntervals();
      setState({ error: msg, isSharing: false });
      return { ok: false, error: msg };
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
      const msg = userFacingSharingError(status, body);
      _cachedDiscoverable = false;
      clearSharingPersistence();
      clearForegroundIntervals();
      setState({ error: msg, isSharing: false });
      addLog(`startSharing FAILED: ${status}`);
      return { ok: false, error: msg };
    }

    const body = resBody as { user?: AuthUser; token?: string };
    let sessionUpdate: { user: AuthUser; token: string } | null = null;
    if (body.user && body.token) {
      sessionUpdate = { user: body.user, token: body.token };
      setCachedDiscoverablePreference(true, body.user, body.token);
    } else if (!options.skipPersist) {
      sessionUpdate = await persistDiscoverablePreference(true, loc);
    }

    _cachedDiscoverable = true;
    _lastHeartbeatTime = Date.now();
    setState({ lastHeartbeatAt: new Date(), error: null });

    startForegroundIntervals();
    void doNearbyPoll();
    void startAlwaysOnTracking();

    addLog('startSharing: active ✓');
    return {
      ok: true,
      user: sessionUpdate?.user,
      token: sessionUpdate?.token,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to go discoverable.';
    addLog(`startSharing FAILED: ${msg}`);
    console.error('[Sharing] startSharing error:', err);
    _cachedDiscoverable = false;
    clearSharingPersistence();
    clearForegroundIntervals();
    setState({ error: msg, isSharing: false });
    return { ok: false, error: msg };
  } finally {
    _isStarting = false;
  }
}

/**
 * Stop sharing: halts timers, notifies backend when a JWT is still valid.
 */
export async function stopSharing(): Promise<SharingToggleResult> {
  addLog('stopSharing called');
  const notifyBackend = hasNonDemoSessionReady();

  forceHaltSharingLoops();
  _cachedDiscoverable = false;
  if (Capacitor.isNativePlatform()) {
    void stopAlwaysOnTracking();
  }

  try {
    let sessionUpdate: { user: AuthUser; token: string } | null = null;

    if (notifyBackend) {
      const res = await apiPost('/sharing/stop', {});
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: AuthUser;
        token?: string;
      };
      if (!res.ok) {
        const msg = userFacingSharingError(res.status, body);
        throw new Error(msg);
      }
      if (body.user && body.token) {
        sessionUpdate = { user: body.user, token: body.token };
        setCachedDiscoverablePreference(false, body.user, body.token);
      } else {
        sessionUpdate = await persistDiscoverablePreference(false);
      }
    }

    setState({ error: null });

    addLog('stopSharing: done');
    return {
      ok: true,
      user: sessionUpdate?.user,
      token: sessionUpdate?.token,
    };
  } catch (err) {
    if (Capacitor.isNativePlatform()) {
      void stopAlwaysOnTracking();
    }
    const msg = err instanceof Error ? err.message : 'Unable to stop sharing.';
    setState({ error: msg, isSharing: false });
    addLog(`stopSharing FAILED: ${msg}`);
    return { ok: false, error: msg };
  }
}
