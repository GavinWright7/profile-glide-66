import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, ChevronLeft, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch } from '../api/client';
import type { AuthUser } from '../auth/authService';
import { CAREER_OPTIONS } from '../constants/careers';
import { INDUSTRY_OPTIONS } from '@/constants/industries';

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { token, user, updateSession, isDemoUser } = useAuth();
  const [currentJobTitle, setCurrentJobTitle] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [almaMater, setAlmaMater] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [pastCompanies, setPastCompanies] = useState<string[]>([]);
  const [newPastCompany, setNewPastCompany] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [career, setCareer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const applyUserFields = useCallback((u: AuthUser | null | undefined, sessionUser?: AuthUser | null) => {
    setCurrentJobTitle(u?.currentJobTitle ?? sessionUser?.currentJobTitle ?? '');
    setCurrentCompany(u?.currentCompany ?? sessionUser?.currentCompany ?? '');
    setAlmaMater(u?.almaMater ?? sessionUser?.almaMater ?? '');
    setGraduationYear(
      u?.graduationYear != null && String(u.graduationYear).trim() !== ''
        ? String(u.graduationYear)
        : sessionUser?.graduationYear != null
          ? String(sessionUser.graduationYear)
          : ''
    );
    setPastCompanies(u?.pastCompanies?.length ? [...u.pastCompanies] : sessionUser?.pastCompanies ?? []);
    setInterests(u?.interests?.length ? [...u.interests] : sessionUser?.interests ?? []);
    setCareer(u?.career ?? sessionUser?.career ?? '');
  }, []);

  const loadMe = useCallback(async () => {
    if (!token || isDemoUser) {
      applyUserFields(user, user);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/profile/me');
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      applyUserFields(data.user ?? null, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, isDemoUser, user, applyUserFields]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= 3) return prev;
      return [...prev, interest];
    });
  };

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

  const gradTrim = graduationYear.trim();
  const gradYearProvided = gradTrim.length > 0;
  const gradYearOk = !gradYearProvided || /^\d{4}$/.test(gradTrim);
  const gradNum = gradYearProvided ? parseInt(gradTrim, 10) : NaN;
  const gradInRange = !gradYearProvided || (gradNum >= 1950 && gradNum <= 2100);
  const gradYearInvalid = submitAttempted && gradYearProvided && (!gradYearOk || !gradInRange);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitAttempted(true);

    if (!token || isDemoUser) {
      setError('Sign in to save your profile.');
      return;
    }

    if (gradYearProvided && (!gradYearOk || !gradInRange)) {
      setError('Graduation year must be a 4-digit year between 1950 and 2100, or leave blank.');
      return;
    }

    if (!currentJobTitle.trim() || !almaMater.trim()) {
      setError('Please fill in job title and alma mater.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        currentJobTitle: currentJobTitle.trim(),
        currentCompany: currentCompany.trim() || null,
        almaMater: almaMater.trim(),
        pastCompanies,
        interests,
        career: career.trim() || null,
        ...(gradTrim ? { graduationYear: gradTrim } : { graduationYear: null }),
      };

      const res = await apiPatch('/profile/me', payload);
      const data = (await res.json()) as { error?: string; token?: string; user?: AuthUser };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const { token: newToken, user: newUser } = data;
      if (newToken && newUser) {
        await updateSession({ token: newToken, user: newUser });
      }
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

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
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft size={18} />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Briefcase size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Edit Profile</h1>
          <p className="text-sm text-muted-foreground">
            Update your professional background and interests.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
          </div>
        ) : (
          <form onSubmit={(e) => void save(e)} className="space-y-4" noValidate>
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Graduation year <span className="text-muted-foreground/70">(optional)</span>
              </label>
              <Input
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="2026"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                className={`font-medium ${gradYearInvalid ? 'border-destructive ring-1 ring-destructive/50' : ''}`}
                disabled={saving}
                autoComplete="off"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Optional. If provided, used in your profile bio.
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
                  disabled={saving}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addPastCompany}
                  disabled={saving || !newPastCompany.trim()}
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

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-primary shrink-0" />
                <label className="text-xs font-medium text-muted-foreground">
                  Describe your role <span className="text-muted-foreground/70">(optional)</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {CAREER_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCareer(opt === career ? '' : opt)}
                    disabled={saving}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                      career === opt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-primary shrink-0" />
                <label className="text-xs font-medium text-muted-foreground">
                  Industry Interests
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">
                Select up to 3 industries that match your professional interests.
              </p>
              <div className="flex flex-wrap gap-2">
                {INDUSTRY_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    disabled={saving}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                      interests.includes(interest)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">{interests.length}/3 selected</p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin mr-2 w-4 h-4" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
