/**
 * PersonActionSheet — action options when user taps a nearby person.
 * Primary: Find This Person. Secondary: View Profile.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Compass, User } from 'lucide-react';
import { NearbyShareUser } from '../utils/sharing';

export interface PersonActionSheetProps {
  user: NearbyShareUser;
  onFindThisPerson: () => void;
  onViewProfile: () => void;
  onClose: () => void;
}

export function PersonActionSheet({
  user,
  onFindThisPerson,
  onViewProfile,
  onClose,
}: PersonActionSheetProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
        <motion.div
          className="relative w-full max-w-md bg-card border-t border-border rounded-t-2xl shadow-xl overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {user.fullName || 'Person'}
            </p>
          </div>
          <div className="flex flex-col gap-1 px-4">
            <button
              type="button"
              onClick={() => {
                onFindThisPerson();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:bg-primary/80 transition-colors touch-manipulation"
            >
              <Compass size={20} />
              Find {user.fullName?.split(' ')[0] || 'This Person'}
            </button>
            <button
              type="button"
              onClick={() => {
                onViewProfile();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 active:bg-muted/70 transition-colors touch-manipulation"
            >
              <User size={20} />
              View Profile
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
