import { useEffect, useReducer, useCallback } from 'react';
import {
  getSharingState,
  subscribeToSharingState,
  startSharing          as _startSharing,
  stopSharing           as _stopSharing,
  setBackgroundSharingEnabled as _setBgSharing,
  tryAutoResume         as _tryAutoResume,
  setSortBy             as _setSortBy,
  setPremiumRadius      as _setPremiumRadius,
  setFilters            as _setFilters,
  clearRequiresPremiumPaywall as _clearRequiresPremiumPaywall,
} from '../utils/sharing';
import type { SharingState, NearbyShareUser, SharingFilters } from '../utils/sharing';
import type { AuthUser } from '../auth/authService';

export type { SharingState, NearbyShareUser, SharingFilters } from '../utils/sharing';

/**
 * React hook that subscribes to the module-level sharing state.
 * Any component using this hook re-renders whenever sharing state changes.
 */
export function useSharing() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsub = subscribeToSharingState(forceUpdate);
    return unsub;
  }, []);

  const startSharing = useCallback(
    (user: AuthUser, token: string) => _startSharing(user, token),
    []
  );
  const stopSharing               = useCallback(() => _stopSharing(), []);
  const setBackgroundSharingEnabled = useCallback((on: boolean) => _setBgSharing(on), []);
  const tryAutoResume             = useCallback(
    (user: AuthUser, token: string) => _tryAutoResume(user, token),
    []
  );
  const setSortBy                 = useCallback((sort: 'distance' | 'relevance') => _setSortBy(sort), []);
  const setPremiumRadius          = useCallback((isPremium: boolean) => _setPremiumRadius(isPremium), []);
  const setFilters                = useCallback((f: SharingFilters) => _setFilters(f), []);
  const clearRequiresPremiumPaywall = useCallback(() => _clearRequiresPremiumPaywall(), []);

  const st = getSharingState();
  return {
    ...st,
    startSharing,
    stopSharing,
    setBackgroundSharingEnabled,
    tryAutoResume,
    sortBy: st.sortBy,
    setSortBy,
    setPremiumRadius,
    setFilters,
    clearRequiresPremiumPaywall,
  };
}
