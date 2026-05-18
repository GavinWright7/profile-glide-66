import { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPut } from '../api/client';
import { saveSession } from '../auth/authService';

/**
 * Onboarding step: Professional Background (job title, company, alma mater, past companies).
 * Required after LinkedIn URL. Completing this step finishes onboarding.
 */
const OnboardingProfessionalBackgroundPage = () => {
  const { user, token, updateSession } = useAuth();
  const navigate = useNavigate();
  const [currentJobTitle, setCurrentJobTitle] = useState(user?.currentJobTitle ?? '');
  const [currentCompany, setCurrentCompany] = useState(user?.currentCompany ?? '');
  const [almaMater, setAlmaMater] = useState(user?.almaMater ?? '');
  const [graduationYear, setGraduationYear] = useState(
    user?.graduationYear != null ? String(user.graduationYear) : ''
  );
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

  const gradYearOk = /^\d{4}$/.test(graduationYear.trim());
  const gradNum = gradYearOk ? parseInt(graduationYear.trim(), 10) : NaN;
  const gradInRange = gradNum >= 1950 && gradNum <= 2100;

  const canContinue =
    currentJobTitle.trim() && almaMater.trim() && gradYearOk && gradInRange;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canContinue) {
      setError('Please fill in job title, alma mater, and a valid 4-digit graduation year.');
      return;
    }

    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPut('/profile/professional-background', {
        currentJobTitle: currentJobTitle.trim(),
        currentCompany: currentCompany.trim() || null,
        almaMater: almaMater.trim(),
        graduationYear: graduationYear.trim(),
        pastCompanies,
      });

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
      className="flex-1 min-h-0 flex flex-col items-center justify-center px-[var(--page-padding-x)] pb-20"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
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
              placeholder="ex: Product Manager, Full-Time Student, etc."
              value={currentJobTitle}
              onChange={(e) => setCurrentJobTitle(e.target.value)}
              className="font-medium"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Current Company <span className="text-muted-foreground/70">(optional)</span>
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
              Alma Mater / Current School <span className="text-destructive">*</span>
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
              Graduation year <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 2026 — year you graduated or expect to graduate"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="font-medium"
              disabled={loading}
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Used to describe your school experience in your profile bio.
            </p>
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
