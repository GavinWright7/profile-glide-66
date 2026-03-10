import { motion } from 'framer-motion';
import { Wifi, WifiOff, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const HomePage = () => {
  const navigate = useNavigate();
  const [isSharing, setIsSharing] = useState(false);

  const handleStartSharing = () => {
    setIsSharing(true);
    setTimeout(() => navigate('/radar'), 600);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-24">
      <motion.div
        className="flex flex-col items-center text-center max-w-sm w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`w-2 h-2 rounded-full ${isSharing ? 'bg-success' : 'bg-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground font-medium">
            {isSharing ? 'Sharing Active' : 'Not Sharing'}
          </span>
        </div>

        {/* Main action */}
        <motion.button
          className="w-40 h-40 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-8 relative"
          whileTap={{ scale: 0.95 }}
          onClick={handleStartSharing}
        >
          {isSharing && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-primary/20"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.5 + i * 0.3, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                />
              ))}
            </>
          )}
          {isSharing ? (
            <WifiOff size={48} className="text-primary" />
          ) : (
            <Wifi size={48} className="text-primary" />
          )}
        </motion.button>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          {isSharing ? 'Scanning...' : 'Start Sharing'}
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          {isSharing
            ? 'Looking for nearby professionals'
            : 'Tap to broadcast your profile to nearby people'}
        </p>

        {/* Quick stats */}
        <div className="w-full glass-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">3 connections today</p>
              <p className="text-xs text-muted-foreground">12 this week</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary gap-1"
            onClick={() => navigate('/connections')}
          >
            View <ArrowRight size={14} />
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
