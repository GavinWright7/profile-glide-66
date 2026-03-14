import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { swipeDirectionRef } from '@/utils/tabNavigation';

/**
 * Wraps tab page content with a slide-in animation when navigating via swipe.
 * Direction comes from swipeDirectionRef (set by SwipeableTabs). Bottom nav taps use 0 = no slide.
 */
export default function AnimatedTabPage({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const dir = swipeDirectionRef.current;
  if (dir !== 0) swipeDirectionRef.current = 0;

  const slideDistance = typeof window !== 'undefined' ? window.innerWidth : 0;

  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      <motion.div
        key={location.pathname}
        initial={{
          x: dir === 1 ? slideDistance : dir === -1 ? -slideDistance : 0,
          y: 0,
          opacity: 1,
        }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </div>
  );
}
