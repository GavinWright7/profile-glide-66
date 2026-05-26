import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { BackgroundGeolocation } from '../plugins/backgroundGeolocation';
import {
  BG_LOCATION_KEY,
  setBackgroundLocationGranted,
} from '../utils/sharing';

/**
 * One-time onboarding step: request "Always Allow" location for background discoverability.
 */
const OnboardingBackgroundLocationPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(BG_LOCATION_KEY) !== null) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const finish = (granted: boolean) => {
    setBackgroundLocationGranted(granted);
    navigate('/', { replace: true });
  };

  const handleEnable = async () => {
    setError(null);
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // One-shot watcher with requestPermissions: true triggers the Always Allow iOS prompt
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'AirLinks is keeping you discoverable.',
            backgroundTitle: 'AirLinks Location Active',
            requestPermissions: true,
            stale: false,
            distanceFilter: 10,
          },
          () => {}
        );
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
        finish(true);
      } else {
        finish(false);
      }
    } catch (err) {
      console.warn('[Onboarding] background location permission error', err);
      setBackgroundLocationGranted(false);
      finish(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    finish(false);
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col w-full overflow-y-auto overscroll-contain px-[var(--page-padding-x)] py-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(6rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <motion.div
        className="w-full max-w-sm mx-auto shrink-0 flex flex-col flex-1 justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <MapPin size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">Stay discoverable in the background</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AirLinks works best when it can update your location in the background. This lets people
            near you discover you even when the app is closed. Tap &quot;Always Allow&quot; when prompted.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive text-center mb-4" role="alert">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          <Button type="button" className="w-full" disabled={loading} onClick={() => void handleEnable()}>
            {loading ? 'Requesting permission…' : 'Enable Background Location'}
          </Button>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground" disabled={loading} onClick={handleSkip}>
            Not now
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingBackgroundLocationPage;
