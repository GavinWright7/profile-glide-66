/**
 * DirectionArrow — points toward the selected nearby user in real-world direction.
 * Uses device heading and geographic bearing to rotate the arrow.
 */

import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { bearingDegrees, relativeArrowAngle } from '../utils/geo';

export interface DirectionArrowProps {
  /** Current user's location. */
  myLocation: { lat: number; lng: number };
  /** Target user's location. */
  targetLocation: { lat: number; lng: number };
  /** Device heading in degrees (0–360). North = 0. */
  heading: number | null;
  /** Target user's name for accessibility. */
  targetName?: string;
  /** Whether compass is available. */
  compassAvailable: boolean;
  /** Error message if compass unavailable. */
  compassError?: string | null;
}

export function DirectionArrow({
  myLocation,
  targetLocation,
  heading,
  targetName = 'nearby person',
  compassAvailable,
  compassError,
}: DirectionArrowProps) {
  const targetBearing = bearingDegrees(
    myLocation.lat,
    myLocation.lng,
    targetLocation.lat,
    targetLocation.lng
  );

  const rotation =
    heading != null
      ? relativeArrowAngle(heading, targetBearing)
      : 0;

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      {!compassAvailable && (
        <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
          {compassError || 'No nearby users to point to yet'}
        </p>
      )}
      {compassAvailable && (
        <motion.div
          className="flex items-center justify-center"
          animate={{ rotate: rotation }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          aria-label={`Point toward ${targetName}`}
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center">
            <ArrowUp size={24} className="text-primary" strokeWidth={2.5} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
