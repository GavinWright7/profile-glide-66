import { motion } from 'framer-motion';
import { NearbyUser } from '@/data/mockUsers';
import { X, Linkedin, Share2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProfileCardProps {
  user: NearbyUser;
  onClose: () => void;
  onConnect: (user: NearbyUser) => void;
}

const ProfileCard = ({ user, onClose, onConnect }: ProfileCardProps) => {
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase();

  const handleConnect = () => {
    window.open(user.linkedinProfileUrl, '_blank');
    onConnect(user);
  };

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
          <div className="w-20 h-20 rounded-full bg-secondary border-2 border-primary/30 flex items-center justify-center mb-4 glow-ring">
            <span className="text-foreground text-xl font-bold">{getInitials(user.name)}</span>
          </div>

          <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{user.headline}</p>

          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
              {user.company}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">{user.distance}m away</span>
          </div>

          <div className="w-full mt-6 space-y-3">
            <Button
              className="w-full bg-linkedin hover:bg-linkedin/90 text-linkedin-foreground font-semibold gap-2"
              onClick={handleConnect}
            >
              <Linkedin size={18} />
              Connect on LinkedIn
            </Button>

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
