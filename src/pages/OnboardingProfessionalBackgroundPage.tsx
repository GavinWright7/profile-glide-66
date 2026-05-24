import { useState } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'framer-motion';
import { Briefcase, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPut } from '../api/client';
import { saveSession, BACKEND_URL, type AuthUser } from '../auth/authService';
import { isValidLinkedInUrl } from '../utils/linkedinUrl';

const DIAG = '[AirLinks][ProfessionalOnboarding]';

function apiHostname(): string {
  try {
    return new URL(BACKEND_URL).hostname || '(no-host)';
  } catch {
    return '(bad-BACKEND_URL)';
  }
}

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
  const [submitAttempted, setSubmitAttempted] = useState(false);

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
    setSubmitAttempted(true);

    if (!canContinue) {
      console.warn(`${DIAG} Continue blocked: client validation`, {
        jobTitleLen: currentJobTitle.trim().length,
        almaMaterLen: almaMater.trim().length,
        gradYearOk,
        gradInRange,
        graduationYearLen: graduationYear.trim().length,
      });
      if (!gradYearOk || !gradInRange) {
        setError('Enter a 4-digit graduation year between 1950 and 2100 (e.g. 2026).');
      } else {
        setError('Please fill in job title and alma mater.');
      }
      return;
    }

    if (!token) {
      console.error(`${DIAG} Continue blocked: no auth token in memory`);
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    console.log(`${DIAG} PUT /profile/professional-background`, {
      apiHost: apiHostname(),
      hasToken: true,
      jobTitleLen: currentJobTitle.trim().length,
      almaMaterLen: almaMater.trim().length,
      graduationYear: graduationYear.trim(),
      pastCompaniesCount: pastCompanies.length,
    });
    try {
      const res = await apiPut('/profile/professional-background', {
        currentJobTitle: currentJobTitle.trim(),
        currentCompany: currentCompany.trim() || null,
        almaMater: almaMater.trim(),
        graduationYear: graduationYear.trim(),
        pastCompanies,
      });

      let data: { error?: string; token?: string; user?: Record<string, unknown> };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        console.error(`${DIAG} response was not JSON`, { status: res.status, statusText: res.statusText });
        throw new Error('Server returned a non-JSON response (check API URL and server logs).');
      }

      if (!res.ok) {
        console.error(`${DIAG} API error`, {
          httpStatus: res.status,
          error: data?.error ?? '(no error field)',
        });
        throw new Error(data.error || 'Failed to save');
      }

      const { token: newToken, user: updatedUser } = data;
      if (!newToken || !updatedUser) {
        console.error(`${DIAG} success response missing token or user`, {
          hasToken: !!newToken,
          hasUser: !!updatedUser,
          keys: data && typeof data === 'object' ? Object.keys(data) : [],
        });
        throw new Error('Server response missing token or user');
      }

      /** API must return graduationYear; merge from form if an older deploy omits it (see OnboardingGuard). */
      const gradFromForm = graduationYear.trim();
      const raw = updatedUser as Record<string, unknown>;
      const gradFromApi =
        raw.graduationYear != null && String(raw.graduationYear).trim() !== ''
          ? String(raw.graduationYear).trim()
          : '';
      const gradMerged = gradFromApi || gradFromForm;
      if (!gradMerged) {
        console.error(`${DIAG} response missing graduationYear and form empty`);
        throw new Error('Could not apply graduation year to session');
      }
      if (!gradFromApi && gradFromForm) {
        console.warn(`${DIAG} API user omitted graduationYear; merging from form`, { gradFromForm });
      }

      const u = { ...raw, graduationYear: gradMerged } as Record<string, unknown>;
      console.log(`${DIAG} save OK; applying session + navigate /`, {
        userKeys: Object.keys(u),
        hasLinkedinUrl: typeof u.linkedinUrl === 'string' && u.linkedinUrl.length > 0,
        linkedinUrlValid:
          typeof u.linkedinUrl === 'string' ? isValidLinkedInUrl(u.linkedinUrl) : false,
        hasJobTitle: typeof u.currentJobTitle === 'string' && u.currentJobTitle.trim().length > 0,
        hasAlmaMater: typeof u.almaMater === 'string' && u.almaMater.trim().length > 0,
        graduationYear: u.graduationYear,
      });

      const asUser = { ...(updatedUser as unknown as AuthUser), graduationYear: gradMerged };
      saveSession({ token: newToken, user: asUser });
      // Ensure AuthContext sees the new user before OnboardingGuard runs on `/`.
      flushSync(() => {
        updateSession({ token: newToken, user: asUser });
      });
      console.log(`${DIAG} router.navigate('/') replace`);
      navigate('/', { replace: true });
    } catch (err) {
      console.error(`${DIAG} failed`, err instanceof Error ? err.message : err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const gradYearInvalid =
    submitAttempted && graduationYear.trim().length > 0 && (!gradYearOk || !gradInRange);
  const gradYearMissing = submitAttempted && graduationYear.trim().length === 0;

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
              pattern="[0-9]*"
              enterKeyHint="done"
              placeholder="2026"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className={`font-medium ${gradYearInvalid || gradYearMissing ? 'border-destructive ring-1 ring-destructive/50' : ''}`}
              disabled={loading}
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Required. Year you graduated or expect to graduate — used in your profile bio.
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
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Continue'}
          </Button>
          {!canContinue && !loading && (
            <p className="text-[11px] text-muted-foreground text-center">
              Fill all required fields above, including a 4-digit graduation year.
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingProfessionalBackgroundPage;
