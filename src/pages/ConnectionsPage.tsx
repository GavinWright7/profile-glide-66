import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useConnections } from '../context/ConnectionsContext';
import { Button } from '@/components/ui/button';

const ConnectionsPage = () => {
  const { connections, removeConnection } = useConnections();
  const connected = connections.filter((c) => c.status === 'connected');

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase();

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col min-w-0 px-[var(--page-padding-x)] pb-20 max-w-md mx-auto w-full">
        <motion.div className="flex flex-col flex-1 min-h-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground shrink-0">Connections</h1>
        <p className="text-sm text-muted-foreground mb-4 shrink-0">
          People who accepted your request on LinkedIn
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {connected.map((conn, i) => (
            <motion.div
              key={conn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                <span className="text-foreground text-sm font-semibold">
                  {getInitials(conn.user.name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {conn.user.name}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {conn.user.headline}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => removeConnection(conn.id)}
                title="Remove"
              >
                <Trash2 size={16} />
              </Button>
            </motion.div>
          ))}
        </div>

        {connected.length === 0 && (
          <div className="text-center py-8 flex-1 flex flex-col justify-center">
            <p className="text-muted-foreground">No confirmed connections yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Swipe right in History to confirm when someone accepts
            </p>
          </div>
        )}
        </motion.div>
      </div>
    </div>
  );
};

export default ConnectionsPage;
