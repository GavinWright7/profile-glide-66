import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPut } from '../api/client';
import { saveSession } from '../auth/authService';
import ScrollableSelectionBox from '@/components/ScrollableSelectionBox';

const INTEREST_OPTIONS = [
  'Financial Services',
  'Technology',
  'Consulting',
  'Healthcare & Life Sciences',
  'Marketing & Advertising',
  'Human Resources & Recruiting',
  'Sales & Business Development',
  'Education',
  'Law / Legal Services',
  'Real Estate',
  'Government & Public Policy',
  'Media & Entertainment',
  'Manufacturing & Industrial',
  'Energy & Natural Resources',
  'Transportation & Logistics',
];

/**
 * Onboarding step: user selects up to 3 industry interests.
 * Required before LinkedIn URL and main app.
 */
const OnboardingInterestsPage = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { token, updateSession } = useAuth();

  const toggle = (interest: string) => {
    setSelected((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= 3) return prev;
      return [...prev, interest];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selected.length !== 3) {
      setError('Please select exactly 3 interests.');
      return;
    }

    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPut('/profile/interests', { interests: selected });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      const { token: newToken, user } = data;
      saveSession({ token: newToken, user });
      updateSession({ token: newToken, user });
      navigate('/onboarding/subcategories', { replace: true, state: { industries: selected } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden px-[var(--page-padding-x)]"
      style={{
        paddingTop: 'calc(var(--page-padding-top) + env(safe-area-inset-top, 0px))',
        paddingBottom: 'var(--submit-footer-pad)',
      }}
    >
      <motion.div
        className="w-full flex flex-col flex-1 min-h-0"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* 1. Top: title + instructions */}
        <div className="text-center shrink-0 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Your Interests</h1>
          <p className="text-sm text-muted-foreground">
            Select 3 industries that match your professional interests. We'll use this to show you more relevant people nearby.
          </p>
        </div>

        {/* 2. Center: options container (max 50vh) + submit button — vertically centered */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 flex flex-col justify-center min-w-0"
          noValidate
        >
          <div className="flex flex-col items-center gap-4 w-full">
            <ScrollableSelectionBox>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggle(interest)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                      selected.includes(interest)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </ScrollableSelectionBox>

            {/* 3. Submit area — always visible, directly below container */}
            <div className="shrink-0 w-[90%] max-w-sm mx-auto space-y-2">
              <p className="text-xs text-muted-foreground text-center">{selected.length}/3 selected</p>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || selected.length !== 3}
              >
                {loading ? 'Saving…' : 'Continue'}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingInterestsPage;
