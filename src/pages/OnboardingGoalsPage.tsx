import { useState } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPut } from '../api/client';
import { saveSession } from '../auth/authService';
import ScrollableSelectionBox from '@/components/ScrollableSelectionBox';

const GOAL_OPTIONS = [
  'Looking for funding',
  'Breaking into a new industry',
  'Looking for work',
  'Hiring talent',
  'Looking for co-founders',
  'Growing my network',
  'Finding mentors',
  'Seeking mentorship opportunities',
  'Looking for clients',
  'Looking for partnerships',
  'Exploring investment opportunities',
  'Raising a round',
  'Meeting people in my industry',
  'Switching careers',
  'Learning from experienced operators',
  'Finding startup opportunities',
  'Meeting alumni',
  'Finding collaborators',
  'Business development',
  'Recruiting for my company',
  'Looking for internships',
  'Looking for internship candidates',
  'Looking for advisors',
  'Looking for speaking opportunities',
  'Exploring new markets',
  'Building in public',
  'Finding technical talent',
  'Looking for product feedback',
  'Joining a startup',
  'Career advice',
  'Peer networking',
  'Sales leads',
  'Looking for a co-founder',
  'Looking for creators / brand partners',
  'Looking for operator roles',
  'Looking for finance opportunities',
  'Looking for startup talent',
];

/**
 * Final onboarding step: user selects goals (multi-select).
 * Last step before entering the main app.
 */
const OnboardingGoalsPage = () => {
  const { user, token, updateSession } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(user?.goals ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (goal: string) => {
    setSelected((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selected.length === 0) {
      setError('Please select at least one goal.');
      return;
    }

    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPut('/profile/goals', { goals: selected });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      const { token: newToken, user: updatedUser } = data;
      saveSession({ token: newToken, user: updatedUser });
      updateSession({ token: newToken, user: updatedUser });
      navigate('/', { replace: true });
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
            <Target size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">What are your goals?</h1>
          <p className="text-sm text-muted-foreground">
            Choose the goals that best match what you&apos;re looking for right now.
          </p>
        </div>

        {/* 2. Center: options container (max 50vh) + submit — vertically centered */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 flex flex-col justify-center min-w-0"
          noValidate
        >
          <div className="flex flex-col items-center gap-4 w-full">
            <ScrollableSelectionBox>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggle(goal)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors touch-manipulation ${
                      selected.includes(goal)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground active:bg-muted/90'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </ScrollableSelectionBox>

            {/* 3. Submit area — always visible, directly below container */}
            <div className="shrink-0 w-[90%] max-w-sm mx-auto space-y-2">
              <p className="text-xs text-muted-foreground text-center">{selected.length} selected</p>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || selected.length === 0}
              >
                {loading ? 'Saving…' : 'Finish'}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingGoalsPage;
