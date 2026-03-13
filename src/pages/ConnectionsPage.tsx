import { motion } from 'framer-motion';
import ConnectionCard from '@/components/ConnectionCard';
import { mockConnections } from '@/data/mockUsers';

const ConnectionsPage = () => {
  return (
    <div className="min-h-screen pt-12 p-6 pb-24 max-w-md mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">Connection History</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mockConnections.length} networking interactions
        </p>

        <div className="space-y-3">
          {mockConnections.map((conn, i) => (
            <motion.div
              key={conn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <ConnectionCard connection={conn} />
            </motion.div>
          ))}
        </div>

        {mockConnections.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No connections yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start sharing to connect with nearby professionals
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ConnectionsPage;
