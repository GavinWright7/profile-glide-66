import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPatch } from '@/api/client';
import { saveSession } from '@/auth/authService';
import { filterBlsOccupations } from '@/utils/filterBlsOccupations';
import ScrollableSelectionBox from '@/components/ScrollableSelectionBox';

const BIO_MAX = 300;

const INTEREST_OPTIONS = [
  'Financial Services',
  'Technology',
  'Consulting',
  'Healthcare & Life Sciences',
  'Marketing & Advertising',
  'Human Resources & Recruiting',
  'Sales & Business Development',
  'Education',
  'Law / Legal Services',
  'Real Estate',
  'Government & Public Policy',
  'Media & Entertainment',
  'Manufacturing & Industrial',
  'Energy & Natural Resources',
  'Transportation & Logistics',
];

export default function ProfilePage() {
  const { token, user, updateSession, isDemoUser } = useAuth();
  const [bio, setBio] = useState('');
  const [career, setCareer] = useState('');
  const [careerSearch, setCareerSearch] = useState('');
  const [careerOpen, setCareerOpen] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [blsOccupations, setBlsOccupations] = useState<readonly string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/occupations').then((m) => {
      if (!cancelled) setBlsOccupations(m.BLS_OCCUPATIONS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const careerSuggestions = useMemo(
    () => filterBlsOccupations(careerSearch, blsOccupations ?? []),
    [careerSearch, blsOccupations]
  );

  const loadMe = useCallback(async () => {
    if (!token || isDemoUser) {
      setBio(user?.bio || '');
      setCareer(user?.career || '');
      setSelectedInterests(user?.interests?.slice(0, 3) || []);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/profile/me');
      const data = (await res.json()) as { user?: typeof user };
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load profile');
      const u = data.user;
      if (u) {
        setBio(u.bio || '');
        setCareer(u.career || '');
        setSelectedInterests((u.interests || []).slice(0, 3));
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

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= 3) return prev;
      return [...prev, interest];
    });
  };

  const save = async () => {
    if (!token || isDemoUser) {
      setError('Sign in to save your profile.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiPatch('/profile/me', {
        bio: bio.trim(),
        career: career.trim() || null,
        interests: selectedInterests,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const { token: newToken, user: newUser } = data;
      saveSession({ token: newToken, user: newUser });
      updateSession({ token: newToken, user: newUser });
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
            Your public details shown when others discover you.
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
          ) : (
            <>
              {error && (
                <p className="text-sm text-destructive mb-4">{error}</p>
              )}

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Career
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                    Search by typing the first letters, pick a title, or save your own.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCareerOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-background/80 text-left text-sm"
                  >
                    <span className={career ? 'text-foreground' : 'text-muted-foreground'}>
                      {career || 'Select or type a career'}
                    </span>
                    {careerOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {careerOpen && (
                    <div className="mt-2 rounded-xl border border-border bg-card p-3 space-y-2">
                      <input
                        type="text"
                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                        placeholder="Start typing (e.g. B for titles starting with B)"
                        value={careerSearch}
                        onChange={(e) => setCareerSearch(e.target.value)}
                      />
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {careerSearch.trim() && careerSuggestions.length === 0 && (
                          <p className="text-xs text-muted-foreground px-1">No matches — save your text below.</p>
                        )}
                        {careerSuggestions.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className="w-full text-left text-sm py-2 px-2 rounded-lg hover:bg-muted"
                            onClick={() => {
                              setCareer(c);
                              setCareerSearch('');
                              setCareerOpen(false);
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      {careerSearch.trim() && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full text-sm"
                          onClick={() => {
                            setCareer(careerSearch.trim());
                            setCareerOpen(false);
                          }}
                        >
                          Use &quot;{careerSearch.trim()}&quot; as my career
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full text-sm"
                        onClick={() => {
                          setCareer('Other');
                          setCareerOpen(false);
                        }}
                      >
                        Other
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-baseline">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bio
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      {bio.length}/{BIO_MAX}
                    </span>
                  </div>
                  <Textarea
                    className="mt-2 min-h-[120px] text-sm"
                    placeholder="Tell nearby professionals about yourself…"
                    value={bio}
                    maxLength={BIO_MAX}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Interests (up to 3)
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                    Industries you care about — editable anytime.
                  </p>
                  <ScrollableSelectionBox>
                    <div className="grid grid-cols-1 gap-2 pr-2">
                      {INTEREST_OPTIONS.map((opt) => {
                        const active = selectedInterests.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleInterest(opt)}
                            className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted/40 border-border hover:bg-muted'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollableSelectionBox>
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
                    'Save profile'
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
