import { motion } from 'framer-motion';
import { NearbyUser } from '@/data/mockUsers';
import { X, Linkedin, Share2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { isValidLinkedInUrl } from '@/utils/linkedinUrl';

interface ProfileCardProps {
  user: NearbyUser;
  onClose: () => void;
  onConnect: (user: NearbyUser) => void;
}

/**
 * Open the exact saved linkedin_url. No construction from auth data.
 * Try LinkedIn app first on native, then Browser.open.
 */
async function openLinkedInProfile(url: string): Promise<void> {
  if (!url || !isValidLinkedInUrl(url)) {
    toast.error('LinkedIn profile URL is missing or invalid');
    return;
  }

  console.log('[ProfileCard] Opening LinkedIn profile:', url);

  if (Capacitor.isNativePlatform()) {
    const slug = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i)?.[1];
    const appDeepLink = slug ? `linkedin://in/${slug}` : null;
    if (appDeepLink) {
      try {
        const result = await App.openUrl({ url: appDeepLink });
        if (result.completed) {
          console.log('[ProfileCard] Opened in LinkedIn app');
          return;
        }
      } catch {
        /* fall through */
      }
    }
  }

  try {
    await Browser.open({ url });
    console.log('[ProfileCard] Opened in browser:', url);
  } catch {
    window.open(url, '_blank');
  }
}

const ProfileCard = ({ user, onClose, onConnect }: ProfileCardProps) => {
  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase();

  const handleConnect = async () => {
    await openLinkedInProfile(user.linkedinProfileUrl);
    onConnect(user);
  };

  const hasValidUrl = isValidLinkedInUrl(user.linkedinProfileUrl);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 glass-card p-6 z-10"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          {user.profilePhotoUrl ? (
            <img
              src={user.profilePhotoUrl}
              alt={user.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-primary/30 mb-4 glow-ring"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-secondary border-2 border-primary/30 flex items-center justify-center mb-4 glow-ring">
              <span className="text-foreground text-xl font-bold">{getInitials(user.name)}</span>
            </div>
          )}

          <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{user.headline}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            {user.company && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                {user.company}
              </span>
            )}
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">{user.distance}m away</span>
          </div>

          <div className="w-full mt-6 space-y-3">
            <Button
              className={`w-full font-semibold gap-2 ${
                hasValidUrl
                  ? 'bg-linkedin hover:bg-linkedin/90 text-linkedin-foreground'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              }`}
              onClick={hasValidUrl ? handleConnect : undefined}
              disabled={!hasValidUrl}
              title={hasValidUrl ? `Open ${user.linkedinProfileUrl}` : 'LinkedIn profile URL not available'}
            >
              <Linkedin size={18} />
              {hasValidUrl ? 'Connect on LinkedIn' : 'Profile URL unavailable'}
            </Button>

            {!hasValidUrl && (
              <p className="text-[10px] text-muted-foreground text-center">
                This user hasn&apos;t added their LinkedIn profile link yet. They can add it in Settings.
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 gap-2">
                <Share2 size={16} />
                Send Profile
              </Button>
              <Button variant="secondary" className="flex-1 gap-2">
                <Bookmark size={16} />
                Save
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProfileCard;
