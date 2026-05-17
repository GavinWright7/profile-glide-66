import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Filter } from 'lucide-react';
import { NearbyUserListCard } from '@/components/NearbyUserListCard';
import { PersonActionSheet, COMING_SOON } from '@/components/PersonActionSheet';
import { DiscoverUserProfileModal } from '@/components/DiscoverUserProfileModal';
import { NearbyUser } from '@/data/mockUsers';
import { toast } from 'sonner';
import { useSharing } from '../hooks/useSharing';
import { NearbyShareUser } from '../utils/sharing';
import { getMockCenter } from '../utils/mockNearbyUsers';
import { useAuth } from '../context/AuthContext';
import { useEntitlement } from '../hooks/useEntitlement';
import { useConnections } from '../context/ConnectionsContext';
import { apiGet } from '../api/client';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { isValidLinkedInUrl } from '@/utils/linkedinUrl';

function shareUserToRadarUser(user: NearbyShareUser, index: number): NearbyUser {
  const parts = user.headline?.split(' at ') ?? [];
  const jobTitle = parts[0]?.trim() ?? '';
  const company = parts[1]?.trim() ?? '';
  const distance = Math.max(0.5, Math.min(10, user.distanceMeters / 15.24));
  return {
    id: user.userId,
    name: user.fullName || 'Unknown',
    headline: user.headline || '',
    company,
    jobTitle,
    profilePhotoUrl: user.photoUrl || '',
    linkedinProfileUrl: user.linkedinUrl || '',
    linkedinId: user.userId,
    distance,
    angle: (index * 73 + 20) % 360,
    bio: user.bio,
    career: user.career,
    interests: user.interests,
  };
}

async function openLinkedInProfile(url: string): Promise<void> {
  if (!url || !isValidLinkedInUrl(url)) return;

  if (Capacitor.isNativePlatform()) {
    const slug = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i)?.[1];
    const appDeepLink = slug ? `linkedin://in/${slug}` : null;
    if (appDeepLink) {
      try {
        const result = await (
          App as unknown as { openUrl: (o: { url: string }) => Promise<{ completed: boolean }> }
        ).openUrl({ url: appDeepLink });
        if (result.completed) return;
      } catch {
        /* fall through */
      }
    }
  }

  try {
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank');
  }
}

