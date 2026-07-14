import { useCallback, useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DiscoverProfileCard, PROXIMITY_LABEL } from '@/components/DiscoverProfileCard';
import { DiscoverPublicProfileModal } from '@/components/DiscoverPublicProfileModal';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConnections } from '../context/ConnectionsContext';
import { useSharing } from '../hooks/useSharing';
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
  jobTitle?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  school?: string;
  almaMater?: string;
  graduationYear?: string | null;
  pastCompanies?: string[];
  career?: string;
  industry?: string;
  interests?: string[];
};

function toNearbyUser(u: NearbyApiUser): NearbyUser | null {
  const name = u.fullName?.trim();
  if (!name) {
    console.warn('[Discover] skipping user with missing name', { userId: u.userId });
    return null;
  }
  const jobTitle = (u.currentJobTitle || u.jobTitle || u.headline?.split(' at ')[0] || '').trim();
  const company = (u.currentCompany || u.headline?.split(' at ')[1] || '').trim();
  const headline =
    u.headline?.trim() || (jobTitle && company ? `${jobTitle} at ${company}` : jobTitle || company);
  return {
    id: u.userId,
    name,
    headline,
    company,
    jobTitle,
    currentJobTitle: u.currentJobTitle || jobTitle,
    currentCompany: u.currentCompany || company,
    school: u.school || u.almaMater || '',
    almaMater: u.almaMater || u.school || '',
    graduationYear: u.graduationYear ?? null,
    pastCompanies: u.pastCompanies ?? [],
    profilePhotoUrl: u.photoUrl || '',
    linkedinProfileUrl: u.linkedinUrl || '',
    linkedinId: u.userId,
    distance: u.distanceMeters,
    angle: 0,
    bio: u.bio || '',
    career: u.career || '',
    industry: u.industry || u.interests?.[0] || '',
    interests: u.interests ?? [],
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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

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
      const params: Record<string, string> = {
        latitude: String(loc.lat),
        longitude: String(loc.lng),
        radiusMeters: String(FREE_RADIUS_METERS),
        sort: 'distance',
      };
      if (debouncedSearch) {
        params.q = debouncedSearch;
      }
      const res = await apiGet('/sharing/nearby', params);
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
  }, [isDemoUser, token, sharing.currentLocation, debouncedSearch]);

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

  const showDiscoverSpinner = sharing.isSharing || isDemoUser;
  const hasSearchFilter = debouncedSearch.length > 0;
  const emptyMessage = hasSearchFilter
    ? 'No nearby people match your search.'
    : 'Nobody nearby detected';

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
        <div className="relative max-w-md mx-auto w-full mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search name, industry, or company"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-[var(--page-padding-x)] pb-24 max-w-md mx-auto w-full">
        {showDiscoverSpinner && users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : null}
        {!showDiscoverSpinner && users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : null}
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
        <DiscoverPublicProfileModal
          user={modalUser}
          onClose={() => setModalUser(null)}
          onConnect={() => openLinkedIn(modalUser)}
        />
      )}
    </div>
  );
};

export default RadarPage;
