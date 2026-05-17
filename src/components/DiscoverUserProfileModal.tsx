import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { NearbyShareUser } from '@/utils/sharing';

function formatDistance(meters: number): string {
  if (meters < 1609) return `${Math.max(1, Math.round(meters * 3.28084))} ft away`;
  return `${(meters / 1609.344).toFixed(1)} mi away`;
}

export interface DiscoverUserProfileModalProps {
  user: NearbyShareUser;
  onClose: () => void;
}

export function DiscoverUserProfileModal({ user, onClose }: DiscoverUserProfileModalProps) {
  const company = user.headline?.split(' at ')[1]?.trim() ?? '';
  const titlePart = user.headline?.split(' at ')[0]?.trim() ?? '';

  const bio = (user.bio || '').trim();
  const career = (user.career || '').trim();
  const interests = user.interests?.filter(Boolean) ?? [];

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-xl m-0 sm:m-4"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="sticky top-0 flex justify-end p-2 bg-card/95 backdrop-blur border-b border-border">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-5 pb-6 pt-2 space-y-4">
          <div className="flex items-center gap-4">
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt=""
                className="w-20 h-20 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
                {(user.fullName || '?')[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-foreground truncate">{user.fullName || 'Unknown'}</h2>
              {(titlePart || company) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {titlePart}
                  {company ? ` · ${company}` : ''}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">{formatDistance(user.distanceMeters)}</p>
            </div>
          </div>

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Career</h3>
            <p className="text-sm text-foreground">
              {career || 'Career not added yet.'}
            </p>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Bio</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {bio || 'No bio yet.'}
            </p>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Interests</h3>
            {interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => (
                  <span
                    key={i}
                    className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {i}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground">No interests added yet.</p>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
