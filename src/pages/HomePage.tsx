import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useSharing } from '../hooks/useSharing';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const sharing = useSharing();

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
    <div className="min-h-screen page-with-header p-6 pb-24 max-w-md mx-auto">
      <motion.div
        className="flex flex-col items-center text-center max-w-sm w-full mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-foreground mb-1 w-full text-left">Home</h1>

        {/* Everything below Home — 60px lower */}
        <div className="mt-[60px] flex flex-col items-center w-full">
        {/* User greeting — 48px higher */}
        {user && (
          <div className="w-full flex items-center justify-between mb-6 -mt-12">
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

        {/* Error message */}
        {sharing.error && (
          <div className="w-full mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive text-center">{sharing.error}</p>
          </div>
        )}

        {/* Wifi radar + text below — 72px lower */}
        <div className="mt-[72px] flex flex-col items-center">
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
            <Wifi size={48} className="text-primary" />
          ) : (
            <WifiOff size={48} className="text-primary" />
          )}
        </motion.button>

        {/* Discoverable / Not Sharing with dot — below wifi signal, 72px lower */}
        <div className="flex items-center justify-center gap-2 mb-2 mt-[72px]">
          <div className={`w-2 h-2 rounded-full ${sharing.isSharing ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          <h2 className="text-2xl font-bold text-foreground">
            {sharing.isSharing ? 'Discoverable' : 'Not Sharing'}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          {sharing.isSharing
            ? sharing.appLifecycle === 'background'
              ? 'Sharing continues in background'
              : 'Broadcasting your profile to people nearby'
            : 'Tap to broadcast your profile to nearby people'}
        </p>

        <Button
          variant="outline"
          className="w-full mt-6 gap-2"
          onClick={() => navigate('/social-mode')}
        >
          <Sparkles size={18} />
          Social Mode
        </Button>
        </div>
        </div>

      </motion.div>
    </div>
  );
};

export default HomePage;
