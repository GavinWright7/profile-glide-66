import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useConnections } from '../context/ConnectionsContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DiscoverProfileCard,
  nearbyUserFromRecentlyViewed,
} from '@/components/DiscoverProfileCard';
import {
  clearRecentlyViewed,
  loadRecentlyViewed,
  type RecentlyViewedProfile,
} from '@/utils/recentlyViewed';

const CONTENT_MIN_HEIGHT = 'min-h-[7.5rem]';

function RecentlyViewedCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4">
      <div className="flex gap-3">
        <Skeleton className="w-14 h-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

const HistoryPage = () => {
  const navigate = useNavigate();
  const { savedProfiles } = useConnections();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProfile[]>([]);
  const [recentlyViewedReady, setRecentlyViewedReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setRecentlyViewed(loadRecentlyViewed());
      setRecentlyViewedReady(true);
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const handleClearHistory = () => {
    clearRecentlyViewed();
    setRecentlyViewed([]);
  };

  const viewedCount = recentlyViewed.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-y-auto px-[var(--page-padding-x)] pb-20 max-w-md mx-auto w-full">
        <motion.div
          className="flex flex-col flex-1 min-h-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground shrink-0">History</h1>

          <div className="flex flex-col gap-3 mt-3 shrink-0">
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

            <section className="flex flex-col gap-3">
              <div className="w-full glass-card p-4 flex items-center justify-between rounded-xl">
                <span className="text-sm font-medium text-foreground">Recently Viewed</span>
                {recentlyViewedReady && viewedCount > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {viewedCount} viewed
                  </span>
                ) : null}
              </div>

              <div className={`flex flex-col ${CONTENT_MIN_HEIGHT}`}>
                {!recentlyViewedReady ? (
                  <RecentlyViewedCardSkeleton />
                ) : viewedCount === 0 ? (
                  <div
                    className={`glass-card rounded-xl p-4 flex flex-1 items-center justify-center ${CONTENT_MIN_HEIGHT}`}
                  >
                    <p className="text-xs text-muted-foreground text-center px-2">
                      Profiles you connect with on LinkedIn will appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {recentlyViewed.map((entry) => (
                        <DiscoverProfileCard
                          key={`${entry.id}-${entry.viewedAt}`}
                          user={nearbyUserFromRecentlyViewed(entry)}
                          showActions={false}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleClearHistory}
                    >
                      Clear History
                    </Button>
                  </>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HistoryPage;
