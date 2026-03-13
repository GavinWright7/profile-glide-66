import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter } from 'lucide-react';
import RadarView from '@/components/RadarView';
import ProfileCard from '@/components/ProfileCard';
import PremiumPaywall from '@/components/PremiumPaywall';
import { NearbyUser } from '@/data/mockUsers';
import { toast } from 'sonner';
import { useSharing } from '../hooks/useSharing';
import { useEntitlement } from '../hooks/useEntitlement';
import { NearbyShareUser } from '../utils/sharing';
import { useAuth } from '../context/AuthContext';
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
  const sharing = useSharing();
  const { token, user } = useAuth();
  const { isPremium } = useEntitlement();

  const subcategories = sharing.filters?.subcategories ?? [];
  const hasActiveFilters = subcategories.length > 0;

  const allSubcategories = [...new Set(
    Object.values(SUBCATEGORIES_BY_INDUSTRY).flat()
  )].sort();

  useEffect(() => {
    sharing.setPremiumRadius(isPremium);
  }, [isPremium, sharing]);

  useEffect(() => {
    if (sharing.requiresPremiumPaywall) {
      setShowPaywall(true);
      setPaywallFeature(undefined);
      sharing.clearRequiresPremiumPaywall();
    }
  }, [sharing.requiresPremiumPaywall]);

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

  const radarUsers: NearbyUser[] = sharing.nearbyUsers.map((u, i) =>
    shareUserToRadarUser(u, i)
  );

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

  const handleConnect = async (u: NearbyUser) => {
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
    toast.success(`Connection request sent to ${u.name}!`);
    setSelectedUser(null);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden px-4 pb-20">
      {/* Centered content block — fills available height, vertically centers the whole discover area */}
      <div className="flex-1 min-h-0 flex flex-col justify-center">
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
                {sharing.isSharing ? 'Discovering nearby' : 'Not sharing'}
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
              <div className="relative">
                <button
                  type="button"
                  onClick={handleFiltersClick}
                  className={`text-[11px] px-3 py-1.5 min-h-[36px] rounded-full transition-colors flex items-center gap-1 cursor-pointer touch-manipulation ${
                    filtersOpen || hasActiveFilters
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/90'
                  }`}
                >
                  <Filter size={10} />
                  Filters{hasActiveFilters ? ` (${subcategories.length})` : ''} {!isPremium && '🔒'}
                </button>
              </div>
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
        </div>
      </div>

      {/* Filter overlay — centered modal with blur backdrop */}
      <AnimatePresence>
        {isPremium && filtersOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm"
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
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaywall && (
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
