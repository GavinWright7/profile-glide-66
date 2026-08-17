import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const REVIEWER_USERNAME = 'AppTester';
const REVIEWER_PASSWORD = 'test123';

const EmailLoginPage = () => {
  const navigate = useNavigate();
  const { loginAsAppleTester } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userOk = email.trim() === REVIEWER_USERNAME;
    const passOk = password === REVIEWER_PASSWORD;
    if (!userOk || !passOk) {
      setError('Invalid email or password.');
      return;
    }
    setError(null);
    loginAsAppleTester();
    toast.success('Signed in', { duration: 1500 });
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col items-center justify-center px-[var(--page-padding-x)] w-full"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <motion.div
        className="flex flex-col max-w-sm w-full gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-sm text-muted-foreground self-start -ml-1 mb-2 touch-manipulation"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <h1 className="text-2xl font-bold text-foreground">Sign in via email</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and password to continue.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <Input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className="h-12"
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="h-12"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full h-12 font-semibold text-base mt-1">
            Sign In
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default EmailLoginPage;
