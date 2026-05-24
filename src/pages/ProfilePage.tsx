import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function ProfilePage() {
  const { token, user, updateSession, isDemoUser } = useAuth();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const loadMe = useCallback(async () => {
    if (!token || isDemoUser) {
      setBio(bioForEditing(user, user));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/profile');
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      setBio(bioForEditing(data.user ?? null, user));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, isDemoUser, user]);

  useEffect(() => {
    void loadMe();
  }, [token, isDemoUser]);

  const save = async () => {
    if (!token || isDemoUser) {
      setError('Sign in to save your profile.');
      return;
    }
    setSaving(true);
    setError(null);
    const trimmed = bio.trim();
    try {
      const res = await apiPatch('/profile', { bio: trimmed });
      const data = (await res.json()) as { error?: string; token?: string; user?: AuthUser };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const { token: newToken, user: newUser } = data;
      if (newToken && newUser) {
        await updateSession({ token: newToken, user: newUser });
        setBio((newUser.bio ?? '').trim() || trimmed);
      } else {
        setBio(trimmed);
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
      <div className="flex-1 min-h-0 overflow-y-auto px-[var(--page-padding-x)] pb-24 max-w-md mx-auto w-full">
        <div>
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
                  ) : savedFlash ? (
                    'Saved'
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
