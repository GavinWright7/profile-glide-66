/**
 * useDeviceHeading — real device compass heading for directional arrow.
 * Uses @capgo/capacitor-compass on native; fallback on web.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

const SMOOTHING_FACTOR = 0.15;
const SAMPLE_INTERVAL_MS = 100;

export interface DeviceHeadingState {
  /** Heading in degrees (0–360). North = 0, East = 90. null if unavailable. */
  heading: number | null;
  /** Whether compass data is available. */
  available: boolean;
  /** Error message if permission denied or sensor unavailable. */
  error: string | null;
}

function smoothHeading(current: number, target: number): number {
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return current + diff * SMOOTHING_FACTOR;
}

export function useDeviceHeading(): DeviceHeadingState {
  const [state, setState] = useState<DeviceHeadingState>({
    heading: null,
    available: false,
    error: null,
  });
  const smoothedRef = useRef<number | null>(null);
  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

  const updateHeading = useCallback((raw: number) => {
    const normalized = ((raw % 360) + 360) % 360;
    const prev = smoothedRef.current;
    const next =
      prev == null ? normalized : smoothHeading(prev, normalized);
    smoothedRef.current = next;
    setState((s) => ({ ...s, heading: next, available: true, error: null }));
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setState({ heading: null, available: false, error: 'Compass not available on web' });
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const { CapgoCompass } = await import('@capgo/capacitor-compass');
        const perm = await CapgoCompass.checkPermissions();
        const status = perm?.compass ?? perm;
        if (status === 'denied') {
          if (mounted) setState({ heading: null, available: false, error: 'Location permission denied' });
          return;
        }
        if (status === 'prompt' || status === 'prompt-with-rationale') {
          const after = await CapgoCompass.requestPermissions();
          if (after?.compass === 'denied' || after === 'denied') {
            if (mounted) setState({ heading: null, available: false, error: 'Location permission denied' });
            return;
          }
        }

        const handle = await CapgoCompass.addListener('headingChange', (e) => {
          if (mounted) updateHeading(e.value);
        });
        listenerRef.current = handle;
        await CapgoCompass.startListening();

        const { value } = await CapgoCompass.getCurrentHeading();
        if (mounted) updateHeading(value);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Compass unavailable';
        if (mounted) setState({ heading: null, available: false, error: msg });
      }
    })();

    return () => {
      mounted = false;
      (async () => {
        try {
          const { CapgoCompass } = await import('@capgo/capacitor-compass');
          await CapgoCompass.stopListening();
          await listenerRef.current?.remove();
        } catch {}
      })();
    };
  }, [updateHeading]);

  return state;
}
