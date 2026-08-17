import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Linkedin, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { isDevResetAvailable, resetDevState } from '@/utils/devReset';

const ENABLE_APPLE_TESTER = import.meta.env.VITE_ENABLE_APPLE_TESTER === 'true';
const TAP_WINDOW_MS = 600;
const DEV_RESET_TAPS = 3;
const APPLE_TESTER_TAPS = 5;

const LoginPage = () => {
  const navigate = useNavigate();
  const { loginWithLinkedIn, loginAsAppleTester } = useAuth();
  const devTapCountRef = useRef(0);
  const devLastTapRef = useRef(0);
  const appleTapCountRef = useRef(0);
  const appleLastTapRef = useRef(0);

  const handleLogin = () => {
    void loginWithLinkedIn();
  };

  const handleLogoTap = () => {
    const now = Date.now();

    void (async () => {
      const devResetAllowed = await isDevResetAvailable();
      if (devResetAllowed) {
        if (now - devLastTapRef.current > TAP_WINDOW_MS) {
          devTapCountRef.current = 0;
        }
        devLastTapRef.current = now;
        devTapCountRef.current += 1;

        if (devTapCountRef.current >= DEV_RESET_TAPS) {
          devTapCountRef.current = 0;
          await resetDevState();
          toast.success('Dev reset — fresh install', { duration: 2000 });
          if (Capacitor.isNativePlatform()) {
            window.location.replace('/login');
          } else {
            window.location.reload();
          }
          return;
        }
      }

      if (!ENABLE_APPLE_TESTER) return;

      if (now - appleLastTapRef.current > TAP_WINDOW_MS) {
        appleTapCountRef.current = 0;
      }
      appleLastTapRef.current = now;
      appleTapCountRef.current += 1;

      if (appleTapCountRef.current >= APPLE_TESTER_TAPS) {
        appleTapCountRef.current = 0;
        loginAsAppleTester();
        toast.success('Review mode', { duration: 1500 });
      }
    })();
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col items-center justify-center px-[var(--page-padding-x)] w-full"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <motion.div
        className="flex flex-col items-center text-center max-w-sm w-full gap-[var(--block-gap)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.button
          type="button"
          className="rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-blue cursor-default touch-manipulation shrink-0"
          style={{ width: 'clamp(4rem, 18vw, 5.5rem)', height: 'clamp(4rem, 18vw, 5.5rem)' }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          onClick={handleLogoTap}
          aria-label="AirLinks logo"
        >
          <Wifi size={36} className="text-primary pointer-events-none" />
        </motion.button>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">AirLinks</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Exchange LinkedIn profiles instantly with nearby professionals. Like AirDrop, but for your career.
        </p>

        <Button
          className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold h-12 gap-3 text-base"
          onClick={handleLogin}
        >
          <Linkedin size={20} />
          Continue with LinkedIn
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full h-12 font-semibold text-base"
          onClick={() => navigate('/login/email')}
        >
          Sign in via email
        </Button>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          By signing in, you agree to share your public LinkedIn profile information with nearby users when discovery is active.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
