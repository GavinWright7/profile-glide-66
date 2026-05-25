import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPatch } from '@/api/client';
import type { AuthUser } from '@/auth/authService';
import { bioProfileFromAuthUsers, generateBio } from '@/utils/bioTemplate';

function bioForEditing(u: AuthUser | null | undefined, sessionUser?: AuthUser | null): string {
  const stored = (u?.bio ?? '').trim();
  if (stored) return stored;
  const profile = bioProfileFromAuthUsers(u ?? undefined, sessionUser ?? undefined);
  return generateBio(profile);
}

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { token, user, updateSession, isDemoUser } = useAuth();
  const [bio, setBio] = useState('');
  const [currentJobTitle, setCurrentJobTitle] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [almaMater, setAlmaMater] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [pastJob, setPastJob] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyUserFields = useCallback((u: AuthUser | null | undefined, sessionUser?: AuthUser | null) => {
    setBio(bioForEditing(u, sessionUser));
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
    setPastJob((u?.pastCompanies?.[0] ?? sessionUser?.pastCompanies?.[0] ?? '').trim());
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
      const res = await apiGet('/profile');
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

  const save = async () => {
    if (!token || isDemoUser) {
      setError('Sign in to save your profile.');
      return;
    }

    const gradTrim = graduationYear.trim();
    if (gradTrim && (!/^\d{4}$/.test(gradTrim) || parseInt(gradTrim, 10) < 1950 || parseInt(gradTrim, 10) > 2100)) {
      setError('Graduation year must be a 4-digit year between 1950 and 2100, or leave blank.');
      return;
    }

    if (!currentJobTitle.trim() || !almaMater.trim()) {
      setError('Job title and alma mater are required.');
      return;
    }

    setSaving(true);
    setError(null);
    const trimmedBio = bio.trim();
    const pastCompanies = pastJob.trim() ? [pastJob.trim()] : [];

    try {
      const payload: Record<string, unknown> = {
        bio: trimmedBio,
        currentJobTitle: currentJobTitle.trim(),
        currentCompany: currentCompany.trim() || null,
        almaMater: almaMater.trim(),
        pastCompanies,
        ...(gradTrim ? { graduationYear: gradTrim } : {}),
      };

      const res = await apiPatch('/profile', payload);
      const data = (await res.json()) as { error?: string; token?: string; user?: AuthUser };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const { token: newToken, user: newUser } = data;
      if (newToken && newUser) {
        await updateSession({ token: newToken, user: newUser });
      }
      navigate('/profile', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div className="shrink-0 px-[var(--page-padding-x)] pt-[var(--page-padding-top)] pb-2 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-foreground">Edit Profile</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-[var(--page-padding-x)] pb-24 max-w-md mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Current job title
              </label>
              <Input
                className="mt-2"
                value={currentJobTitle}
                onChange={(e) => setCurrentJobTitle(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company
              </label>
              <Input
                className="mt-2"
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Alma mater
              </label>
              <Input
                className="mt-2"
                value={almaMater}
                onChange={(e) => setAlmaMater(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Graduation year <span className="text-muted-foreground/70 normal-case">(optional)</span>
              </label>
              <Input
                className="mt-2"
                inputMode="numeric"
                placeholder="2026"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Past job / company <span className="text-muted-foreground/70 normal-case">(optional)</span>
              </label>
              <Input
                className="mt-2"
                placeholder="e.g. Analyst at Acme Inc"
                value={pastJob}
                onChange={(e) => setPastJob(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bio
              </label>
              <Textarea
                className="mt-2 min-h-[160px] text-sm"
                placeholder="Tell nearby professionals about yourself…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                autoComplete="off"
                autoCorrect="on"
                spellCheck
              />
            </div>

            <Button className="w-full" onClick={() => void save()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin mr-2 w-4 h-4" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
