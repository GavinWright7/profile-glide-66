import { motion } from 'framer-motion';
import { Shield, Eye, Linkedin, LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validateLinkedInUrl } from '../utils/linkedinUrl';
import { BACKEND_URL } from '../auth/authService';
import { saveSession } from '../auth/authService';
import { useEntitlement } from '../hooks/useEntitlement';

const SettingsPage = () => {
  const [discoverable, setDiscoverable] = useState(true);
  const [showCompany, setShowCompany] = useState(true);
  const [showHeadline, setShowHeadline] = useState(true);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [linkedinSaving, setLinkedinSaving] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSaving, setPromoSaving] = useState(false);
  const navigate = useNavigate();
  const { user, token, updateSession, logout } = useAuth();
  const { isPremium, redeemCode } = useEntitlement();

  // Initialize linkedinUrl from user when available
  const displayUrl = linkedinUrl || user?.linkedinUrl || '';

  const settingGroups = [
    {
      title: 'Privacy',
      icon: Shield,
      items: [
        { label: 'Discoverable by nearby users', value: discoverable, onChange: setDiscoverable },
        { label: 'Show company name', value: showCompany, onChange: setShowCompany },
        { label: 'Show headline', value: showHeadline, onChange: setShowHeadline },
      ],
    },
  ];

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
      const res = await fetch(`${BACKEND_URL}/profile/linkedin-url`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ linkedin_url: normalized }),
      });
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
    <div className="min-h-screen p-6 pb-24 max-w-md mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* Profile section */}
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

        {/* Premium / Promo Code */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Premium
            </h2>
          </div>
          <div className="glass-card p-4 space-y-3">
            {isPremium ? (
              <p className="text-sm text-primary font-medium">You have Premium access.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Enter promo code &quot;premium&quot; for dev/testing access.
                </p>
                <Input
                  type="text"
                  placeholder="Promo code"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); setPromoError(null); }}
                  className="font-mono text-sm"
                />
                {promoError && <p className="text-sm text-destructive">{promoError}</p>}
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setPromoError(null);
                    setPromoSaving(true);
                    const ok = await redeemCode(promoCode);
                    setPromoSaving(false);
                    if (ok) setPromoCode('');
                    else setPromoError('Invalid or expired code');
                  }}
                  disabled={promoSaving || !promoCode.trim()}
                >
                  {promoSaving ? 'Redeeming…' : 'Redeem'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* My LinkedIn Profile Link — paste your profile URL so others can connect when they discover you */}
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

        {/* Settings groups */}
        {settingGroups.map((group) => (
          <div key={group.title} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <group.icon size={16} className="text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h2>
            </div>
            <div className="glass-card divide-y divide-border/50">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <Switch checked={item.value} onCheckedChange={item.onChange} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Visibility info */}
        <div className="glass-card p-4 flex items-start gap-3 mb-6">
          <Eye size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            When discoverable, only your name, company, and title are visible to nearby users. Email and private data are never shared.
          </p>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full glass-card p-4 flex items-center gap-3 text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sign Out</span>
          <ChevronRight size={16} className="ml-auto" />
        </button>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
