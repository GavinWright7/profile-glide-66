/**
 * FindPersonRadarScreen — secondary Discover view for finding a selected person.
 * Shows radar with single target dot, directional arrow, and back to list.
 */

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { NearbyShareUser } from '../utils/sharing';
import { DirectionArrow } from './DirectionArrow';
import { useDeviceHeading } from '../hooks/useDeviceHeading';
import { bearingDegrees, relativeArrowAngle } from '../utils/geo';

export interface FindPersonRadarScreenProps {
  target: NearbyShareUser;
  myLocation: { lat: number; lng: number };
  onBack: () => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function formatDistance(meters: number): string {
  if (meters < 100) return `${Math.round(meters)} m away`;
  if (meters < 1000) return `${(meters / 100).toFixed(1)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

export function FindPersonRadarScreen({
  target,
  myLocation,
  onBack,
}: FindPersonRadarScreenProps) {
  const { heading, available: compassAvailable, error: compassError } = useDeviceHeading();

  const hasCoords = target.latitude != null && target.longitude != null;
  const targetLocation = hasCoords
    ? { lat: target.latitude!, lng: target.longitude! }
    : null;

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

  const targetBearing = targetLocation
    ? bearingDegrees(myLocation.lat, myLocation.lng, targetLocation.lat, targetLocation.lng)
    : 0;

  const relativeAngle =
    heading != null ? relativeArrowAngle(heading, targetBearing) : 0;

  const maxRadius = 38;
  const minRadius = 15;
  const normalizedDist = Math.min(target.distanceMeters / 152.4, 1);
  const radius = minRadius + normalizedDist * (maxRadius - minRadius);
  const angleRad = (relativeAngle * Math.PI) / 180;
  const dotLeft = 50 + radius * Math.sin(angleRad);
  const dotTop = 50 - radius * Math.cos(angleRad);

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
        <h2 className="text-lg font-semibold text-foreground">Find This Person</h2>
        <div className="w-16" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-6">
        <p className="text-sm font-semibold text-foreground mb-1">
          {target.fullName || 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          {formatDistance(target.distanceMeters)}
        </p>

        <div
          className="relative w-full aspect-square mx-auto shrink-0"
          style={{ maxWidth: 'var(--radar-max)', width: '100%' }}
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

          {/* Center (you) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center glow-ring">
              <span className="text-primary-foreground text-sm font-semibold">You</span>
            </div>
          </div>

          {/* Directional arrow at center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            {targetLocation && (
              <DirectionArrow
                myLocation={myLocation}
                targetLocation={targetLocation}
                heading={heading}
                targetName={target.fullName || 'person'}
                compassAvailable={compassAvailable}
                compassError={compassError}
              />
            )}
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

        <p className="text-[10px] text-muted-foreground text-center mt-4 max-w-[260px]">
          {compassAvailable
            ? 'Point your phone toward the arrow to face this person'
            : compassError || 'Compass unavailable — turn your phone to orient'}
        </p>
      </div>
    </div>
  );
}
