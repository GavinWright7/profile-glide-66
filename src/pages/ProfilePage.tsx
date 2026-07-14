import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPatch } from '@/api/client';
import type { AuthUser } from '@/auth/authService';
import { bioProfileFromAuthUsers, generateBio } from '@/utils/bioTemplate';
import { MAX_PROFILE_BIO_LENGTH } from '@/constants/careers';
import { toast } from 'sonner';

function bioForDisplay(u: AuthUser | null | undefined, sessionUser?: AuthUser | null): string {
  const stored = (u?.bio ?? '').trim();
  if (stored) return stored;
  const profile = bioProfileFromAuthUsers(u ?? undefined, sessionUser ?? undefined);
  return generateBio(profile);
}

function generatedBioFromUser(profileUser: AuthUser | null, sessionUser: AuthUser | null | undefined): string {
  return generateBio(bioProfileFromAuthUsers(profileUser ?? undefined, sessionUser ?? undefined));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, isDemoUser, updateSession } = useAuth();
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);
  const [bio, setBio] = useState('');
  const [savedBio, setSavedBio] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    if (!token || isDemoUser) {
      setProfileUser(user ?? null);
      const display = bioForDisplay(user, user);
      setBio(display);
      setSavedBio(display);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/profile');
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      const loaded = data.user ?? null;
      setProfileUser(loaded);
      const display = bioForDisplay(loaded, user);
      setBio(display);
      setSavedBio(display);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, isDemoUser, user]);

  useEffect(() => {
    void loadMe();
  }, [loadMe, location.pathname]);

  const saveBio = async () => {
    if (!token || isDemoUser) {
      toast.error('Sign in to save your bio.');
      return;
    }

    const trimmed = bio.trim();
    if (trimmed.length > MAX_PROFILE_BIO_LENGTH) {
      toast.error(`Bio must be ${MAX_PROFILE_BIO_LENGTH} characters or less.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiPatch('/profile/me', { bio: trimmed });
      const data = (await res.json()) as { error?: string; token?: string; user?: AuthUser };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.token && data.user) {
        await updateSession({ token: data.token, user: data.user });
        setProfileUser(data.user);
      }
      setSavedBio(trimmed);
      setBio(trimmed);
      setIsEditingBio(false);
      toast.success('Bio saved');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEditBioClick = () => {
    if (!isEditingBio) {
      setIsEditingBio(true);
      return;
    }
    void saveBio();
  };

  const handleResetBio = () => {
    const generated = generatedBioFromUser(profileUser, user);
    setBio(generated);
    toast.message('Bio reset to your profile template');
  };

  const bioDirty = bio.trim() !== savedBio.trim();

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
                  {isEditingBio ? (
                    <Textarea
                      className="mt-2 min-h-[160px] text-sm font-medium"
                      value={bio}
                      maxLength={MAX_PROFILE_BIO_LENGTH}
                      disabled={saving}
                      onChange={(e) => setBio(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div className="mt-2 min-h-[160px] rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
                      {bio.trim() ? bio : '—'}
                    </div>
                  )}
                  {isEditingBio && (
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">
                      {bio.length}/{MAX_PROFILE_BIO_LENGTH}
                    </p>
                  )}
                </div>

                <Button
                  className="w-full gap-2"
                  disabled={saving || (isEditingBio && !bio.trim())}
                  onClick={() => void handleEditBioClick()}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pencil className="w-4 h-4" />
                  )}
                  {isEditingBio ? 'Save bio' : 'Edit bio'}
                </Button>

                {isEditingBio ? (
                  <Button
                    type="button"
                    className="w-full gap-2"
                    disabled={saving}
                    onClick={handleResetBio}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset bio
                  </Button>
                ) : (
                  <Button className="w-full gap-2" onClick={() => navigate('/profile/edit')}>
                    <Pencil className="w-4 h-4" />
                    Edit profile
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
