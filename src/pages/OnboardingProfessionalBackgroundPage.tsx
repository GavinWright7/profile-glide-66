import { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../auth/authService';
import { saveSession } from '../auth/authService';

/**
 * Onboarding step: Professional Background (job title, company, alma mater, past companies).
 * Required after LinkedIn URL, before Goals.
 */
const OnboardingProfessionalBackgroundPage = () => {
  const { user, token, updateSession } = useAuth();
  const navigate = useNavigate();
  const [currentJobTitle, setCurrentJobTitle] = useState(user?.currentJobTitle ?? '');
  const [currentCompany, setCurrentCompany] = useState(user?.currentCompany ?? '');
  const [almaMater, setAlmaMater] = useState(user?.almaMater ?? '');
  const [pastCompanies, setPastCompanies] = useState<string[]>(user?.pastCompanies ?? []);
  const [newPastCompany, setNewPastCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addPastCompany = () => {
    const trimmed = newPastCompany.trim();
    if (trimmed && !pastCompanies.includes(trimmed)) {
      setPastCompanies((prev) => [...prev, trimmed]);
      setNewPastCompany('');
    }
  };

  const removePastCompany = (company: string) => {
    setPastCompanies((prev) => prev.filter((c) => c !== company));
  };

  const canContinue = currentJobTitle.trim() && currentCompany.trim() && almaMater.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canContinue) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/profile/professional-background`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentJobTitle: currentJobTitle.trim(),
          currentCompany: currentCompany.trim(),
          almaMater: almaMater.trim(),
          pastCompanies,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      const { token: newToken, user: updatedUser } = data;
      saveSession({ token: newToken, user: updatedUser });
      updateSession({ token: newToken, user: updatedUser });
      navigate('/onboarding/goals', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-24">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Briefcase size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Professional Background</h1>
          <p className="text-sm text-muted-foreground">
            Help us match you with the right people.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Current Job Title <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Product Manager"
              value={currentJobTitle}
              onChange={(e) => setCurrentJobTitle(e.target.value)}
              className="font-medium"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Current Company <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Acme Inc"
              value={currentCompany}
              onChange={(e) => setCurrentCompany(e.target.value)}
              className="font-medium"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Alma Mater <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Stanford University"
              value={almaMater}
              onChange={(e) => setAlmaMater(e.target.value)}
              className="font-medium"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Past Companies <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                type="text"
                placeholder="Add a past company"
                value={newPastCompany}
                onChange={(e) => setNewPastCompany(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPastCompany();
                  }
                }}
                autoComplete="off"
                className="font-medium flex-1"
                disabled={loading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  addPastCompany();
                }}
                disabled={loading || !newPastCompany.trim()}
                className="shrink-0"
              >
                <Plus size={18} />
              </Button>
            </div>
            {pastCompanies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pastCompanies.map((company) => (
                  <span
                    key={company}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-foreground"
                  >
                    {company}
                    <button
                      type="button"
                      onClick={() => removePastCompany(company)}
                      className="p-0.5 rounded hover:bg-muted-foreground/20 hover:text-destructive transition-colors"
                      aria-label={`Remove ${company}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !canContinue}
          >
            {loading ? 'Saving…' : 'Continue'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingProfessionalBackgroundPage;
