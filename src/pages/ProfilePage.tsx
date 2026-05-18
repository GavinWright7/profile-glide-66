import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPatch } from '@/api/client';
import type { AuthUser } from '@/auth/authService';

function parsePastCompany(raw: string): { title: string; company: string } {
  const t = raw.trim();
  const idx = t.toLowerCase().indexOf(' at ');
  if (idx > 0) {
    return { title: t.slice(0, idx).trim(), company: t.slice(idx + 4).trim() };
  }
  if (t) return { title: '', company: t };
  return { title: '', company: '' };
}

/** Template bio from stored professional background (pastCompanies → first past job). */
export function generateBio(profile: {
  firstName?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  pastJobs?: { title: string; company: string }[];
  almaMater?: string;
  graduationYear?: string;
}): string {
  const parts: string[] = [];
  parts.push(`Hi, I'm ${profile.firstName || 'there'}.`);
  if (profile.currentJobTitle && profile.currentCompany) {
    parts.push(`I currently work as a ${profile.currentJobTitle} at ${profile.currentCompany}.`);
  } else if (profile.currentJobTitle) {
    parts.push(`I currently work as a ${profile.currentJobTitle}.`);
  }
  if (profile.pastJobs && profile.pastJobs.length > 0) {
    const { title, company } = profile.pastJobs[0];
    if (title && company) {
      parts.push(`Previously, I was a ${title} at ${company}.`);
    } else if (company) {
      parts.push(`Previously, I worked at ${company}.`);
    } else if (title) {
      parts.push(`Previously, I was a ${title}.`);
    }
  }
  if (profile.almaMater) {
    const grad = profile.graduationYear ? ` (${profile.graduationYear})` : '';
    parts.push(`I studied at ${profile.almaMater}${grad}.`);
  }
  parts.push(`Let's connect!`);
  return parts.join(' ');
}

function bioSourceFromUser(user: AuthUser | null | undefined) {
  const pastCompanies = user?.pastCompanies ?? [];
  const first = pastCompanies[0] ? parsePastCompany(pastCompanies[0]) : { title: '', company: '' };
  const pastJobs =
    first.title || first.company ? [{ title: first.title, company: first.company }] : undefined;
  return {
    firstName: user?.firstName,
    currentJobTitle: user?.currentJobTitle,
    currentCompany: user?.currentCompany,
    pastJobs,
    almaMater: user?.almaMater,
    graduationYear: undefined as string | undefined,
  };
}

export default function ProfilePage() {
  const { token, user, updateSession, isDemoUser } = useAuth();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sourceUser, setSourceUser] = useState<AuthUser | null>(null);

  const loadMe = useCallback(async () => {
    if (!token || isDemoUser) {
      const u = user;
      setSourceUser(u);
      const existing = (u?.bio ?? '').trim();
      setBio(existing || generateBio(bioSourceFromUser(u ?? undefined)));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/profile');
      const data = (await res.json()) as { user?: AuthUser };
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load profile');
      const u = data.user;
      if (u) {
        setSourceUser(u);
        const existing = (u.bio ?? '').trim();
        setBio(existing || generateBio(bioSourceFromUser(u)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, isDemoUser, user]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const handleGenerate = () => {
    const base = sourceUser ?? user;
    setBio(generateBio(bioSourceFromUser(base ?? undefined)));
  };

  const save = async () => {
    if (!token || isDemoUser) {
      setError('Sign in to save your profile.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiPatch('/profile', { bio: bio.trim() });
      const data = (await res.json()) as { error?: string; token?: string; user?: AuthUser };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const { token: newToken, user: newUser } = data;
      if (newToken && newUser) {
        await updateSession({ token: newToken, user: newUser });
        setSourceUser(newUser);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div
        className="flex-1 min-h-0 overflow-y-auto px-[var(--page-padding-x)] pb-24 max-w-md mx-auto w-full"
        style={{ paddingTop: 'calc(var(--page-padding-top) + env(safe-area-inset-top, 0px))' }}
      >
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">Profile</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your bio is shown when others view your profile from Discover.
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
          ) : (
            <>
              {error && <p className="text-sm text-destructive mb-4">{error}</p>}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Bio
                  </label>
                  <Textarea
                    className="mt-2 min-h-[160px] text-sm"
                    placeholder="Tell nearby professionals about yourself…"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>

                <Button type="button" variant="secondary" className="w-full" onClick={handleGenerate}>
                  Generate bio
                </Button>

                <Button className="w-full" onClick={() => void save()} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin mr-2 w-4 h-4" />
                      Saving…
                    </>
                  ) : savedFlash ? (
                    'Saved'
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
