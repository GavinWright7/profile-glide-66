import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useConnections } from '../context/ConnectionsContext';
import SwipeableHistoryItem from '@/components/SwipeableHistoryItem';
import { Button } from '@/components/ui/button';
import {
  clearRecentlyViewed,
  loadRecentlyViewed,
  type RecentlyViewedProfile,
} from '@/utils/recentlyViewed';
import { toast } from 'sonner';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { connections, updateStatus, removeConnection, savedProfiles } = useConnections();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProfile[]>(() => loadRecentlyViewed());

  useEffect(() => {
    const refresh = () => setRecentlyViewed(loadRecentlyViewed());
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const pending = connections.filter((c) => c.status === 'pending');
  const sorted = [...pending].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );

  const handleSwipeRight = (id: string) => {
    const conn = connections.find((c) => c.id === id);
    updateStatus(id, 'connected');
    if (conn) toast.success(`Accepted ${conn.user.name}`, { duration: 3000 });
  };

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
            <p className="text-sm text-muted-foreground">Profiles you connect with on LinkedIn will appear here.</p>
          ) : (
            <div className="space-y-2">
              {recentlyViewed.map((entry) => (
                <div key={`${entry.id}-${entry.viewedAt}`} className="glass-card p-3 rounded-xl">
                  <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[entry.title, entry.company].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(entry.viewedAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleClearHistory}>
                Clear History
              </Button>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4 shrink-0">
          Pending requests — swipe right when they accept
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {sorted.map((conn, i) => (
            <SwipeableHistoryItem
              key={conn.id}
              conn={conn}
              index={i}
              onSwipeLeft={removeConnection}
              onSwipeRight={handleSwipeRight}
            />
          ))}
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-8 flex-1 flex flex-col justify-center">
            <p className="text-muted-foreground">No pending requests</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap people on Discover and connect on LinkedIn
            </p>
          </div>
        )}
        </motion.div>
      </div>
    </div>
  );
};

export default HistoryPage;
