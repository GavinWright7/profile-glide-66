import { motion } from 'framer-motion';
import { Shield, Eye, Linkedin, LogOut, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
  const [discoverable, setDiscoverable] = useState(true);
  const [showCompany, setShowCompany] = useState(true);
  const [showHeadline, setShowHeadline] = useState(true);
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen p-6 pb-24 max-w-md mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* Profile section */}
        <div className="glass-card p-4 flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold">YN</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Your Name</h3>
            <p className="text-xs text-muted-foreground">Software Engineer</p>
          </div>
          <Linkedin size={18} className="text-linkedin" />
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
          onClick={() => navigate('/login')}
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
