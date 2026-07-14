import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NearbyUser } from '@/data/mockUsers';

type DiscoverPublicProfileModalProps = {
  user: NearbyUser;
  onClose: () => void;
  onConnect?: () => void;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const text = (value ?? '').trim();
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground">{text}</p>
    </div>
  );
}

export function DiscoverPublicProfileModal({
  user,
  onClose,
  onConnect,
}: DiscoverPublicProfileModalProps) {
  const jobTitle = user.currentJobTitle || user.jobTitle;
  const company = user.currentCompany || user.company;
  const school = user.school || user.almaMater;
  const interests = user.interests?.filter(Boolean) ?? [];
  const past = user.pastCompanies?.filter(Boolean) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md max-h-[85vh] rounded-2xl border border-border bg-card shadow-xl flex flex-col"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X size={22} />
        </button>
        <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-10 pb-4 space-y-4">
          <div className="flex flex-col items-center text-center">
            {user.profilePhotoUrl ? (
              <img
                src={user.profilePhotoUrl}
                alt=""
                className="w-24 h-24 rounded-full object-cover border-2 border-primary/30 mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4 text-2xl font-bold text-foreground">
                {getInitials(user.name)}
              </div>
            )}
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
            {(jobTitle || company) && (
              <p className="text-sm text-muted-foreground mt-1">
                {[jobTitle, company].filter(Boolean).join(' at ')}
              </p>
            )}
          </div>

          <div className="space-y-3 text-left">
            <DetailRow label="Career" value={user.career} />
            <DetailRow label="Industry" value={user.industry || interests[0]} />
            <DetailRow label="School" value={school} />
            {user.graduationYear ? (
              <DetailRow label="Graduation year" value={String(user.graduationYear)} />
            ) : null}
            {past.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Past companies
                </p>
                <ul className="text-sm text-foreground space-y-1">
                  {past.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {interests.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Interests
                </p>
                <p className="text-sm text-foreground">{interests.join(', ')}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bio</p>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
              {user.bio?.trim() ? user.bio : '—'}
            </div>
          </div>
        </div>
        {user.linkedinProfileUrl?.trim() && onConnect ? (
          <div className="shrink-0 px-6 pb-4 pt-2 border-t border-border">
            <Button
              type="button"
              className="w-full gap-2 bg-linkedin hover:bg-linkedin/90 text-linkedin-foreground"
              onClick={onConnect}
            >
              Connect on LinkedIn
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
