import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DiscoverProfileCard, PROXIMITY_LABEL } from '@/components/DiscoverProfileCard';
import { DiscoverPublicProfileModal } from '@/components/DiscoverPublicProfileModal';
import { SchoolAutocomplete, type CanonicalSchool } from '@/components/SchoolAutocomplete';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConnections } from '../context/ConnectionsContext';
import { useSharing } from '../hooks/useSharing';
import { apiGet } from '@/api/client';
import { FREE_RADIUS_METERS } from '@/services/entitlementService';
import { addRecentlyViewed } from '@/utils/recentlyViewed';
import { INDUSTRY_OPTIONS } from '@/constants/industries';
import type { NearbyUser } from '@/data/mockUsers';
import {
  EMPTY_DISCOVER_FILTERS,
  hasActiveDiscoverFilters,
  normalizeDiscoverFilters,
  toNearbyQueryParams,
  userMatchesDiscoverFilters,
  type DiscoverFilters,
} from '@/utils/discoverFilters';
import {
  setCachedDiscoverablePreference,
  showDiscoverableImmediately,
  showNotDiscoverableImmediately,
} from '@/utils/sharing';
import { openAppSettings } from '@/plugins/locationPermission';

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
  schoolId?: string | null;
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
    schoolId: u.schoolId != null && String(u.schoolId).trim() !== '' ? String(u.schoolId) : null,
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

function appliedFilterChips(filters: DiscoverFilters): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (filters.name) chips.push({ key: 'name', label: `Name: ${filters.name}` });
  if (filters.company) chips.push({ key: 'company', label: `Company: ${filters.company}` });
  if (filters.industry) chips.push({ key: 'industry', label: `Industry: ${filters.industry}` });
  if (filters.graduationYear) chips.push({ key: 'year', label: `Class of ${filters.graduationYear}` });
  if (filters.schoolId) chips.push({ key: 'school', label: `College: ${filters.schoolName || 'Selected school'}` });
  return chips;
}

