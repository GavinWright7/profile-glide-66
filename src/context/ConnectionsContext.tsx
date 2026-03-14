import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { NearbyUser } from '@/data/mockUsers';

export type ConnectionStatus = 'pending' | 'connected';

export interface ConnectionEntry {
  id: string;
  user: NearbyUser;
  status: ConnectionStatus;
  requestedAt: Date;
  lat?: number;
  lng?: number;
}

export interface SavedProfile {
  id: string;
  user: NearbyUser;
  savedAt: Date;
}

const STORAGE_KEY = 'pg_connections';
const SAVED_KEY = 'pg_saved_profiles';

function loadConnections(): ConnectionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (parsed as ConnectionEntry[]).map((c) => ({
      ...c,
      requestedAt: new Date(c.requestedAt),
    }));
  } catch {
    return [];
  }
}

function loadSavedProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (parsed as SavedProfile[]).map((s) => ({
      ...s,
      savedAt: new Date(s.savedAt),
    }));
  } catch {
    return [];
  }
}

function saveConnections(list: ConnectionEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function saveSavedProfiles(list: SavedProfile[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface ConnectionsContextValue {
  connections: ConnectionEntry[];
  savedProfiles: SavedProfile[];
  addConnection: (user: NearbyUser, status?: ConnectionStatus, lat?: number, lng?: number) => void;
  updateStatus: (id: string, status: ConnectionStatus) => void;
  removeConnection: (id: string) => void;
  addSavedProfile: (user: NearbyUser) => void;
  removeSavedProfile: (id: string) => void;
}

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<ConnectionEntry[]>(loadConnections);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(loadSavedProfiles);

  useEffect(() => {
    saveConnections(connections);
  }, [connections]);

  useEffect(() => {
    saveSavedProfiles(savedProfiles);
  }, [savedProfiles]);

  const addConnection = useCallback(
    (user: NearbyUser, status: ConnectionStatus = 'pending', lat?: number, lng?: number) => {
      const id = `conn_${Date.now()}_${user.id}`;
      setConnections((prev) => {
        if (prev.some((c) => c.user.id === user.id && c.status === 'pending')) return prev;
        return [
          ...prev,
          { id, user, status, requestedAt: new Date(), lat, lng },
        ];
      });
    },
    []
  );

  const updateStatus = useCallback((id: string, status: ConnectionStatus) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  }, []);

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addSavedProfile = useCallback((user: NearbyUser) => {
    const id = `saved_${Date.now()}_${user.id}`;
    setSavedProfiles((prev) => {
      if (prev.some((s) => s.user.id === user.id)) return prev;
      return [...prev, { id, user, savedAt: new Date() }];
    });
  }, []);

  const removeSavedProfile = useCallback((id: string) => {
    setSavedProfiles((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <ConnectionsContext.Provider
      value={{
        connections,
        savedProfiles,
        addConnection,
        updateStatus,
        removeConnection,
        addSavedProfile,
        removeSavedProfile,
      }}
    >
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections() {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) throw new Error('useConnections must be used inside ConnectionsProvider');
  return ctx;
}
