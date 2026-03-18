/**
 * bluetooth.ts — BLE scanning (Central role only) for AirLinks.
 *
 * ⚠️  iOS advertising (Peripheral role) via BleAdvertiserPlugin is NOT used here.
 *     Peer discovery on iOS now uses MultipeerConnectivity (see src/utils/multipeer.ts).
 *     BLE advertising code is kept as a stub so it compiles; it is a no-op on iOS.
 *     On Android, startAdvertising() can be wired to a future native plugin.
 *
 * SCANNING  : @capacitor-community/bluetooth-le (CBCentralManager via native iOS)
 * ADVERTISING : disabled on iOS — use MultipeerConnectivity instead.
 */

import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { BleAdvertiser } from './bleAdvertiser';

// ── Service UUID ────────────────────────────────────────────────────────────
// Must be identical on every device. AirLinks custom UUID.
export const PG_SERVICE_UUID = 'E7810A71-73AE-499D-8C15-FAA9AEF0C3F2';

// ── Types ───────────────────────────────────────────────────────────────────
export interface DiscoveredDevice {
  deviceId: string;
  name: string | undefined;
  rssi: number;
  serviceUUIDs: string[];
  discoveredAt: Date;
}

export interface BleState {
  initialized: boolean;
  permissionGranted: boolean | null;  // null = not yet checked
  poweredOn: boolean | null;          // null = not yet checked
  isAdvertising: boolean;
  isScanning: boolean;
  discoveredDevices: DiscoveredDevice[];
  lastDiscoveryAt: Date | null;
  logs: string[];
}

// ── Module-level state ──────────────────────────────────────────────────────
const MAX_LOG_LINES = 40;

let state: BleState = {
  initialized: false,
  permissionGranted: null,
  poweredOn: null,
  isAdvertising: false,
  isScanning: false,
  discoveredDevices: [],
  lastDiscoveryAt: null,
  logs: [],
};

const subscribers = new Set<() => void>();

function setState(patch: Partial<BleState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}

function log(msg: string) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line = `${ts} ${msg}`;
  console.log(`[BLE] ${line}`);
  setState({ logs: [...state.logs.slice(-(MAX_LOG_LINES - 1)), line] });
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getBleState(): BleState {
  return state;
}

export function subscribeToBleState(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Initialize BLE, request permissions, check power state.
 * Must be called before startScanning or startAdvertising.
 */
export async function initializeBle(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    log('WARN: not on native platform — BLE unavailable in browser');
    setState({ initialized: false, permissionGranted: false, poweredOn: false });
    return false;
  }

  log('initialize() called');
  try {
    await BleClient.initialize({ androidNeverForLocation: true });
    log('initialize() succeeded — Bluetooth permission granted, radio on');
    setState({ initialized: true, permissionGranted: true, poweredOn: true });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`initialize() FAILED: ${msg}`);

    // Distinguish permission denied from powered-off
    if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('unauthori')) {
      setState({ initialized: false, permissionGranted: false, poweredOn: null });
    } else {
      setState({ initialized: false, permissionGranted: true, poweredOn: false });
    }
    return false;
  }
}

/**
 * Start BLE scanning for nearby AirLinks devices.
 * Filters for PG_SERVICE_UUID so only AirLinks devices appear.
 * Temporarily pass an empty services array to see ALL nearby BLE devices
 * (useful when debugging why discovery isn't working).
 */
export async function startScanning(filterByServiceUUID = true): Promise<void> {
  if (!state.initialized) {
    log('startScanning: not initialized — calling initializeBle() first');
    const ok = await initializeBle();
    if (!ok) {
      log('startScanning: initialization failed, aborting scan');
      return;
    }
  }

  log(`startScanning called — filterByServiceUUID=${filterByServiceUUID}`);
  log(`scanning for service UUID: ${PG_SERVICE_UUID}`);

  try {
    const scanOptions = filterByServiceUUID
      ? { services: [PG_SERVICE_UUID], allowDuplicates: true }
      : { services: [], allowDuplicates: true };

    await BleClient.requestLEScan(scanOptions, (result: ScanResult) => {
      const device = result.device;
      const rssi = result.rssi ?? -999;
      const uuids = result.uuids ?? [];

      log(
        `SCAN RESULT → id=${device.deviceId} name=${device.name ?? '(unnamed)'} ` +
        `rssi=${rssi} services=[${uuids.join(', ')}]`
      );

      setState({
        lastDiscoveryAt: new Date(),
        discoveredDevices: upsertDevice(state.discoveredDevices, {
          deviceId: device.deviceId,
          name: device.name,
          rssi,
          serviceUUIDs: uuids,
          discoveredAt: new Date(),
        }),
      });
    });

    setState({ isScanning: true });
    log('scan started successfully');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`startScanning FAILED: ${msg}`);
    setState({ isScanning: false });
  }
}

/**
 * Stop BLE scanning.
 */
export async function stopScanning(): Promise<void> {
  log('stopScanning called');
  try {
    await BleClient.stopLEScan();
    log('scan stopped');
  } catch (err) {
    log(`stopScanning error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    setState({ isScanning: false });
  }
}

/**
 * BLE advertising is disabled on iOS — MultipeerConnectivity handles peer discovery.
 * This stub is kept so callers compile; it is always a no-op.
 * On Android, replace this stub with a real BLE advertising implementation.
 */
export async function startAdvertising(): Promise<void> {
  log('startAdvertising: iOS advertising disabled — using MultipeerConnectivity instead');
  setState({ isAdvertising: false });
}

/**
 * No-op stub matching startAdvertising().
 */
export async function stopAdvertising(): Promise<void> {
  log('stopAdvertising: no-op (advertising is disabled on iOS)');
  setState({ isAdvertising: false });
}

/**
 * BLE-only sharing: scan only (advertising is disabled on iOS).
 * Prefer mpStartSharing() in multipeer.ts for full peer discovery on iOS.
 */
export async function startSharing(): Promise<void> {
  log('=== startSharing (BLE scan only — advertising disabled on iOS) ===');
  await startScanning(true);
}

/**
 * Stop BLE scanning.
 */
export async function stopSharing(): Promise<void> {
  log('=== stopSharing ===');
  await stopScanning();
  setState({ discoveredDevices: [] });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function upsertDevice(existing: DiscoveredDevice[], incoming: DiscoveredDevice): DiscoveredDevice[] {
  const idx = existing.findIndex((d) => d.deviceId === incoming.deviceId);
  if (idx >= 0) {
    const updated = [...existing];
    updated[idx] = incoming;
    return updated;
  }
  return [...existing, incoming];
}
