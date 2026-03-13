import { useLocation, useNavigate } from 'react-router-dom';
import { Radar, Users, Settings, Home } from 'lucide-react';
import { useSharing } from '../hooks/useSharing';

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/radar', icon: Radar, label: 'Discover', showBadgeWhenSharing: true },
  { path: '/connections', icon: Users, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sharing = useSharing();

  if (location.pathname === '/login') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-surface border-t border-border/50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const showBadge = tab.showBadgeWhenSharing && sharing.isSharing && !isActive;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors relative ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="relative inline-block">
                <tab.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive" />
                )}
              </span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
