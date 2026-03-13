import { useEffect, useReducer, useCallback } from 'react';
import {
  getMpState,
  subscribeToMpState,
  mpStartSharing,
  mpStopSharing,
  MultipeerState,
  DiscoveredPeer,
} from '../utils/multipeer';
import type { AuthUser } from '../auth/authService';

export type { MultipeerState, DiscoveredPeer };

/**
 * React hook for MultipeerConnectivity-based peer discovery.
 * Subscribes to the module-level state in multipeer.ts so every
 * component using this hook stays in sync without prop drilling.
 */
export function useDiscovery() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsub = subscribeToMpState(forceUpdate);
    return unsub;
  }, []);

  const startSharing = useCallback((user: AuthUser) => mpStartSharing(user), []);
  const stopSharing  = useCallback(() => mpStopSharing(), []);

  return {
    ...getMpState(),
    startSharing,
    stopSharing,
  };
}
