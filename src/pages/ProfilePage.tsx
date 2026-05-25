import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/api/client';
import type { AuthUser } from '@/auth/authService';
import { bioProfileFromAuthUsers, generateBio } from '@/utils/bioTemplate';

function bioForDisplay(u: AuthUser | null | undefined, sessionUser?: AuthUser | null): string {
  const stored = (u?.bio ?? '').trim();
  if (stored) return stored;
  const profile = bioProfileFromAuthUsers(u ?? undefined, sessionUser ?? undefined);
  return generateBio(profile);
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, isDemoUser } = useAuth();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    if (!token || isDemoUser) {
      setBio(bioForDisplay(user, user));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/profile');
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      setBio(bioForDisplay(data.user ?? null, user));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, isDemoUser, user]);

  useEffect(() => {
    void loadMe();
  }, [loadMe, location.pathname]);

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
                  <div className="mt-2 min-h-[160px] rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
                    {bio.trim() ? bio : '—'}
                  </div>
                </div>

                <Button className="w-full gap-2" onClick={() => navigate('/profile/edit')}>
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
