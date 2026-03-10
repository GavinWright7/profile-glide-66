import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import RadarView from '@/components/RadarView';
import ProfileCard from '@/components/ProfileCard';
import { mockNearbyUsers, NearbyUser } from '@/data/mockUsers';
import { toast } from 'sonner';

const RadarPage = () => {
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [isScanning] = useState(true);

  const handleConnect = (user: NearbyUser) => {
    toast.success(`Connection request sent to ${user.name}!`);
    setSelectedUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-24">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">Discovering nearby</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {mockNearbyUsers.length} people nearby
          </h1>
        </div>

        <RadarView
          users={mockNearbyUsers}
          isScanning={isScanning}
          onUserTap={setSelectedUser}
        />

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Tap a person to view their profile
        </p>
      </motion.div>

      <AnimatePresence>
        {selectedUser && (
          <ProfileCard
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onConnect={handleConnect}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadarPage;