const RadarPage = () => {
  const [actionSheetUser, setActionSheetUser] = useState<NearbyShareUser | null>(null);
  const [profileModalUser, setProfileModalUser] = useState<NearbyShareUser | null>(null);
  const [livePollUser, setLivePollUser] = useState<NearbyShareUser | null>(null);
  const sharing = useSharing();
  const { isDemoUser, user: me } = useAuth();
  const { saveDiscoveredProfile, addSavedProfile } = useConnections();
  const { isPremium } = useEntitlement();

  const subcategories = sharing.filters?.subcategories ?? [];
  const hasActiveFilters = subcategories.length > 0;
  const realNearbyUsers = sharing.nearbyUsers;

  const nearbyUsers = useMemo((): NearbyShareUser[] => realNearbyUsers, [realNearbyUsers]);

  useEffect(() => {
    sharing.setPremiumRadius(isPremium);
  }, [isPremium, sharing]);

  useEffect(() => {
    if (!livePollUser) return;

    const id = setInterval(async () => {
      try {
        const loc = sharing.currentLocation ?? getMockCenter(null);
        const res = await apiGet('/sharing/nearby', {
          latitude: String(loc.lat),
          longitude: String(loc.lng),
          sort: sharing.sortBy,
          radiusMeters: String(sharing.radiusMeters),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { users?: NearbyShareUser[] };
        const users = data.users ?? [];
        const fresh = users.find((u) => u.userId === livePollUser.userId);
        if (fresh) setLivePollUser(fresh);
      } catch {
        /* ignore */
      }
    }, 2000);

    return () => clearInterval(id);
  }, [livePollUser?.userId, sharing]);

  const showComingSoon = () => {
    toast.message(COMING_SOON, { duration: 4000 });
  };

  const handleBestMatchesClick = () => {
    showComingSoon();
  };

  const handleFiltersClick = () => {
    showComingSoon();
  };

  const handlePersonTap = (u: NearbyShareUser) => {
    setActionSheetUser(u);
    setLivePollUser(u);
  };

  const displayUserForModal = profileModalUser
    ? (nearbyUsers.find((u) => u.userId === profileModalUser.userId) ?? livePollUser ?? profileModalUser)
    : null;

  const handleViewProfile = () => {
    if (actionSheetUser) {
      setProfileModalUser(actionSheetUser);
    }
    setActionSheetUser(null);
  };

  const handleConnectLinkedIn = async () => {
    const u = actionSheetUser;
    setActionSheetUser(null);
    if (!u) return;
    if (!u.linkedinUrl?.trim() || !isValidLinkedInUrl(u.linkedinUrl)) {
      toast.message('LinkedIn profile is not available for this user.', { duration: 3500 });
      return;
    }
    await openLinkedInProfile(u.linkedinUrl);
  };

  const handleSaveProfile = async () => {
    const u = actionSheetUser;
    setActionSheetUser(null);
    if (!u || !me) return;
    if (u.userId === me.id) {
      toast.message('You cannot save your own profile.', { duration: 3000 });
      return;
    }
    if (isDemoUser) {
      const idx = nearbyUsers.findIndex((x) => x.userId === u.userId);
      const nu = shareUserToRadarUser(u, idx >= 0 ? idx : 0);
      addSavedProfile(nu);
      toast.success('Profile saved.');
      return;
    }
    try {
      const { message, alreadySaved } = await saveDiscoveredProfile(u.userId);
      toast.message(alreadySaved ? 'Profile already saved.' : message, { duration: 3000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save profile', { duration: 3000 });
    }
  };

  const statusMessage = (() => {
    if (hasActiveFilters) return `Filtering for ${subcategories.join(', ')}`;
    return 'Sorted by distance';
  })();

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div
        className="shrink-0 px-[var(--page-padding-x)] pb-2"
        style={{ paddingTop: 'calc(var(--page-padding-top) + env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="text-2xl font-bold text-foreground">Discover</h1>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-[var(--page-padding-x)]">
        <div className="shrink-0 flex flex-col gap-2 pb-4">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                sharing.isSharing ? 'bg-success' : 'bg-muted-foreground'
              }`}
            />
            <span className="text-[10px] text-muted-foreground font-medium">
              {sharing.isSharing ? 'Discovering people nearby' : 'Not sharing'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                sharing.setFilters({ subcategories: undefined });
                sharing.setSortBy('distance');
              }}
              className={`text-[11px] px-3 py-1.5 rounded-full transition-colors ${
                sharing.sortBy === 'distance' && !hasActiveFilters
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Distance
            </button>
            <button
              type="button"
              onClick={handleBestMatchesClick}
              className="text-[11px] px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 bg-muted text-muted-foreground hover:bg-muted/80"
            >
              Best matches
            </button>
            <button
              type="button"
              onClick={handleFiltersClick}
              className="text-[11px] px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer touch-manipulation bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/90"
            >
              <Filter size={10} />
              Filters
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground">{statusMessage}</p>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {nearbyUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {sharing.isSharing
                  ? 'Searching for people nearby…'
                  : 'No users nearby'}
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-[260px]">
                {sharing.isSharing
                  ? 'Make sure you have location access and Start Sharing is on.'
                  : 'Go to Home and tap Start Sharing to broadcast your profile.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-w-md mx-auto">
              {nearbyUsers.map((user) => (
                <NearbyUserListCard
                  key={user.userId}
                  user={user}
                  onTap={() => handlePersonTap(user)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {actionSheetUser && (
          <PersonActionSheet
            user={actionSheetUser}
            onViewProfile={handleViewProfile}
            onConnectLinkedIn={() => void handleConnectLinkedIn()}
            onSaveProfile={() => void handleSaveProfile()}
            onClose={() => {
              setActionSheetUser(null);
              setLivePollUser(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {displayUserForModal && (
          <DiscoverUserProfileModal
            user={displayUserForModal}
            onClose={() => {
              setProfileModalUser(null);
              setLivePollUser(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadarPage;
