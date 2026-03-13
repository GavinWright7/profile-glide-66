/**
 * multipeer.ts — JavaScript bridge for the native MultipeerPlugin (iOS).
 *
 * On iOS: routes calls to MultipeerPlugin.swift via Capacitor.
 * On web/Android: stubs return no-ops so the build doesn't break.
 *
 * Module-level state pattern mirrors bluetooth.ts — any component that calls
 * subscribeToMpState(fn) will receive a re-render trigger whenever a peer
 * is discovered, lost, or discovery starts/stops.
 */

import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import type { AuthUser } from '../auth/authService';

// ── Plugin interface ─────────────────────────────────────────────────────────

export interface MultipeerPluginInterface {
  initialize(options: { displayName: string }): Promise<{ success: boolean; peerId: string }>;
  startSharing(options: { profile: PeerProfile }): Promise<{ success: boolean; advertising: boolean; browsing: boolean }>;
  stopSharing(): Promise<{ success: boolean }>;
  getDiscoveredPeers(): Promise<{ peers: DiscoveredPeer[] }>;
  addListener(event: 'initialized',       cb: (d: { peerId: string; status: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'peerDiscovered',    cb: (d: DiscoveredPeer) => void): Promise<PluginListenerHandle>;
  addListener(event: 'peerLost',          cb: (d: DiscoveredPeer) => void): Promise<PluginListenerHandle>;
  addListener(event: 'allPeersCleared',   cb: (d: Record<string, never>) => void): Promise<PluginListenerHandle>;
  addListener(event: 'advertisingStarted', cb: (d: { peerId: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'browsingStarted',    cb: (d: Record<string, never>) => void): Promise<PluginListenerHandle>;
  addListener(event: 'advertisingStopped', cb: (d: Record<string, never>) => void): Promise<PluginListenerHandle>;
  addListener(event: 'browsingStopped',    cb: (d: Record<string, never>) => void): Promise<PluginListenerHandle>;
  addListener(event: 'advertisingError',   cb: (d: { error: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'browsingError',      cb: (d: { error: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'debugLog',           cb: (d: { message: string; timestamp: number }) => void): Promise<PluginListenerHandle>;
}

export interface PeerProfile {
  userId:     string;
  name:       string;
  headline:   string;
  picture:    string;
  linkedinUrl: string;
}

export interface DiscoveredPeer {
  peerId:     string;
  userId:     string;
  name:       string;
  headline:   string;
  picture:    string;
  linkedinUrl: string;
}

// ── Capacitor registration ───────────────────────────────────────────────────

const webStub: MultipeerPluginInterface = {
  async initialize() {
    console.log('[Multipeer] web stub — not available in browser');
    return { success: false, peerId: 'web' };
  },
  async startSharing() {
    console.log('[Multipeer] web stub — startSharing no-op');
    return { success: false, advertising: false, browsing: false };
  },
  async stopSharing() { return { success: true }; },
  async getDiscoveredPeers() { return { peers: [] }; },
  async addListener(_event: string, _cb: unknown) { return { remove: async () => {} }; },
};

export const Multipeer = registerPlugin<MultipeerPluginInterface>('Multipeer', {
  web: webStub,
});

// ── Module-level state ───────────────────────────────────────────────────────

export interface MultipeerState {
  initialized:   boolean;
  isAdvertising: boolean;
  isBrowsing:    boolean;
  discoveredPeers: DiscoveredPeer[];
  lastPeerAt:    Date | null;
  logs:          string[];
  error:         string | null;
}

const MAX_LOGS = 40;

let state: MultipeerState = {
  initialized:     false,
  isAdvertising:   false,
  isBrowsing:      false,
  discoveredPeers: [],
  lastPeerAt:      null,
  logs:            [],
  error:           null,
};

const subscribers = new Set<() => void>();

function setState(patch: Partial<MultipeerState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}

function addLog(msg: string) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = `${ts} ${msg}`;
  console.log('[Multipeer]', line);
  setState({ logs: [...state.logs.slice(-(MAX_LOGS - 1)), line] });
}

// ── One-time event listener setup ───────────────────────────────────────────

let listenersReady = false;
let listenerHandles: PluginListenerHandle[] = [];

async function ensureListeners() {
  if (listenersReady) return;
  listenersReady = true;

  listenerHandles = await Promise.all([
    Multipeer.addListener('initialized', (d) => {
      addLog(`initialized: peerId='${d.peerId}'`);
      setState({ initialized: true });
    }),

    Multipeer.addListener('advertisingStarted', (d) => {
      addLog(`advertisingStarted: peerId='${d.peerId}'`);
      setState({ isAdvertising: true });
    }),

    Multipeer.addListener('browsingStarted', () => {
      addLog('browsingStarted');
      setState({ isBrowsing: true });
    }),

    Multipeer.addListener('advertisingStopped', () => {
      addLog('advertisingStopped');
      setState({ isAdvertising: false });
    }),

    Multipeer.addListener('browsingStopped', () => {
      addLog('browsingStopped');
      setState({ isBrowsing: false });
    }),

    Multipeer.addListener('peerDiscovered', (peer) => {
      addLog(`peerDiscovered: '${peer.name}' (${peer.peerId})`);
      const exists = state.discoveredPeers.findIndex((p) => p.peerId === peer.peerId);
      const updated =
        exists >= 0
          ? state.discoveredPeers.map((p) => (p.peerId === peer.peerId ? peer : p))
          : [...state.discoveredPeers, peer];
      setState({ discoveredPeers: updated, lastPeerAt: new Date() });
    }),

    Multipeer.addListener('peerLost', (peer) => {
      addLog(`peerLost: '${peer.name}' (${peer.peerId})`);
      setState({
        discoveredPeers: state.discoveredPeers.filter((p) => p.peerId !== peer.peerId),
      });
    }),

    Multipeer.addListener('allPeersCleared', () => {
      addLog('allPeersCleared');
      setState({ discoveredPeers: [], isAdvertising: false, isBrowsing: false });
    }),

    Multipeer.addListener('advertisingError', (d) => {
      addLog(`advertisingError: ${d.error}`);
      setState({ isAdvertising: false, error: d.error });
    }),

    Multipeer.addListener('browsingError', (d) => {
      addLog(`browsingError: ${d.error}`);
      setState({ isBrowsing: false, error: d.error });
    }),

    Multipeer.addListener('debugLog', (d) => {
      // Native logs are forwarded here so they appear in the debug panel
      const ts = new Date(d.timestamp).toLocaleTimeString('en-US', { hour12: false });
      const line = `${ts} [native] ${d.message}`;
      setState({ logs: [...state.logs.slice(-(MAX_LOGS - 1)), line] });
    }),
  ]);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getMpState(): MultipeerState {
  return state;
}

export function subscribeToMpState(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// Guard against concurrent startSharing calls (user tapping multiple times)
let _isStarting = false;

/**
 * Initialize the native plugin with the user's display name, then start
 * advertising + browsing with their full profile payload.
 * Safe to call from a button handler — re-entrant calls are dropped.
 */
export async function mpStartSharing(user: AuthUser): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    addLog('WARN: not on native platform — MultipeerConnectivity unavailable in browser');
    setState({ initialized: false });
    return;
  }

  if (_isStarting) {
    addLog('mpStartSharing: already starting — ignoring duplicate call');
    return;
  }

  if (state.isAdvertising || state.isBrowsing) {
    addLog('mpStartSharing: already sharing — ignoring duplicate call');
    return;
  }

  _isStarting = true;
  setState({ error: null });

  try {
    await ensureListeners();

    // ── Step 1: initialize (creates MCPeerID + MCSession) ──
    addLog(`mpStartSharing: initializing as '${user.name}'`);
    const initResult = await Multipeer.initialize({ displayName: user.name });
    addLog(`mpStartSharing: initialize response → success=${initResult.success} peerId='${initResult.peerId}'`);

    if (!initResult.success) {
      addLog('mpStartSharing: initialize returned success=false — aborting');
      setState({ error: 'initialize() returned false' });
      return;
    }

    // Update initialized state directly from call result (don't wait for event)
    setState({ initialized: true });

    // ── Step 2: startSharing (starts advertiser + browser) ──
    const profile: PeerProfile = {
      userId:      user.id,
      name:        user.name,
      headline:    user.headline ?? '',
      picture:     user.picture ?? '',
      linkedinUrl: user.linkedinUrl ?? '',
    };

    addLog(`mpStartSharing: calling startSharing with profile for '${profile.name}'`);
    const shareResult = await Multipeer.startSharing({ profile });
    addLog(
      `mpStartSharing: startSharing response → success=${shareResult.success} ` +
      `advertising=${shareResult.advertising} browsing=${shareResult.browsing}`
    );

    // Update advertising/browsing state directly (don't wait for events)
    if (shareResult.success) {
      setState({ isAdvertising: shareResult.advertising, isBrowsing: shareResult.browsing });
    } else {
      addLog('mpStartSharing: startSharing returned success=false');
      setState({ error: 'startSharing() returned false' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addLog(`mpStartSharing FAILED: ${msg}`);
    setState({ error: msg, initialized: false, isAdvertising: false, isBrowsing: false });
  } finally {
    _isStarting = false;
  }
}

/**
 * Stop advertising and browsing, clear all discovered peers.
 */
export async function mpStopSharing(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  _isStarting = false;
  addLog('mpStopSharing called');
  try {
    await Multipeer.stopSharing();
    setState({ initialized: false, isAdvertising: false, isBrowsing: false, discoveredPeers: [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addLog(`mpStopSharing error: ${msg}`);
  }
}
