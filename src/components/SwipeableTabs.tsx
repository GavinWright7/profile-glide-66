import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { swipeDirectionRef } from '@/utils/tabNavigation';

const TAB_PATHS = ['/', '/radar', '/connections', '/history', '/settings', '/profile'];

const SWIPE_THRESHOLD = 50;

export default function SwipeableTabs({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const currentIndex = TAB_PATHS.indexOf(location.pathname);
  const canSwipe = currentIndex >= 0;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!canSwipe) return;
      // Don't capture if touch is on a swipeable card (History items)
      if ((e.target as HTMLElement).closest('[data-swipeable-card]')) return;
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      setIsSwiping(true);
    },
    [canSwipe]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStart.current.x);
    const dy = Math.abs(touch.clientY - touchStart.current.y);
    if (dy > dx * 0.5) {
      touchStart.current = null;
      setIsSwiping(false);
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || !canSwipe) {
        touchStart.current = null;
        setIsSwiping(false);
        return;
      }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      touchStart.current = null;
      setIsSwiping(false);

      if (dx < -SWIPE_THRESHOLD && currentIndex < TAB_PATHS.length - 1) {
        swipeDirectionRef.current = 1; // swiping left = next tab
        navigate(TAB_PATHS[currentIndex + 1]);
      } else if (dx > SWIPE_THRESHOLD && currentIndex > 0) {
        swipeDirectionRef.current = -1; // swiping right = prev tab
        navigate(TAB_PATHS[currentIndex - 1]);
      }
    },
    [canSwipe, currentIndex, navigate]
  );

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStart.current = null;
        setIsSwiping(false);
      }}
      style={{ touchAction: isSwiping ? 'none' : 'pan-y' }}
    >
      {children}
    </div>
  );
}
