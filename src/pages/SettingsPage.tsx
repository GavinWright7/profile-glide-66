import { motion } from 'framer-motion';
import { Eye, Linkedin, LogOut, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validateLinkedInUrl } from '../utils/linkedinUrl';
import { apiPut } from '../api/client';
import { saveSession } from '../auth/authService';

const SettingsPage = () => {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [linkedinSaving, setLinkedinSaving] = useState(false);
  const navigate = useNavigate();
  const { user, token, updateSession, logout } = useAuth();

  const displayUrl = linkedinUrl || user?.linkedinUrl || '';

  const handleSaveLinkedInUrl = async () => {
    const normalized = validateLinkedInUrl(displayUrl);
    if (!normalized) {
      setLinkedinError('Enter a valid LinkedIn profile URL (e.g. linkedin.com/in/your-username)');
      return;
    }
    if (!token) return;

    setLinkedinError(null);
    setLinkedinSaving(true);
    try {
      const res = await apiPut('/profile/linkedin-url', { linkedin_url: normalized });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save');

      saveSession({ token: data.token, user: data.user });
      updateSession({ token: data.token, user: data.user });
      setLinkedinUrl('');
      setLinkedinError(null);
    } catch (err) {
      setLinkedinError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLinkedinSaving(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-y-auto px-[var(--page-padding-x)] pb-20 max-w-md mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        <div className="glass-card p-4 flex items-center gap-4 mb-6">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-14 h-14 rounded-full object-cover border border-primary/20"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold">
                {user?.firstName?.[0] ?? user?.name?.[0] ?? '?'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{user?.name ?? 'User'}</h3>
            <p className="text-xs text-muted-foreground truncate">{user?.headline || '—'}</p>
          </div>
          <Linkedin size={18} className="text-linkedin shrink-0" />
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Linkedin size={16} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              My LinkedIn Profile Link
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Paste your LinkedIn profile URL so others can connect when they tap you on the radar.
          </p>
          <div className="glass-card p-4 space-y-3">
            <Input
              type="text"
              inputMode="text"
              placeholder="Paste your full LinkedIn profile link"
              value={displayUrl}
              onChange={(e) => {
                setLinkedinUrl(e.target.value);
                setLinkedinError(null);
              }}
              className="font-mono text-sm"
            />
            {linkedinError && (
              <p className="text-sm text-destructive">{linkedinError}</p>
            )}
            <Button
              onClick={handleSaveLinkedInUrl}
              disabled={linkedinSaving}
              className="w-full"
            >
              {linkedinSaving ? 'Saving…' : 'Save LinkedIn URL'}
            </Button>
          </div>
        </div>

        <div className="glass-card p-4 flex items-start gap-3 mb-6">
          <Eye size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            When discoverable, only your name, company, and title are visible to nearby users. Email and private data are never shared.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full glass-card p-4 flex items-center gap-3 text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sign Out</span>
          <ChevronRight size={16} className="ml-auto" />
        </button>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;
