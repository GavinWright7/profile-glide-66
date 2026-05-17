import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trash2, ChevronLeft, Linkedin } from 'lucide-react';
import { useConnections } from '../context/ConnectionsContext';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { isValidLinkedInUrl } from '@/utils/linkedinUrl';
import { toast } from 'sonner';

const SavedProfilesPage = () => {
  const navigate = useNavigate();
  const { savedProfiles, removeSavedProfile, savedProfilesLoading } = useConnections();
  const sorted = [...savedProfiles].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  const openLinkedin = async (url: string) => {
    if (!isValidLinkedInUrl(url)) {
      toast.message('LinkedIn link not available.', { duration: 2500 });
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) await Browser.open({ url });
      else window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col min-w-0 px-[var(--page-padding-x)] pb-20 max-w-md mx-auto w-full">
        <motion.div className="flex flex-col flex-1 min-h-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft size={20} />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-2xl font-bold text-foreground shrink-0">Saved Profiles</h1>
        <p className="text-sm text-muted-foreground mb-4 shrink-0">
          People you saved from Discover
        </p>

        {savedProfilesLoading && (
          <p className="text-xs text-muted-foreground mb-2">Loading…</p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {sorted.map((saved, i) => (
            <motion.div
              key={saved.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-4">
                {saved.user.profilePhotoUrl ? (
                  <img
                    src={saved.user.profilePhotoUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 text-sm font-semibold">
                    {(saved.user.name || '?')[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {saved.user.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {saved.user.career || saved.user.headline || '—'}
                  </p>
                  {saved.user.bio && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {saved.user.bio}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Saved {format(saved.savedAt, 'MMM d')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => void removeSavedProfile(saved)}
                  title="Remove"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-linkedin border-linkedin/30"
                onClick={() => void openLinkedin(saved.user.linkedinProfileUrl)}
              >
                <Linkedin size={16} />
                Open LinkedIn
              </Button>
            </motion.div>
          ))}
        </div>

        {sorted.length === 0 && !savedProfilesLoading && (
          <div className="text-center py-8 flex-1 flex flex-col justify-center">
            <p className="text-muted-foreground">No saved profiles</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap &quot;Save Profile&quot; when you discover someone nearby
            </p>
          </div>
        )}
        </motion.div>
      </div>
    </div>
  );
};

export default SavedProfilesPage;
