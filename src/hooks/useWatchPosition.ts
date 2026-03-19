/**
 * useWatchPosition — live GPS updates for distance tracking.
 * Starts watchPosition when mounted; returns latest location as user moves.
 * Use on Find Person screen so distance updates in real time.
 */

import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

function logError(scope: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[useWatchPosition:${scope}]`, msg, stack ? { stack } : '');
}

export interface WatchPositionState {
  /** Current location, updated as user moves. null until first fix. */
  location: { lat: number; lng: number } | null;
  /** Error message if watch fails. */
  error: string | null;
}

export function useWatchPosition(): WatchPositionState {
  const [state, setState] = useState<WatchPositionState>({
    location: null,
    error: null,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Web: use watchPosition for continuous updates as user moves
      if (!navigator.geolocation?.watchPosition) {
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            setState({
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              error: null,
            });
          },
          (err) => {
            logError('web getCurrentPosition', err);
            setState((s) => ({ ...s, error: err?.message ?? 'Location unavailable' }));
          }
        );
        return;
      }
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setState({
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            error: null,
          });
        },
        (err) => {
          logError('web watchPosition', err);
          setState((s) => ({ ...s, error: err?.message ?? 'Location unavailable' }));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation?.clearWatch(watchId);
    }

    let watchId: string | null = null;
    let mounted = true;

    (async () => {
      try {
        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
          (pos, err) => {
            if (!mounted) return;
            if (err) {
              logError('native watchPosition callback', err);
              setState((s) => ({ ...s, error: err?.message ?? 'Location error' }));
              return;
            }
            setState({
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              error: null,
            });
          }
        );
      } catch (err) {
        if (mounted) {
          logError('native watchPosition start', err);
          setState({
            location: null,
            error: err instanceof Error ? err.message : 'Failed to start location watch',
          });
        }
      }
    })();

    return () => {
      mounted = false;
      if (watchId) {
        Geolocation.clearWatch({ id: watchId }).catch(() => {});
      }
    };
  }, []);

  return state;
}
