import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPut } from '../api/client';
import { saveSession } from '../auth/authService';
import { INDUSTRY_OPTIONS } from '@/constants/industries';

/**
 * Onboarding step: user selects their primary industry (required).
 */
const OnboardingIndustryPage = () => {
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { token, user, updateSession } = useAuth();

  useEffect(() => {
    const existing = user?.interests?.[0];
    if (existing) {
      setIndustry(existing);
    }
  }, [user?.interests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const selected = industry.trim();
    if (!selected) {
      setError('Please select your industry.');
      return;
    }

    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPut('/profile/interests', { interests: [selected] });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      const { token: newToken, user: updatedUser } = data;
      saveSession({ token: newToken, user: updatedUser });
      updateSession({ token: newToken, user: updatedUser });
      navigate('/onboarding/background-location', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const canContinue = industry.trim().length > 0;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col w-full overflow-y-auto overscroll-contain px-[var(--page-padding-x)] py-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(6rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <motion.div
        className="w-full max-w-sm mx-auto shrink-0"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Your Industry</h1>
          <p className="text-sm text-muted-foreground">
            Select the industry that best matches your professional background.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Industry <span className="text-destructive">*</span>
            </label>
            <Select value={industry} onValueChange={setIndustry} disabled={loading}>
              <SelectTrigger className="font-medium">
                <SelectValue placeholder="Select an industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !canContinue}>
            {loading ? 'Saving…' : 'Continue'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingIndustryPage;