const RadarPage = () => {
  const { user, token, isDemoUser, updateSession } = useAuth();
  const sharing = useSharing();
  const { addSavedProfile } = useConnections();
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [modalUser, setModalUser] = useState<NearbyUser | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DiscoverFilters>(EMPTY_DISCOVER_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DiscoverFilters>(EMPTY_DISCOVER_FILTERS);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const fetchGen = useRef(0);

  const isDiscoverable = sharing.isSharing === true;
  const hasActiveFilter = hasActiveDiscoverFilters(appliedFilters);

  const fetchNearby = useCallback(async () => {
    if (isDemoUser || !token || !isDiscoverable) {
      fetchGen.current += 1;
      setUsers([]);
      setLoading(false);
      return;
    }
    const loc = sharing.currentLocation;
    if (!loc) {
      setUsers([]);
      return;
    }
    const gen = ++fetchGen.current;
    setLoading(true);
    setFetchError(null);
    try {
      const params: Record<string, string> = {
        latitude: String(loc.lat),
        longitude: String(loc.lng),
        radiusMeters: String(FREE_RADIUS_METERS),
        sort: 'distance',
        ...toNearbyQueryParams(appliedFilters),
      };
      console.log('[Discover] nearby request', {
        hasName: Boolean(appliedFilters.name),
        hasCompany: Boolean(appliedFilters.company),
        hasIndustry: Boolean(appliedFilters.industry),
        hasYear: Boolean(appliedFilters.graduationYear),
        hasSchoolId: Boolean(appliedFilters.schoolId),
      });
      const res = await apiGet('/sharing/nearby', params);
      if (gen !== fetchGen.current) return;
      if (!res.ok) {
        setUsers([]);
        setFetchError('Could not load nearby people. Try again.');
        return;
      }
      const data = (await res.json()) as { users?: NearbyApiUser[]; requiresDiscoverable?: boolean };
      if (data.requiresDiscoverable) {
        setUsers([]);
        return;
      }
      const list = (data.users ?? [])
        .map(toNearbyUser)
        .filter((u): u is NearbyUser => u !== null)
        .filter((u) => u.distance <= FREE_RADIUS_METERS + 0.5)
        .filter((u) => userMatchesDiscoverFilters(u, appliedFilters));
      console.log('[Discover] nearby result', { count: list.length });
      setUsers(list);
    } catch {
      if (gen !== fetchGen.current) return;
      setUsers([]);
      setFetchError('Could not load nearby people. Try again.');
    } finally {
      if (gen === fetchGen.current) setLoading(false);
    }
  }, [isDemoUser, token, isDiscoverable, sharing.currentLocation, appliedFilters]);

  useEffect(() => {
    if (!isDiscoverable) {
      setUsers([]);
      setLoading(false);
      return;
    }
    void fetchNearby();
    const id = window.setInterval(() => void fetchNearby(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchNearby, isDiscoverable]);

  useEffect(() => {
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && isDiscoverable) void fetchNearby();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [fetchNearby, isDiscoverable]);

  const openFilterSheet = () => {
    setDraftFilters(appliedFilters);
    setFilterSheetOpen(true);
  };

  const applyFilter = () => {
    const next = normalizeDiscoverFilters(draftFilters);
    if (next.graduationYear && !/^\d{4}$/.test(next.graduationYear)) {
      toast.error('Graduation year must be a 4-digit year');
      return;
    }
    setUsers([]);
    setAppliedFilters(next);
    setFilterSheetOpen(false);
  };

  const clearFilter = () => {
    setDraftFilters(EMPTY_DISCOVER_FILTERS);
    setAppliedFilters(EMPTY_DISCOVER_FILTERS);
    setUsers([]);
    setFilterSheetOpen(false);
  };

  const openLinkedIn = (u: NearbyUser) => {
    logRecentlyViewed(u);
    window.open(u.linkedinProfileUrl, '_blank');
  };

  const handleTurnOnDiscoverable = async () => {
    if (!user || !token) {
      setEnableError('Please sign in again.');
      return;
    }
    setEnabling(true);
    setEnableError(null);
    setUsers([]);
    showDiscoverableImmediately(user, token);
    const result = await sharing.startSharing(user, token);
    if (result.user && result.token) {
      updateSession({ token: result.token, user: result.user });
      setCachedDiscoverablePreference(result.user.isDiscoverable === true, result.user, result.token);
    }
    if (!result.ok) {
      showNotDiscoverableImmediately();
      setEnableError(result.error || 'Could not turn on Discoverable Mode.');
      setUsers([]);
    }
    setEnabling(false);
  };

  const emptyMessage = hasActiveFilter
    ? 'No nearby people match your filters.'
    : 'Nobody nearby detected';
  const draftSchool: CanonicalSchool | null =
    draftFilters.schoolId && draftFilters.schoolName
      ? { id: draftFilters.schoolId, name: draftFilters.schoolName }
      : null;

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
          {isDiscoverable || isDemoUser ? (
            <div className="discover-spinner shrink-0 mt-1" aria-hidden="true" />
          ) : null}
        </div>

        {isDiscoverable ? (
          <div className="max-w-md mx-auto w-full mt-3 space-y-2">
            <Button
              type="button"
              variant={hasActiveFilter ? 'default' : 'outline'}
              className="w-full gap-2"
              onClick={openFilterSheet}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilter ? 'Filters active' : 'Filter'}
            </Button>

            {hasActiveFilter && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="flex-1 min-w-0 space-y-1">
                  {appliedFilterChips(appliedFilters).map((chip) => (
                    <p key={chip.key} className="text-xs text-foreground truncate">
                      {chip.label}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={clearFilter}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Clear filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filter nearby people</SheetTitle>
            <SheetDescription>All filled filters apply together.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Name</p>
              <Input
                type="search"
                placeholder="Search by first or last name"
                value={draftFilters.name}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, name: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Company</p>
              <Input
                type="search"
                placeholder="e.g. Google"
                value={draftFilters.company}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, company: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Industry</p>
              <Select
                value={draftFilters.industry || undefined}
                onValueChange={(industry) => setDraftFilters((prev) => ({ ...prev, industry }))}
              >
                <SelectTrigger className="font-medium">
                  <SelectValue placeholder="Select an industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draftFilters.industry ? (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground mt-1"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, industry: '' }))}
                >
                  Clear industry
                </button>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Graduation year</p>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 2028"
                value={draftFilters.graduationYear}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, graduationYear: e.target.value }))
                }
                autoComplete="off"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">College</p>
              <SchoolAutocomplete
                value={draftSchool}
                onChange={(school) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    schoolId: school?.id ?? '',
                    schoolName: school?.name ?? '',
                  }))
                }
                placeholder="Search for a school"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button type="button" className="w-full" onClick={applyFilter}>
                Apply filter
              </Button>
              {hasActiveFilter && (
                <Button type="button" variant="outline" className="w-full" onClick={clearFilter}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-h-0 overflow-y-auto px-[var(--page-padding-x)] pb-24 max-w-md mx-auto w-full">
        {!isDiscoverable && !isDemoUser ? (
          <div className="mt-10 rounded-xl border border-border bg-card/80 p-6 text-center space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Turn on Discoverable Mode</h2>
            <p className="text-sm text-muted-foreground">
              To make connections on AirLinks, you need to be discoverable. Turn on Discoverable Mode
              to see and connect with nearby professionals.
            </p>
            {enableError ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 space-y-2">
                <p className="text-xs text-destructive">{enableError}</p>
                {enableError.toLowerCase().includes('location') ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void openAppSettings()}>
                    Open Settings
                  </Button>
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={enabling || !user || !token}
              onClick={() => void handleTurnOnDiscoverable()}
            >
              {enabling ? 'Turning on…' : 'Turn On Discoverable'}
            </Button>
          </div>
        ) : null}

        {isDiscoverable || isDemoUser ? (
          <>
            {fetchError ? (
              <p className="text-sm text-destructive text-center py-4">{fetchError}</p>
            ) : null}
            {loading && users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Searching nearby…</p>
            ) : null}
            {!loading && users.length === 0 && !fetchError ? (
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
          </>
        ) : null}
      </div>

      {modalUser && isDiscoverable && (
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
