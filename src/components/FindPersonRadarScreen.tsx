/**
 * FindPersonRadarScreen — secondary Discover view for finding a selected person.
 * Shows radar with single target dot, directional arrow, and back to list.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { NearbyShareUser } from '../utils/sharing';
import { useDeviceHeading } from '../hooks/useDeviceHeading';
import { useSharing } from '../hooks/useSharing';
import { useWatchPosition } from '../hooks/useWatchPosition';
import { bearingDegrees, relativeArrowAngle, distanceMeters, interpolateToward } from '../utils/geo';

export interface FindPersonRadarScreenProps {
  target: NearbyShareUser;
  myLocation: { lat: number; lng: number };
  onBack: () => void;
  /** Called every 500ms to get fresh coordinates for the target user. Return null if unavailable. */
  onFetchTargetLocation?: () => Promise<{ lat: number; lng: number } | null>;
}

const FIXED_TARGET_RADIUS = 35;
const FACE_THRESHOLD_DEG = 18;
/** Simulated approach: move this fraction toward target every tick (demo only). */
const SIMULATE_FRACTION_PER_TICK = 0.025;
const SIMULATE_INTERVAL_MS = 500;

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function formatDistance(meters: number): string {
  if (meters < 100) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function safeLog(scope: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[FindPersonRadar:${scope}]`, msg, stack ? { stack } : '');
}

export function FindPersonRadarScreen({
  target,
  myLocation: myLocationProp,
  onBack,
  onFetchTargetLocation,
}: FindPersonRadarScreenProps) {
  const { heading, available: compassAvailable, error: compassError } = useDeviceHeading();
  const sharing = useSharing();
  const { location: watchLocation, error: watchError } = useWatchPosition();
  const [simulatedLocation, setSimulatedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveTargetLocation, setLiveTargetLocation] = useState<{ lat: number; lng: number } | null>(
    target?.latitude != null && target?.longitude != null ? { lat: target.latitude!, lng: target.longitude! } : null
  );
  const [localDistance, setLocalDistance] = useState<number | null>(null);
  const [localBearing, setLocalBearing] = useState<number>(0);
  const simBaseRef = useRef<{ lat: number; lng: number } | null>(null);

  // Declare hasCoords and targetLocation FIRST — used by shouldSimulate and useEffect
  const hasCoords = target?.latitude != null && target?.longitude != null;
  const targetLocation = hasCoords && target
    ? { lat: target.latitude!, lng: target.longitude! }
    : null;

  // Base location: real GPS when available
  const baseLocation = watchLocation ?? sharing.currentLocation ?? myLocationProp;

  // Simulated approach for demo users: when no real movement, simulate walking toward target
  const isMockTarget = typeof target?.userId === 'string' && target.userId.startsWith('mock-dev-');
  const shouldSimulate =
    import.meta.env.DEV && isMockTarget && !!targetLocation && !!baseLocation;

  const effectiveTargetLocation = liveTargetLocation ?? targetLocation;

  useEffect(() => {
    if (!shouldSimulate || !effectiveTargetLocation || !baseLocation) return;
    try {
      simBaseRef.current = baseLocation;
      setSimulatedLocation(baseLocation);
      const id = setInterval(() => {
        setSimulatedLocation((prev) => {
          try {
            const from = prev ?? simBaseRef.current ?? baseLocation;
            const next = interpolateToward(
              from.lat,
              from.lng,
              effectiveTargetLocation.lat,
              effectiveTargetLocation.lng,
              SIMULATE_FRACTION_PER_TICK
            );
            const dist = distanceMeters(next.lat, next.lng, effectiveTargetLocation.lat, effectiveTargetLocation.lng);
            if (dist < 3) return from;
            return next;
          } catch (e) {
            safeLog('mock interpolation', e);
            return prev ?? simBaseRef.current ?? baseLocation;
          }
        });
      }, SIMULATE_INTERVAL_MS);
      return () => clearInterval(id);
    } catch (e) {
      safeLog('simulation setup', e);
      return () => {};
    }
  }, [shouldSimulate, effectiveTargetLocation?.lat, effectiveTargetLocation?.lng, baseLocation?.lat, baseLocation?.lng]);

  useEffect(() => {
    if (!onFetchTargetLocation) return;
    const id = setInterval(async () => {
      try {
        const fresh = await onFetchTargetLocation();
        if (fresh) setLiveTargetLocation(fresh);
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [onFetchTargetLocation]);

  // Local recalculation at 100ms — no server round-trip, uses freshest available coords
  useEffect(() => {
    const id = setInterval(() => {
      const myLoc =
        watchLocation ??
        sharing.currentLocation ??
        myLocationProp;
      const tgtLoc = liveTargetLocation ?? targetLocation;
      if (!myLoc || !tgtLoc) return;
      const dist = distanceMeters(myLoc.lat, myLoc.lng, tgtLoc.lat, tgtLoc.lng);
      const bear = bearingDegrees(myLoc.lat, myLoc.lng, tgtLoc.lat, tgtLoc.lng);
      setLocalDistance(Math.round(dist));
      setLocalBearing(bear);
    }, 100);
    return () => clearInterval(id);
  }, [watchLocation, sharing.currentLocation, myLocationProp, liveTargetLocation, targetLocation]);

  // Prefer live watch; when simulating (no real movement), use simulated position for distance
  const myLocation =
    watchLocation ??
    (shouldSimulate && simulatedLocation ? simulatedLocation : null) ??
    sharing.currentLocation ??
    myLocationProp ??
    { lat: 0, lng: 0 };

  const liveDistanceMeters = localDistance ?? target?.distanceMeters ?? 0;

  // Guards: missing target or coords — after all hooks
  if (!target) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">No person selected.</p>
        <button type="button" onClick={onBack} className="text-primary font-medium">Back</button>
      </div>
    );
  }

  if (!hasCoords) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div
          className="shrink-0 flex items-center justify-between px-4 pb-3 border-b border-border"
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
        >
          <button
            type="button"
            onClick={onBack}
            className="p-2 -m-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-sm text-muted-foreground text-center">
            Location data unavailable for this person.
          </p>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Distance: {formatDistance(target.distanceMeters)}
          </p>
        </div>
      </div>
    );
  }

  const targetBearing = localBearing;

  const relativeAngle =
    heading != null ? relativeArrowAngle(heading, targetBearing) : 0;

  const isFacing = Math.abs(relativeAngle) < FACE_THRESHOLD_DEG;

  const angleRad = (relativeAngle * Math.PI) / 180;
  const dotLeft = 50 + FIXED_TARGET_RADIUS * Math.sin(angleRad);
  const dotTop = 50 - FIXED_TARGET_RADIUS * Math.cos(angleRad);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col transition-colors duration-300 ${
        isFacing ? 'bg-emerald-900/95' : 'bg-background'
      }`}
    >
      <div
        className={`shrink-0 flex items-center justify-between px-4 pb-3 border-b transition-colors ${
          isFacing ? 'border-emerald-600/50' : 'border-border'
        }`}
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={onBack}
          className={`p-2 -m-2 rounded-lg flex items-center gap-2 ${
            isFacing ? 'text-emerald-200 hover:text-white hover:bg-emerald-800/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </button>
        <h2 className={`text-lg font-semibold ${isFacing ? 'text-emerald-100' : 'text-foreground'}`}>
          Find This Person
        </h2>
        <div className="w-16" />
      </div>

      {isFacing && (
        <p className="text-center text-xl font-bold text-emerald-100 mt-4 px-4">
          Walk {formatDistance(liveDistanceMeters)} in this direction
        </p>
      )}

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-6">
        {!isFacing && (
          <>
            <p className="text-sm font-semibold text-foreground mb-1">
              {target.fullName?.trim() || ''}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              within 500 feet of you
            </p>
          </>
        )}

        <div
          className="relative w-full aspect-square mx-auto shrink-0"
          style={{ maxWidth: 'var(--radar-max)', width: '100%', aspectRatio: '1 / 1' }}
        >
          {/* Radar rings */}
          {[1, 2, 3].map((ring) => (
            <div
              key={ring}
              className="absolute rounded-full border border-primary/10"
              style={{
                width: `${ring * 33}%`,
                height: `${ring * 33}%`,
                left: `${50 - (ring * 33) / 2}%`,
                top: `${50 - (ring * 33) / 2}%`,
              }}
            />
          ))}

          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-primary/60"
                style={{ width: '100%', height: '100%', left: 0, top: 0 }}
                initial={{ scale: 0.3, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 1,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Center: You circle + small blue triangle at north top — fixed, never rotates */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center glow-ring border-2 border-primary/80">
                <span className="text-primary-foreground text-sm font-semibold">You</span>
              </div>
              {/* Small blue triangle pointing north, base flush with circle top — seamless */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  top: '-10px',
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderBottom: '10px solid hsl(var(--primary))',
                }}
              />
            </div>
          </div>

          {/* Target person dot */}
          {hasCoords && (
            <motion.div
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${dotLeft}%`, top: `${dotTop}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className="w-12 h-12 rounded-full bg-secondary border-2 border-primary flex items-center justify-center glow-ring overflow-hidden">
                {target.photoUrl ? (
                  <img
                    src={target.photoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-foreground text-xs font-semibold">
                    {getInitials(target.fullName || '')}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {!isFacing && (
          <p className="text-[10px] text-muted-foreground text-center mt-4 max-w-[260px]">
            {compassAvailable
              ? 'Turn until the person is directly above you, then walk straight'
              : compassError || 'Compass unavailable — turn your phone to orient'}
          </p>
        )}
      </div>
    </div>
  );
}
