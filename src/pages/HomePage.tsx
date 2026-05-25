import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useSharing } from '../hooks/useSharing';
import { setCachedDiscoverablePreference } from '../utils/sharing';

const HomePage = () => {
  const { user, token, isAuthReady, logout } = useAuth();
  const sharing = useSharing();

  useEffect(() => {
    if (isAuthReady && user && token) {
      setCachedDiscoverablePreference(user.isDiscoverable === true, user, token);
      if (user.isDiscoverable && !sharing.isSharing) {
        void sharing.tryAutoResume(user, token);
      }
    }
  }, [isAuthReady, user, token, sharing.isSharing, sharing.tryAutoResume]);

  const handleToggleSharing = async () => {
    if (sharing.isSharing) {
      await sharing.stopSharing();
    } else if (user && token) {
      await sharing.startSharing(user, token);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col min-w-0 px-[var(--page-padding-x)] pb-20 max-w-md mx-auto w-full">
        <motion.div
          className="flex flex-col flex-1 min-h-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="shrink-0">
            <h1 className="text-2xl font-bold text-foreground">Home</h1>
            {user && (
              <div className="flex items-center justify-between mt-3">
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
                      <p className="text-xs text-muted-foreground leading-tight truncate max-w-[min(180px,50vw)]">
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
          </div>

          {sharing.isSharing && sharing.appLifecycle === 'background' && (
            <div className="mt-3 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 w-fit">
              <p className="text-[11px] text-amber-400 font-mono">
                📍 Background sharing active ({sharing.heartbeatIntervalMs / 1000}s heartbeat)
              </p>
            </div>
          )}

          {sharing.error && (
            <div className="mt-3 w-full px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive text-center">{sharing.error}</p>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
            <motion.button
              className="rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center relative shrink-0"
              style={{ width: 'var(--icon-button-size-home)', height: 'var(--icon-button-size-home)' }}
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
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 0,
                        delay: i * (2 / 3),
                      }}
                    />
                  ))}
                </>
              )}
              {sharing.isSharing ? (
                <Wifi size={64} className="text-primary" />
              ) : (
                <WifiOff size={64} className="text-primary" />
              )}
            </motion.button>

            <div className="flex flex-col items-center w-full gap-[var(--section-gap)] mt-20 max-w-sm">
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${sharing.isSharing ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                <h2 className="text-2xl font-bold text-foreground">
                  {sharing.isSharing ? 'Discoverable' : 'Not Sharing'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {sharing.isSharing
                  ? sharing.appLifecycle === 'background'
                    ? 'Sharing continues in background'
                    : 'Broadcasting your profile to people nearby'
                  : 'Tap to broadcast your profile to nearby people'}
              </p>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HomePage;
