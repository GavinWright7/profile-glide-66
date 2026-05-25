import { useCallback, useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiscoverProfileCard, PROXIMITY_LABEL } from '@/components/DiscoverProfileCard';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useConnections } from '@/context/ConnectionsContext';
import { useSharing } from '@/hooks/useSharing';
import { apiGet } from '@/api/client';
import { FREE_RADIUS_METERS } from '@/services/entitlementService';
import { addRecentlyViewed } from '@/utils/recentlyViewed';
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

function toNearbyUser(u: NearbyApiUser): NearbyUser | null {
  const name = u.fullName?.trim();
  if (!name) {
    console.warn('[Discover] skipping user with missing name', { userId: u.userId });
    return null;
  }
  const parts = u.headline?.split(' at ') ?? [];
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

function logRecentlyViewed(u: NearbyUser) {
  addRecentlyViewed({
    id: u.id,
    name: u.name,
    title: u.jobTitle || u.headline.split(' at ')[0]?.trim() || '',
    company: u.company || u.headline.split(' at ')[1]?.trim() || '',
    headline: u.headline,
    profilePhotoUrl: u.profilePhotoUrl,
    linkedinProfileUrl: u.linkedinProfileUrl,
    bio: u.bio,
  });
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
        .filter((u): u is NearbyUser => u !== null)
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

  const openLinkedIn = (u: NearbyUser) => {
    logRecentlyViewed(u);
    window.open(u.linkedinProfileUrl, '_blank');
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const showDiscoverSpinner = sharing.isSharing || isDemoUser;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div
        className="shrink-0 px-[var(--page-padding-x)] pb-2"
        style={{ paddingTop: 'calc(var(--page-padding-top) + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-start justify-between gap-3 max-w-md mx-auto w-full">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Discover</h1>
            <p className="text-sm text-muted-foreground mt-1">People {PROXIMITY_LABEL}</p>
          </div>
          {showDiscoverSpinner ? (
            <div className="discover-spinner shrink-0 mt-1" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-[var(--page-padding-x)] pb-24 max-w-md mx-auto w-full">
        <div className="space-y-3">
          {users.map((u) => (
            <DiscoverProfileCard
              key={u.id}
              user={u}
              onViewProfile={() => setModalUser(u)}
              onSave={() => {
                addSavedProfile(u);
                toast.success(`Saved ${u.name}`, { duration: 2500 });
              }}
              onConnect={() => openLinkedIn(u)}
            />
          ))}
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
                  onClick={() => openLinkedIn(modalUser)}
                >
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
