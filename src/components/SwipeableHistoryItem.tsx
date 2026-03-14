import { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, animate } from 'framer-motion';
import { X, Check } from 'lucide-react';
import type { ConnectionEntry } from '@/context/ConnectionsContext';
import { format } from 'date-fns';

interface SwipeableHistoryItemProps {
  conn: ConnectionEntry;
  onSwipeLeft: (id: string) => void;
  onSwipeRight: (id: string) => void;
  index: number;
}

const SWIPE_THRESHOLD = 96; // ~1 inch

export default function SwipeableHistoryItem({
  conn,
  onSwipeLeft,
  onSwipeRight,
  index,
}: SwipeableHistoryItemProps) {
  const x = useMotionValue(0);
  const [isRemoving, setIsRemoving] = useState(false);

  // Colors fill the space the card vacates, following finger direction
  const confirmWidth = useTransform(x, (v) => Math.max(0, v)); // green expands from left when swiping right
  const deleteWidth = useTransform(x, (v) => Math.max(0, -v)); // red expands from right when swiping left
  const confirmOpacity = useTransform(x, [96, 120], [0, 1]); // icon appears at 1 inch of green
  const deleteOpacity = useTransform(x, [-96, -120], [0, 1]); // icon appears at 1 inch of red

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -SWIPE_THRESHOLD || velocity < -300) {
      setIsRemoving(true);
      animate(x, -400, { type: 'spring', stiffness: 300, damping: 30 }).then(() => {
        onSwipeLeft(conn.id);
      });
    } else if (offset > SWIPE_THRESHOLD || velocity > 300) {
      setIsRemoving(true);
      animate(x, 400, { type: 'spring', stiffness: 300, damping: 30 }).then(() => {
        onSwipeRight(conn.id);
      });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  };

  return (
    <motion.div
      data-swipeable-card
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isRemoving ? 0 : 1, y: isRemoving ? -20 : 0 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* Colors fill where card was — green from left (swipe right), red from right (swipe left) */}
      <div className="absolute inset-0 flex pointer-events-none overflow-hidden rounded-xl">
        <motion.div
          style={{ width: confirmWidth, minWidth: 0 }}
          className="absolute inset-y-0 left-0 bg-emerald-500 flex items-center justify-center shrink-0"
        >
          <motion.span style={{ opacity: confirmOpacity }} className="shrink-0">
            <Check size={28} className="text-white" strokeWidth={3} />
          </motion.span>
        </motion.div>
        <motion.div
          style={{ width: deleteWidth, minWidth: 0 }}
          className="absolute inset-y-0 right-0 bg-red-500 flex items-center justify-center shrink-0"
        >
          <motion.span style={{ opacity: deleteOpacity }} className="shrink-0">
            <X size={28} className="text-white" strokeWidth={3} />
          </motion.span>
        </motion.div>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -200, right: 200 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative glass-card p-4 touch-pan-y"
      >
        <p className="text-sm font-medium text-foreground">{conn.user.name}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(conn.requestedAt, 'MMM d, yyyy')}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(conn.requestedAt, 'h:mm a')}
        </p>
        {conn.lat != null && conn.lng != null && (
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
            {conn.lat.toFixed(5)}, {conn.lng.toFixed(5)}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          Swipe left to delete · Swipe right to confirm accepted
        </p>
      </motion.div>
    </motion.div>
  );
}
