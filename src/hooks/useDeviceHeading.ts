/**
 * useDeviceHeading — real device compass heading for directional arrow.
 * Uses @capgo/capacitor-compass on native; fallback on web.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import geomagnetism from 'geomagnetism';

const SMOOTHING_FACTOR = 0.45;
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
  const declinationRef = useRef<number>(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let watchId: string | null = null;

    (async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        const { latitude, longitude } = pos.coords;
        const model = geomagnetism.model();
        const info = model.point([latitude, longitude]) as { decl: number };
        declinationRef.current = info.decl ?? 0;

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
          (position) => {
            if (!position) return;
            try {
              const m = geomagnetism.model();
              const i = m.point([position.coords.latitude, position.coords.longitude]) as { decl: number };
              declinationRef.current = i.decl ?? 0;
            } catch {}
          }
        );
      } catch {}
    })();

    return () => {
      (async () => {
        if (watchId) {
          try {
            const { Geolocation } = await import('@capacitor/geolocation');
            await Geolocation.clearWatch({ id: watchId });
          } catch {}
        }
      })();
    };
  }, []);

  const updateHeading = useCallback((raw: number) => {
    const normalized = ((raw + declinationRef.current) % 360 + 360) % 360;
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
    let heartbeatId: ReturnType<typeof setInterval>;

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

    heartbeatId = setInterval(() => {
      if (!mounted) return;
      (async () => {
        try {
          const { CapgoCompass } = await import('@capgo/capacitor-compass');
          const { value } = await CapgoCompass.getCurrentHeading();
          if (mounted) updateHeading(value);
        } catch {}
      })();
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(heartbeatId);
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
