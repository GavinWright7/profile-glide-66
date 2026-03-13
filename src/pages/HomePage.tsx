import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Users, ArrowRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSharing } from '../hooks/useSharing';
import SharingDebugPanel from '../components/SharingDebugPanel';

const HomePage = () => {
  const navigate              = useNavigate();
  const { user, token, logout } = useAuth();
  const sharing               = useSharing();

  // Auto-resume if sharing was active when the app last ran
  useEffect(() => {
    if (user && token && !sharing.isSharing) {
      void sharing.tryAutoResume(user, token);
    }
    // Run once when user + token first become available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const handleToggleSharing = async () => {
    if (sharing.isSharing) {
      await sharing.stopSharing();
    } else if (user && token) {
      await sharing.startSharing(user, token);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-24">
      <motion.div
        className="flex flex-col items-center text-center max-w-sm w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* User greeting */}
        {user && (
          <div className="w-full flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-9 h-9 rounded-full object-cover border border-primary/20"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                  {user.firstName?.[0] ?? user.name[0]}
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  Signed in as {user.name}
                </p>
                {user.headline && (
                  <p className="text-xs text-muted-foreground leading-tight truncate max-w-[180px]">
                    {user.headline}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={logout}
              title="Sign out"
            >
              <LogOut size={16} />
            </Button>
          </div>
        )}

        {/* Lifecycle badge — visible when sharing in background */}
        {sharing.isSharing && sharing.appLifecycle === 'background' && (
          <div className="mb-3 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <p className="text-[11px] text-amber-400 font-mono">
              📍 Background sharing active ({sharing.heartbeatIntervalMs / 1000}s heartbeat)
            </p>
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`w-2 h-2 rounded-full ${sharing.isSharing ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground font-medium">
            {sharing.isSharing ? 'Discoverable' : 'Not Sharing'}
          </span>
        </div>

        {/* Error message */}
        {sharing.error && (
          <div className="w-full mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive text-center">{sharing.error}</p>
          </div>
        )}

        {/* Main action button */}
        <motion.button
          className="w-40 h-40 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-8 relative"
          whileTap={{ scale: 0.9, y: 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={handleToggleSharing}
        >
          {sharing.isSharing && (
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
          {sharing.isSharing ? (
            <Wifi size={48} className="text-primary" />
          ) : (
            <WifiOff size={48} className="text-primary" />
          )}
        </motion.button>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          {sharing.isSharing ? 'Discoverable' : 'Start Sharing'}
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          {sharing.isSharing
            ? sharing.appLifecycle === 'background'
              ? 'Sharing continues in background'
              : 'Broadcasting your profile nearby'
            : 'Tap to broadcast your profile to nearby people'}
        </p>

        {/* Quick stats */}
        <div className="w-full glass-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                {sharing.nearbyUsers.length > 0
                  ? `${sharing.nearbyUsers.length} nearby`
                  : '0 nearby'}
              </p>
              <p className="text-xs text-muted-foreground">
                {sharing.isSharing ? 'scanning…' : 'tap to start'}
              </p>
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

      <SharingDebugPanel />
    </div>
  );
};

export default HomePage;
