/**
 * NearbyUserListCard — list row for a nearby person on the Discover screen.
 */

import { NearbyShareUser } from '../utils/sharing';

export interface NearbyUserListCardProps {
  user: NearbyShareUser;
  onTap: () => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const PROXIMITY_LABEL = 'within 500 feet of you';

function formatDistance(_meters: number): string {
  return PROXIMITY_LABEL;
}

export function NearbyUserListCard({ user, onTap }: NearbyUserListCardProps) {
  const name = user.fullName?.trim();
  if (!name) {
    console.warn('[Discover] list card missing name', { userId: user.userId });
    return null;
  }
  const headline = user.headline || '';
  const [jobTitle, company] = headline.split(' at ').map((s) => s?.trim() || '');
  const descriptor = company ? `${jobTitle || 'Professional'} at ${company}` : jobTitle || headline || '';
  const industry = user.interests?.[0] || '';

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full glass-card p-4 flex items-center gap-4 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors rounded-xl touch-manipulation"
    >
      <div className="w-12 h-12 rounded-full bg-secondary border-2 border-primary/40 flex items-center justify-center shrink-0 overflow-hidden">
        {user.photoUrl ? (
          <img
            src={user.photoUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-foreground text-sm font-semibold">
            {getInitials(user.fullName || '')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {name}
        </h3>
        {descriptor && (
          <p className="text-xs text-muted-foreground truncate">
            {descriptor}
          </p>
        )}
        {industry && (
          <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
            {industry}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="text-xs font-medium text-primary">
          {formatDistance(user.distanceMeters)}
        </span>
      </div>
    </button>
  );
}
