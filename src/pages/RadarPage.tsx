import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter, List, X } from 'lucide-react';
import RadarView from '@/components/RadarView';
import ProfileCard from '@/components/ProfileCard';
import PremiumPaywall from '@/components/PremiumPaywall';
import { NearbyUser, mockNearbyUsers } from '@/data/mockUsers';
import { toast } from 'sonner';
import { useSharing } from '../hooks/useSharing';
import { useEntitlement } from '../hooks/useEntitlement';
import { NearbyShareUser } from '../utils/sharing';
import { useAuth } from '../context/AuthContext';
import { useConnections } from '../context/ConnectionsContext';
import { BACKEND_URL } from '../auth/authService';

/**
 * Convert a backend NearbyShareUser to the NearbyUser shape RadarView expects.
 */
function shareUserToRadarUser(user: NearbyShareUser, index: number): NearbyUser {
  const parts    = user.headline?.split(' at ') ?? [];
  const jobTitle = parts[0]?.trim() ?? '';
  const company  = parts[1]?.trim() ?? '';
  const distance = Math.max(0.5, Math.min(10, user.distanceMeters / 15.24));

  return {
    id:                 user.userId,
    name:               user.fullName || 'Unknown',
    headline:           user.headline || '',
    company,
    jobTitle,
    profilePhotoUrl:    user.photoUrl || '',
    linkedinProfileUrl: user.linkedinUrl || '',
    linkedinId:         user.userId,
    distance,
    angle:              (index * 73 + 20) % 360,
  };
}

const SUBCATEGORIES_BY_INDUSTRY: Record<string, string[]> = {
  'Financial Services': ['Investment Banking', 'Private Equity', 'Venture Capital', 'Asset Management', 'Fintech', 'Insurance', 'Accounting', 'Other'],
  'Technology': ['Software', 'AI/ML', 'SaaS', 'Hardware', 'Cybersecurity', 'Cloud', 'Gaming', 'Other'],
  'Consulting': ['Management', 'Strategy', 'IT', 'HR', 'Sustainability', 'Other'],
  'Healthcare & Life Sciences': ['Pharma', 'Biotech', 'Medical Devices', 'Healthcare IT', 'Clinical', 'Other'],
  'Marketing & Advertising': ['Brand', 'Digital', 'Performance', 'Creative', 'Agency', 'Other'],
  'Human Resources & Recruiting': ['Talent Acquisition', 'HR Operations', 'L&D', 'Compensation', 'Other'],
  'Sales & Business Development': ['Enterprise', 'SMB', 'Partnerships', 'Inside Sales', 'Other'],
  'Education': ['Higher Ed', 'K-12', 'EdTech', 'Corporate Training', 'Other'],
  'Law / Legal Services': ['Corporate', 'Litigation', 'IP', 'Real Estate Law', 'Other'],
  'Real Estate': ['Commercial', 'Residential', 'PropTech', 'Development', 'Other'],
  'Government & Public Policy': ['Federal', 'State/Local', 'Nonprofit', 'Advocacy', 'Other'],
  'Media & Entertainment': ['Film/TV', 'Music', 'Publishing', 'Social', 'Other'],
  'Manufacturing & Industrial': ['Automotive', 'Aerospace', 'Consumer Goods', 'Industrial', 'Other'],
  'Energy & Natural Resources': ['Oil & Gas', 'Renewables', 'Mining', 'Utilities', 'Other'],
  'Transportation & Logistics': ['Logistics', 'Supply Chain', 'Mobility', 'Freight', 'Other'],
};

