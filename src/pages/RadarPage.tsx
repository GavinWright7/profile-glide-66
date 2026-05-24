import { useCallback, useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Linkedin, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useConnections } from '@/context/ConnectionsContext';
import { useSharing } from '@/hooks/useSharing';
import { apiGet } from '@/api/client';
import { FREE_RADIUS_METERS } from '@/services/entitlementService';
import type { NearbyUser } from '@/data/mockUsers';
const POLL_MS = 10_000;

type NearbyApiUser = {
  userId: string;
  fullName: string;
  headline: string;
  photoUrl: string;
  linkedinUrl: string;
  distanceMeters: number;
  bio?: string;
};

function toNearbyUser(u: NearbyApiUser): NearbyUser {
  const parts = u.headline?.split(' at ') ?? [];
  const name =
    u.fullName?.trim() ||
    parts[0]?.trim() ||
    'Nearby professional';
  return {
    id: u.userId,
    name,
    headline: u.headline || '',
    company: parts[1]?.trim() ?? '',
    jobTitle: parts[0]?.trim() ?? '',
    profilePhotoUrl: u.photoUrl || '',
    linkedinProfileUrl: u.linkedinUrl || '',
    linkedinId: u.userId,
    distance: u.distanceMeters,
    angle: 0,
    bio: u.bio || '',
  };
}

const RadarPage = () => {
  const { token, isDemoUser } = useAuth();
  const sharing = useSharing();
  const { addSavedProfile } = useConnections();
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [modalUser, setModalUser] = useState<NearbyUser | null>(null);

  const fetchNearby = useCallback(async () => {
    if (isDemoUser || !token) {
      setUsers([]);
      return;
    }
    const loc = sharing.currentLocation;
    if (!loc) {
      setUsers([]);
      return;
    }
    try {
      const res = await apiGet('/sharing/nearby', {
        latitude: String(loc.lat),
        longitude: String(loc.lng),
        radiusMeters: String(FREE_RADIUS_METERS),
        sort: 'distance',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { users?: NearbyApiUser[] };
      const list = (data.users ?? [])
        .map(toNearbyUser)
        .filter((u) => u.distance <= FREE_RADIUS_METERS + 0.5);
      setUsers(list);
    } catch {
      /* ignore */
    }
  }, [isDemoUser, token, sharing.currentLocation]);

  useEffect(() => {
    void fetchNearby();
    const id = window.setInterval(() => void fetchNearby(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchNearby]);

  useEffect(() => {
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void fetchNearby();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [fetchNearby]);

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div
        className="shrink-0 px-[var(--page-padding-x)] pb-2"
        style={{ paddingTop: 'calc(var(--page-padding-top) + env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="text-2xl font-bold text-foreground">Discover</h1>
        <p className="text-sm text-muted-foreground mt-1">People within 500 feet of you</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-[var(--page-padding-x)] pb-24 max-w-md mx-auto w-full">
        {!sharing.isSharing && !isDemoUser && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Start sharing from Home to see who&apos;s nearby.
          </p>
        )}

        {(sharing.isSharing || isDemoUser) && users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No one nearby yet</p>
        )}

        <div className="space-y-3">
          {users.map((u) => {
            const feet = Math.round(u.distance * 3.28084);
            const hasLi = Boolean(u.linkedinProfileUrl?.trim());
            return (
              <div
                key={u.id}
                className="rounded-xl border border-border bg-card/80 p-4 space-y-3"
              >
                <div className="flex gap-3">
                  {u.profilePhotoUrl ? (
                    <img
                      src={u.profilePhotoUrl}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserRound className="w-7 h-7 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-foreground truncate">{u.name}</h2>
                    {u.headline ? (
                      <p className="text-sm text-muted-foreground truncate">{u.headline}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">{feet} ft away</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={() => setModalUser(u)}
                  >
                    View Profile
                  </Button>
                  <div className={`grid gap-2 ${hasLi ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full min-w-0"
                      onClick={() => {
                        addSavedProfile(u);
                        toast.success(`Saved ${u.name}`, { duration: 2500 });
                      }}
                    >
                      Save
                    </Button>
                    {hasLi ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full min-w-0 gap-1 px-2"
                        onClick={() => window.open(u.linkedinProfileUrl, '_blank')}
                      >
                        <Linkedin className="w-4 h-4 shrink-0" />
                        <span className="truncate">Connect</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setModalUser(null)}
          />
          <div
            className="relative w-full max-w-md max-h-[85vh] rounded-2xl border border-border bg-card shadow-xl flex flex-col"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              type="button"
              onClick={() => setModalUser(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-10 pb-4">
              <div className="flex flex-col items-center text-center">
                {modalUser.profilePhotoUrl ? (
                  <img
                    src={modalUser.profilePhotoUrl}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary/30 mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4 text-2xl font-bold text-foreground">
                    {getInitials(modalUser.name)}
                  </div>
                )}
                <h2 className="text-xl font-bold text-foreground">{modalUser.name}</h2>
                {modalUser.headline ? (
                  <p className="text-sm text-muted-foreground mt-1">{modalUser.headline}</p>
                ) : null}
              </div>
              <div className="mt-6 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Bio
                </p>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
                  {modalUser.bio?.trim() ? modalUser.bio : '—'}
                </div>
              </div>
            </div>
            {modalUser.linkedinProfileUrl?.trim() ? (
              <div className="shrink-0 px-6 pb-4 pt-2 border-t border-border">
                <Button
                  type="button"
                  className="w-full gap-2 bg-linkedin hover:bg-linkedin/90 text-linkedin-foreground"
                  onClick={() => window.open(modalUser.linkedinProfileUrl, '_blank')}
                >
                  <Linkedin size={18} />
                  Connect on LinkedIn
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default RadarPage;
