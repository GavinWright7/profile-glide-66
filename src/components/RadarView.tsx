import { motion, AnimatePresence } from 'framer-motion';
import { NearbyUser } from '@/data/mockUsers';

interface RadarViewProps {
  users: NearbyUser[];
  isScanning: boolean;
  onUserTap: (user: NearbyUser) => void;
}

const RadarView = ({ users, isScanning, onUserTap }: RadarViewProps) => {
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase();

  const getUserPosition = (user: NearbyUser) => {
    const maxRadius = 38; // % from center
    const minRadius = 15;
    const normalizedDist = Math.min(user.distance / 10, 1);
    const radius = minRadius + normalizedDist * (maxRadius - minRadius);
    const rad = (user.angle * Math.PI) / 180;
    return {
      left: `${50 + radius * Math.cos(rad)}%`,
      top: `${50 + radius * Math.sin(rad)}%`,
    };
  };

  return (
    <div className="relative w-full aspect-square max-w-[380px] mx-auto">
      {/* Radar rings */}
      {[1, 2, 3].map((ring) => (
        <div
          key={ring}
          className="absolute rounded-full border border-primary/10"
          style={{
            width: `${ring * 33}%`,
            height: `${ring * 33}%`,
            left: `${50 - (ring * 33) / 2}%`,
            top: `${50 - (ring * 33) / 2}%`,
          }}
        />
      ))}

      {/* Pulse rings when scanning */}
      {isScanning && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`pulse-${i}`}
              className="absolute rounded-full border-2 border-primary/30"
              style={{ width: '100%', height: '100%', left: 0, top: 0 }}
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 1,
                ease: 'easeOut',
              }}
            />
          ))}
        </>
      )}

      {/* Sweep line */}
      {isScanning && (
        <motion.div
          className="absolute w-1/2 h-[2px] origin-left"
          style={{
            left: '50%',
            top: '50%',
            background: 'linear-gradient(90deg, hsl(var(--primary) / 0.6), transparent)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Center dot (you) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center glow-ring">
          <span className="text-primary-foreground text-sm font-semibold">You</span>
        </div>
      </div>

      {/* Nearby users */}
      <AnimatePresence>
        {isScanning &&
          users.map((user, index) => {
            const pos = getUserPosition(user);
            return (
              <motion.button
                key={user.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                style={{ left: pos.left, top: pos.top }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: 0.5 + index * 0.3, type: 'spring', stiffness: 200 }}
                onClick={() => onUserTap(user)}
              >
                <motion.div
                  className="flex flex-col items-center gap-1"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.5 + index * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="w-11 h-11 rounded-full bg-secondary border-2 border-primary/40 flex items-center justify-center group-hover:border-primary transition-colors glow-ring">
                    <span className="text-foreground text-[11px] font-semibold">
                      {getInitials(user.name)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium max-w-[64px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                </motion.div>
              </motion.button>
            );
          })}
      </AnimatePresence>
    </div>
  );
};

export default RadarView;