const RadarPage = () => {
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listViewOpen, setListViewOpen] = useState(false);
  const sharing = useSharing();
  const { token } = useAuth();
  const { addConnection, addSavedProfile } = useConnections();
  const { isPremium, isLoading: entitlementLoading } = useEntitlement();

  const subcategories = sharing.filters?.subcategories ?? [];
  const hasActiveFilters = subcategories.length > 0;

  const allSubcategories = [...new Set(
    Object.values(SUBCATEGORIES_BY_INDUSTRY).flat()
  )].sort();

  useEffect(() => {
    sharing.setPremiumRadius(isPremium);
  }, [isPremium, sharing]);

  useEffect(() => {
    if (entitlementLoading || isPremium) {
      sharing.clearRequiresPremiumPaywall();
      return;
    }
    if (sharing.requiresPremiumPaywall) {
      setShowPaywall(true);
      setPaywallFeature(undefined);
      sharing.clearRequiresPremiumPaywall();
    }
  }, [sharing.requiresPremiumPaywall, isPremium, entitlementLoading, sharing]);

  const handleSortBy = (sort: 'distance' | 'relevance') => {
    if (sort === 'relevance' && !isPremium) {
      setPaywallFeature('best matches');
      setShowPaywall(true);
      return;
    }
    sharing.setFilters({ subcategories: undefined });
    sharing.setSortBy(sort);
    setFiltersOpen(false);
  };

  const handleFiltersClick = () => {
    if (!isPremium) {
      setPaywallFeature('radar filters');
      setShowPaywall(true);
      return;
    }
    if (sharing.sortBy === 'relevance') {
      sharing.setSortBy('distance');
    }
    setFiltersOpen((o) => !o);
  };

  const toggleSubcategory = (sub: string) => {
    const next = subcategories.includes(sub)
      ? subcategories.filter((s) => s !== sub)
      : [...subcategories, sub];
    sharing.setFilters({ industries: undefined, subcategories: next.length ? next : undefined });
    sharing.setSortBy('distance');
  };

  const radarUsers: NearbyUser[] =
    sharing.nearbyUsers.length > 0
      ? sharing.nearbyUsers.map((u, i) => shareUserToRadarUser(u, i))
      : mockNearbyUsers.map((u, i) => ({
          ...u,
          distance: u.distance,
          angle: (i * 73 + 20) % 360,
        }));

  const statusMessage = (() => {
    if (hasActiveFilters) {
      return `Filtering for connections in ${subcategories.join(', ')}`;
    }
    if (sharing.sortBy === 'relevance') {
      return 'Showing best matches by field, shared interests, and background';
    }
    return 'Finding connections closest to you';
  })();

  useEffect(() => {
    if (selectedUser && token) {
      fetch(`${BACKEND_URL}/interactions/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          eventType: 'card_opened',
        }),
      }).catch(() => {});
    }
  }, [selectedUser?.id, token]);

  const handleConnect = async (u: NearbyUser, didConnect?: boolean) => {
    if (token) {
      try {
        await fetch(`${BACKEND_URL}/interactions/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            targetUserId: u.id,
            connectionMethod: 'in_app_tap',
          }),
        });
      } catch {
        /* ignore */
      }
    }
    const loc = sharing.currentLocation;
    addConnection(u, 'pending', loc?.lat, loc?.lng);
    if (didConnect) {
      toast.success(`Request sent to ${u.name}`, { duration: 3000 });
    } else {
      toast.success(`Added ${u.name} to History`, { duration: 3000 });
    }
    setSelectedUser(null);
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase();

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20">
      {/* Page header — 60px higher than Connections baseline */}
      <div
        className="shrink-0 px-4 pb-2"
        style={{ paddingTop: 'calc(8rem - 60px + env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="text-2xl font-bold text-foreground">Discover</h1>
      </div>

      {/* Centered content block — fills available height, vertically centers the whole discover area */}
      <div className="flex-1 min-h-0 flex flex-col justify-center px-4">
        <div className="flex flex-col items-center w-full max-w-md mx-auto">
          {/* 1. Top controls section — tightly grouped, 8px between elements */}
          <div className="flex flex-col items-center gap-2 shrink-0 relative z-20">
            <div className="flex items-center justify-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  sharing.isSharing ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                }`}
              />
              <span className="text-[10px] text-muted-foreground font-medium">
                {sharing.isSharing ? 'Discovering people nearby' : 'Not sharing'}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleSortBy('distance')}
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
                onClick={() => handleSortBy('relevance')}
                className={`text-[11px] px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
                  sharing.sortBy === 'relevance'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Best matches {!isPremium && '🔒'}
              </button>
              <button
                type="button"
                onClick={handleFiltersClick}
                className={`text-[11px] px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer touch-manipulation ${
                  filtersOpen || hasActiveFilters
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/90'
                }`}
              >
                <Filter size={10} />
                Filters{hasActiveFilters ? ` (${subcategories.length})` : ''} {!isPremium && '🔒'}
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center max-w-[280px] leading-tight min-h-[28px] flex items-center justify-center">
              {statusMessage}
            </p>

            <p className="text-xs font-semibold text-foreground">
              {radarUsers.length === 0
                ? sharing.isSharing
                  ? 'Searching…'
                  : 'No users'
                : `${radarUsers.length} ${radarUsers.length === 1 ? 'person' : 'people'} nearby`}
            </p>
          </div>

          {/* 2. Radar section — 16px gap above/below, main focal point */}
          <div className="flex justify-center items-center w-full py-4 shrink-0">
            <RadarView
              users={radarUsers}
              isScanning={sharing.isSharing}
              onUserTap={setSelectedUser}
            />
          </div>

          {/* 3. Bottom status section — 12px from radar, tucks under it */}
          <p className="text-center text-[10px] text-muted-foreground pt-3 shrink-0">
            {radarUsers.length > 0
              ? 'Tap a person to view their profile'
              : sharing.isSharing
              ? 'Waiting for nearby users…'
              : 'Go back and tap Start Sharing'}
          </p>

          {/* 4. View list button — below tap hint */}
          {radarUsers.length > 0 && (
            <button
              type="button"
              onClick={() => setListViewOpen(true)}
              className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              <List size={16} />
              View list
            </button>
          )}
        </div>
      </div>

      {/* Filter overlay — centered modal with blur backdrop */}
      <AnimatePresence>
        {isPremium && filtersOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-start justify-center pt-24 p-4 bg-background/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setFiltersOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col max-h-[70vh] overflow-hidden">
                <p className="text-[10px] font-medium text-muted-foreground mb-3 px-4 pt-4 shrink-0">
                  Filter by subcategory
                </p>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                {allSubcategories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {allSubcategories.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleSubcategory(sub)}
                        className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors touch-manipulation ${
                          subcategories.includes(sub)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/90'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    No subcategories available.
                  </p>
                )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUser && (
          <ProfileCard
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onConnect={handleConnect}
            onSaveProfile={(u) => {
              addSavedProfile(u);
              toast.success(`Saved ${u.name}`, { duration: 3000 });
            }}
          />
        )}
      </AnimatePresence>

      {/* List view overlay — drag up to view all profiles, no radar, YOU circle at top center */}
      <AnimatePresence>
        {listViewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <div
              className="shrink-0 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)] pb-3 border-b border-border"
              style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
            >
              <h2 className="text-lg font-semibold text-foreground">View list</h2>
              <button
                type="button"
                onClick={() => setListViewOpen(false)}
                className="p-2 -m-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <X size={20} />
              </button>
            </div>

            {/* YOU circle at top center — fixed, list scrolls below with padding so nothing goes under it */}
            <div className="shrink-0 flex justify-center py-6">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center glow-ring">
                <span className="text-primary-foreground text-sm font-semibold">You</span>
              </div>
            </div>

            {/* Scrollable list — min padding so no item ever overlaps YOU */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-24">
              <div className="space-y-2">
                {radarUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(user);
                      setListViewOpen(false);
                    }}
                    className="w-full glass-card p-4 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors rounded-xl"
                  >
                    <div className="w-12 h-12 rounded-full bg-secondary border-2 border-primary/40 flex items-center justify-center shrink-0">
                      <span className="text-foreground text-sm font-semibold">
                        {getInitials(user.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {user.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.headline || `${user.jobTitle} at ${user.company}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaywall && !isPremium && (
          <PremiumPaywall
            onClose={() => { setShowPaywall(false); setPaywallFeature(undefined); }}
            feature={paywallFeature}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadarPage;
