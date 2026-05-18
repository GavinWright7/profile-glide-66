import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../auth/authService';
import { apiPut } from '../api/client';
import { saveSession } from '../auth/authService';
import ScrollableSelectionBox from '@/components/ScrollableSelectionBox';

/**
 * Optional onboarding step: select subcategories for each chosen industry.
 * User can skip this page.
 */
const OnboardingSubcategoriesPage = () => {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [industries, setIndustries] = useState<string[]>([]);
  const [subcategoriesMap, setSubcategoriesMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { token, updateSession } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const ind = (location.state as { industries?: string[] })?.industries ?? [];
    if (Array.isArray(ind) && ind.length > 0) {
      setIndustries(ind);
      fetch(`${BACKEND_URL}/profile/interests-options`)
        .then((r) => r.json())
        .then((d) => setSubcategoriesMap(d.subcategories || {}))
        .catch(() => {});
    } else {
      navigate('/onboarding/interests', { replace: true });
    }
  }, [location.state, navigate]);

  const toggle = (industry: string, sub: string) => {
    setSelections((prev) => {
      const arr = prev[industry] || [];
      const next = arr.includes(sub) ? arr.filter((s) => s !== sub) : [...arr, sub];
      return { ...prev, [industry]: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) return;

    setLoading(true);
    try {
      const interests = industries.map((industry) => ({
        industry,
        subcategories: selections[industry] || [],
      }));
      const res = await apiPut('/profile/interests', { interests });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      const { token: newToken, user: u } = data;
      saveSession({ token: newToken, user: u });
      updateSession({ token: newToken, user: u });
      navigate('/onboarding/linkedin-url', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/onboarding/linkedin-url', { replace: true });
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
          <h1 className="text-xl font-bold text-foreground mb-2">Add Subcategories (Optional)</h1>
          <p className="text-sm text-muted-foreground">
            Pick subcategories for each industry to improve matching. You can skip this step.
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
              <div className="space-y-4">
                {industries.map((industry) => (
                  <div key={industry}>
                    <h3 className="text-sm font-medium text-foreground mb-2">{industry}</h3>
                    <div className="flex flex-wrap gap-2">
                      {(subcategoriesMap[industry] || []).map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggle(industry, sub)}
                          disabled={loading}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation ${
                            (selections[industry] || []).includes(sub)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollableSelectionBox>

            {/* 3. Submit area — always visible, directly below container */}
            <div className="shrink-0 w-[90%] max-w-sm mx-auto space-y-2">
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={handleSkip} disabled={loading}>
                  Skip
                </Button>
                <Button type="submit" className="flex-1 gap-1" disabled={loading}>
                  {loading ? 'Saving…' : 'Continue'} <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingSubcategoriesPage;
