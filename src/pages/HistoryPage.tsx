import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useConnections } from '../context/ConnectionsContext';
import SwipeableHistoryItem from '@/components/SwipeableHistoryItem';
import { toast } from 'sonner';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { connections, updateStatus, removeConnection, savedProfiles } = useConnections();
  const pending = connections.filter((c) => c.status === 'pending');
  const sorted = [...pending].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );

  const handleSwipeRight = (id: string) => {
    const conn = connections.find((c) => c.id === id);
    updateStatus(id, 'connected');
    if (conn) toast.success(`Moved ${conn.user.name} to Connections`, { duration: 3000 });
  };

  return (
    <div className="min-h-screen page-with-header p-6 pb-24 max-w-md mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-0">History</h1>

        <div className="flex flex-col items-stretch my-3">
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

        <p className="text-sm text-muted-foreground mb-6">
          Pending requests — swipe right when they accept
        </p>

        <div className="space-y-3">
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
          <div className="text-center py-16">
            <p className="text-muted-foreground">No pending requests</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap people on the radar and connect on LinkedIn
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default HistoryPage;
