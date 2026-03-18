import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trash2, ChevronLeft } from 'lucide-react';
import { useConnections } from '../context/ConnectionsContext';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const SavedProfilesPage = () => {
  const navigate = useNavigate();
  const { savedProfiles, removeSavedProfile } = useConnections();
  const sorted = [...savedProfiles].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase();

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
          Profiles you saved without sending a request
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {sorted.map((saved, i) => (
            <motion.div
              key={saved.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                <span className="text-foreground text-sm font-semibold">
                  {getInitials(saved.user.name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {saved.user.name}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {saved.user.headline}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Saved {format(saved.savedAt, 'MMM d')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => removeSavedProfile(saved.id)}
                title="Remove"
              >
                <Trash2 size={16} />
              </Button>
            </motion.div>
          ))}
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-8 flex-1 flex flex-col justify-center">
            <p className="text-muted-foreground">No saved profiles</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap &quot;Save Profile&quot; when viewing someone on the radar
            </p>
          </div>
        )}
        </motion.div>
      </div>
    </div>
  );
};

export default SavedProfilesPage;
