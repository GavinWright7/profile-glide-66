/**
 * Read-only profile preview for a nearby user (Discover).
 */
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { NearbyShareUser } from '@/utils/sharing';

export interface NearbyUserProfileModalProps {
  user: NearbyShareUser;
  onClose: () => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function NearbyUserProfileModal({ user, onClose }: NearbyUserProfileModalProps) {
  const bioText = (user.bio ?? '').trim();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 glass-card pt-6 px-6 pb-6 z-10 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.fullName}
              className="w-20 h-20 rounded-full object-cover border-2 border-primary/30 mb-4"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-secondary border-2 border-primary/30 flex items-center justify-center mb-4">
              <span className="text-foreground text-xl font-bold">{initials(user.fullName || '?')}</span>
            </div>
          )}

          <h2 className="text-xl font-bold text-foreground">{user.fullName || 'Unknown'}</h2>
          {user.headline ? (
            <p className="text-sm text-muted-foreground mt-1">{user.headline}</p>
          ) : null}

          <div className="w-full mt-4 text-left space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Bio</p>
              <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
                {bioText || 'No bio yet.'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
