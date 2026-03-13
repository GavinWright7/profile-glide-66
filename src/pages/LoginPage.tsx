import { motion } from 'framer-motion';
import { Linkedin, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { loginWithLinkedIn } = useAuth();

  // Always force account choice on login page so user can sign in with a different
  // LinkedIn account after signing out (avoids auto-sign-in with cached session).
  const handleLogin = () => loginWithLinkedIn(true);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        className="flex flex-col items-center text-center max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 glow-blue"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Wifi size={36} className="text-primary" />
        </motion.div>

        <h1 className="text-3xl font-bold text-foreground mb-2">Profile Glide</h1>
        <p className="text-muted-foreground text-sm mb-12 leading-relaxed">
          Exchange LinkedIn profiles instantly with nearby professionals. Like AirDrop, but for your career.
        </p>

        <Button
          className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold h-12 gap-3 text-base"
          onClick={handleLogin}
        >
          <Linkedin size={20} />
          Continue with LinkedIn
        </Button>

        <p className="text-[10px] text-muted-foreground mt-6 leading-relaxed">
          By signing in, you agree to share your public LinkedIn profile information with nearby users when discovery is active.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
