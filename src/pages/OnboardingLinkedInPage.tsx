import { useState } from 'react';
import { motion } from 'framer-motion';
import { Linkedin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateLinkedInUrl } from '../utils/linkedinUrl';
import { BACKEND_URL } from '../auth/authService';
import { saveSession } from '../auth/authService';
import { redeemPromoCode } from '../services/entitlementService';

/**
 * Required onboarding step: user must enter their LinkedIn profile URL
 * before they can use discoverability. Shown when user.linkedinUrl is empty.
 * Optional promo code "premium" unlocks premium features.
 */
const OnboardingLinkedInPage = () => {
  const [url, setUrl] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { token, updateSession } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = validateLinkedInUrl(url);
    if (!normalized) {
      setError('Use format: https://www.linkedin.com/in/your-username/');
      return;
    }

    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/profile/linkedin-url`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ linkedin_url: normalized }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      const { token: newToken, user } = data;
      saveSession({ token: newToken, user });
      updateSession({ token: newToken, user });

      if (promoCode.trim().toLowerCase() === 'premium') {
        await redeemPromoCode(newToken, 'premium');
      }

      navigate('/onboarding/professional-background', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-linkedin/10 border border-linkedin/20 flex items-center justify-center mx-auto mb-4">
            <Linkedin size={32} className="text-linkedin" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">LinkedIn Profile URL</h1>
          <p className="text-sm text-muted-foreground">
            Paste your public LinkedIn profile URL so others can connect with you when they discover you nearby.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            type="text"
            inputMode="text"
            placeholder="https://www.linkedin.com/in/your-username/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="font-mono text-sm"
            autoComplete="off"
            disabled={loading}
          />

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={12} className="text-primary" />
              Promo code (optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. premium"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="font-mono text-sm"
              autoComplete="off"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-linkedin hover:bg-linkedin/90 text-linkedin-foreground"
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Continue'}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-6 text-center">
          You can update this later in Settings.
        </p>
      </motion.div>
    </div>
  );
};

export default OnboardingLinkedInPage;
