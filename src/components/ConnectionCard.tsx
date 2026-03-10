import { Connection } from '@/data/mockUsers';
import { Linkedin, Check, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionCardProps {
  connection: Connection;
}

const ConnectionCard = ({ connection }: ConnectionCardProps) => {
  const { user, connectedAt, status } = connection;
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
        <span className="text-foreground text-sm font-semibold">{getInitials(user.name)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">{user.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{user.headline}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(connectedAt, { addSuffix: true })}
        </p>
      </div>
      <div className="shrink-0">
        {status === 'connected' ? (
          <div className="flex items-center gap-1 text-success text-xs font-medium">
            <Check size={14} />
            Connected
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Clock size={14} />
            Pending
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionCard;
