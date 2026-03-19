import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProfileCard from '@/components/ProfileCard';
import PremiumPaywall from '@/components/PremiumPaywall';
import { NearbyUserListCard } from '@/components/NearbyUserListCard';
import { FindPersonRadarScreen } from '@/components/FindPersonRadarScreen';
import { PersonActionSheet } from '@/components/PersonActionSheet';
import { NearbyUser } from '@/data/mockUsers';
import { toast } from 'sonner';
import { useSharing } from '../hooks/useSharing';
import { useEntitlement } from '../hooks/useEntitlement';
import { NearbyShareUser } from '../utils/sharing';
import { shouldUseMockNearbyUsers, generateMockNearbyUsers, getMockCenter } from '../utils/mockNearbyUsers';
import { useAuth } from '../context/AuthContext';
import { useConnections } from '../context/ConnectionsContext';
import { apiRequest } from '../api/client';

/**
 * Convert NearbyShareUser to NearbyUser for ProfileCard.
 */
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
  const [actionSheetUser, setActionSheetUser] = useState<NearbyShareUser | null>(null);
  const [findingUser, setFindingUser] = useState<NearbyShareUser | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sharing = useSharing();
  const { token, isDemoUser } = useAuth();
  const { addConnection, addSavedProfile } = useConnections();
  const { isPremium, isLoading: entitlementLoading } = useEntitlement();

  const subcategories = sharing.filters?.subcategories ?? [];
  const hasActiveFilters = subcategories.length > 0;
  const realNearbyUsers = sharing.nearbyUsers;

  const nearbyUsers = useMemo((): NearbyShareUser[] => {
    if (realNearbyUsers.length > 0) return realNearbyUsers;
    if (shouldUseMockNearbyUsers(realNearbyUsers.length)) {
      const { lat, lng } = getMockCenter(sharing.currentLocation);
      const mock = generateMockNearbyUsers(lat, lng);
      if (mock.length > 0) {
        console.log('[Discover] Using', mock.length, 'mock nearby users (dev only)');
      }
      return mock;
    }
    return realNearbyUsers;
  }, [realNearbyUsers, sharing.currentLocation]);

  const allSubcategories = [...new Set(Object.values(SUBCATEGORIES_BY_INDUSTRY).flat())].sort();

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

  const handlePersonTap = (user: NearbyShareUser) => {
    setActionSheetUser(user);
  };

  const handleFindThisPerson = (user: NearbyShareUser) => {
    setFindingUser(user);
    setActionSheetUser(null);
  };

  const handleViewProfile = (user: NearbyShareUser) => {
    const idx = nearbyUsers.findIndex((u) => u.userId === user.userId);
    setSelectedUser(shareUserToRadarUser(user, idx >= 0 ? idx : 0));
    setActionSheetUser(null);
  };

  const handleConnect = async (u: NearbyUser, didConnect?: boolean) => {
    if (token && !isDemoUser) {
      try {
        await apiRequest('/interactions/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  useEffect(() => {
    if (selectedUser && token && !isDemoUser) {
      apiRequest('/interactions/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          eventType: 'card_opened',
        }),
      }).catch(() => {});
    }
  }, [selectedUser?.id, token]);

  const statusMessage = (() => {
    if (hasActiveFilters) return `Filtering for ${subcategories.join(', ')}`;
    if (sharing.sortBy === 'relevance') return 'Showing best matches';
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
        {/* Top controls */}
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

          <p className="text-[10px] text-muted-foreground">{statusMessage}</p>
        </div>

        {/* Nearby people list — primary content */}
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

      {/* Find Person radar screen — secondary state */}
      <AnimatePresence>
        {findingUser && (
          <FindPersonRadarScreen
            target={findingUser}
            myLocation={sharing.currentLocation ?? getMockCenter(null)}
            onBack={() => setFindingUser(null)}
          />
        )}
      </AnimatePresence>

      {/* Person action sheet */}
      <AnimatePresence>
        {actionSheetUser && (
          <PersonActionSheet
            user={actionSheetUser}
            onFindThisPerson={() => handleFindThisPerson(actionSheetUser)}
            onViewProfile={() => handleViewProfile(actionSheetUser)}
            onClose={() => setActionSheetUser(null)}
          />
        )}
      </AnimatePresence>

      {/* Filter overlay */}
      <AnimatePresence>
        {isPremium && filtersOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-start justify-center p-4 bg-background/60 backdrop-blur-sm"
            style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}
            onClick={(e) => e.target === e.currentTarget && setFiltersOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-background shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] font-medium text-muted-foreground mb-3 px-4 pt-4 shrink-0">
                Filter by subcategory
              </p>
              <div className="flex-1 min-h-0 overflow-y-auto px-4">
                {allSubcategories.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pb-4">
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
                  <p className="text-[11px] text-muted-foreground pb-4">No subcategories available.</p>
                )}
              </div>
              <div
                className="shrink-0 px-4 pb-4 pt-2 border-t border-border"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
              >
                <Button type="button" className="w-full" onClick={() => setFiltersOpen(false)}>
                  Done
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile card */}
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

      {/* Premium paywall */}
      <AnimatePresence>
        {showPaywall && !isPremium && (
          <PremiumPaywall
            onClose={() => {
              setShowPaywall(false);
              setPaywallFeature(undefined);
            }}
            feature={paywallFeature}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadarPage;
