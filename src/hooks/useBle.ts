import { useEffect, useReducer, useCallback } from 'react';
import {
  getBleState,
  subscribeToBleState,
  initializeBle,
  startSharing,
  stopSharing,
  startScanning,
  stopScanning,
  startAdvertising,
  stopAdvertising,
  BleState,
  DiscoveredDevice,
} from '../utils/bluetooth';

export type { BleState, DiscoveredDevice };

/**
 * React hook that binds to the module-level BLE state.
 * Any component using this hook re-renders whenever BLE state changes.
 */
export function useBle() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsub = subscribeToBleState(forceUpdate);
    return unsub;
  }, []);

  const initialize = useCallback(() => initializeBle(), []);
  const share = useCallback(() => startSharing(), []);
  const unshare = useCallback(() => stopSharing(), []);
  const scan = useCallback((filter?: boolean) => startScanning(filter), []);
  const stopScan = useCallback(() => stopScanning(), []);
  const advertise = useCallback(() => startAdvertising(), []);
  const stopAdvert = useCallback(() => stopAdvertising(), []);

  return {
    ...getBleState(),
    initialize,
    startSharing: share,
    stopSharing: unshare,
    startScanning: scan,
    stopScanning: stopScan,
    startAdvertising: advertise,
    stopAdvertising: stopAdvert,
  };
}
