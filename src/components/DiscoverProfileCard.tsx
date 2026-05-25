import { Linkedin, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NearbyUser } from '@/data/mockUsers';

export const PROXIMITY_LABEL = 'within 500 feet of you';

export type DiscoverProfileCardProps = {
  user: NearbyUser;
  onViewProfile?: () => void;
  onSave?: () => void;
  onConnect?: () => void;
  /** When false, only the profile header is shown (no action buttons). */
  showActions?: boolean;
};

export function nearbyUserFromRecentlyViewed(entry: {
  id: string;
  name: string;
  title: string;
  company: string;
  headline?: string;
  profilePhotoUrl?: string;
  linkedinProfileUrl?: string;
  bio?: string;
}): NearbyUser {
  const headline =
    entry.headline?.trim() ||
    [entry.title, entry.company].filter(Boolean).join(' at ') ||
    entry.title ||
    '';
  return {
    id: entry.id,
    name: entry.name,
    headline,
    company: entry.company || headline.split(' at ')[1]?.trim() || '',
    jobTitle: entry.title || headline.split(' at ')[0]?.trim() || '',
    profilePhotoUrl: entry.profilePhotoUrl || '',
    linkedinProfileUrl: entry.linkedinProfileUrl || '',
    linkedinId: entry.id,
    distance: 0,
    angle: 0,
    bio: entry.bio || '',
  };
}

export function DiscoverProfileCard({
  user,
  onViewProfile,
  onSave,
  onConnect,
  showActions = true,
}: DiscoverProfileCardProps) {
  const hasLi = Boolean(user.linkedinProfileUrl?.trim());

  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 space-y-3">
      <div className="flex gap-3">
        {user.profilePhotoUrl ? (
          <img
            src={user.profilePhotoUrl}
            alt=""
            className="w-14 h-14 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
            <UserRound className="w-7 h-7 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground truncate">{user.name}</h2>
          {user.headline ? (
            <p className="text-sm text-muted-foreground truncate">{user.headline}</p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-1">{PROXIMITY_LABEL}</p>
        </div>
      </div>
      {showActions && (
        <div className="flex flex-col gap-2">
          {onViewProfile ? (
            <Button type="button" size="sm" className="w-full" onClick={onViewProfile}>
              View Profile
            </Button>
          ) : null}
          {(onSave || (hasLi && onConnect)) && (
            <div className={`grid gap-2 ${onSave && hasLi && onConnect ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {onSave ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full min-w-0"
                  onClick={onSave}
                >
                  Save
                </Button>
              ) : null}
              {hasLi && onConnect ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full min-w-0 gap-1 px-2"
                  onClick={onConnect}
                >
                  <Linkedin className="w-4 h-4 shrink-0" />
                  <span className="truncate">Connect</span>
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
