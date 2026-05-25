import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useConnections } from '../context/ConnectionsContext';
import { Button } from '@/components/ui/button';
import {
  DiscoverProfileCard,
  nearbyUserFromRecentlyViewed,
} from '@/components/DiscoverProfileCard';
import {
  clearRecentlyViewed,
  loadRecentlyViewed,
  type RecentlyViewedProfile,
} from '@/utils/recentlyViewed';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { savedProfiles } = useConnections();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProfile[]>(() => loadRecentlyViewed());

  useEffect(() => {
    const refresh = () => setRecentlyViewed(loadRecentlyViewed());
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const handleClearHistory = () => {
    clearRecentlyViewed();
    setRecentlyViewed([]);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col min-w-0 px-[var(--page-padding-x)] pb-20 max-w-md mx-auto w-full">
        <motion.div className="flex flex-col flex-1 min-h-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground shrink-0">History</h1>

          <div className="flex flex-col items-stretch my-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/saved-profiles')}
              className="w-full glass-card p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-xl"
            >
              <span className="text-sm font-medium text-foreground">Saved Profiles</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {savedProfiles.length} saved
                </span>
                <ChevronRight size={18} className="text-muted-foreground" />
              </div>
            </button>
          </div>

          <div className="shrink-0 mb-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Recently Viewed</h2>
            {recentlyViewed.length === 0 ? (
              <div className="space-y-3" />
            ) : (
              <div className="space-y-3">
                {recentlyViewed.map((entry) => (
                  <DiscoverProfileCard
                    key={`${entry.id}-${entry.viewedAt}`}
                    user={nearbyUserFromRecentlyViewed(entry)}
                    showActions={false}
                  />
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleClearHistory}>
                  Clear History
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HistoryPage;
