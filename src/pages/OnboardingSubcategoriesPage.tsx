import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../auth/authService';
import { saveSession } from '../auth/authService';

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
  const { token, user, updateSession } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const ind = (location.state as { industries?: string[] })?.industries ?? user?.interests ?? [];
    if (Array.isArray(ind) && ind.length > 0) {
      setIndustries(ind);
      fetch(`${BACKEND_URL}/profile/interests-options`)
        .then((r) => r.json())
        .then((d) => setSubcategoriesMap(d.subcategories || {}))
        .catch(() => {});
    } else {
      navigate('/onboarding/interests', { replace: true });
    }
  }, [location.state, user?.interests, navigate]);

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
      const res = await fetch(`${BACKEND_URL}/profile/interests`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ interests }),
      });
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-foreground mb-2">Add Subcategories (Optional)</h1>
          <p className="text-sm text-muted-foreground">
            Pick subcategories for each industry to improve matching. You can skip this step.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={handleSkip} disabled={loading}>
              Skip
            </Button>
            <Button type="submit" className="flex-1 gap-1" disabled={loading}>
              {loading ? 'Saving…' : 'Continue'} <ChevronRight size={16} />
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingSubcategoriesPage;
