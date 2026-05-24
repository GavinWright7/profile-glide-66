import { useLocation, useNavigate } from 'react-router-dom';
import { Radar, Users, History, Settings, Home, User } from 'lucide-react';
import { useSharing } from '../hooks/useSharing';
import { swipeDirectionRef } from '@/utils/tabNavigation';

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/radar', icon: Radar, label: 'Discover', showBadgeWhenSharing: true },
  { path: '/connections', icon: Users, label: 'Connections' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sharing = useSharing();

  if (location.pathname === '/login') return null;
  if (location.pathname.startsWith('/onboarding')) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-xl"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex justify-around items-center h-12 max-w-md mx-auto px-2 pt-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const showBadge = tab.showBadgeWhenSharing && sharing.isSharing && !isActive;
          return (
            <button
              key={tab.path}
              onClick={() => {
                swipeDirectionRef.current = 0;
                navigate(tab.path);
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors relative min-w-[56px] ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="relative inline-block">
                <tab.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
                )}
              </span>
              <span className="text-[9px] font-medium leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
