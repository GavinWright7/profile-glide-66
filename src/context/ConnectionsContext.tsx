import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { NearbyUser } from '@/data/mockUsers';
import { useAuth } from './AuthContext';
import { apiGet, apiPost, apiRequest } from '@/api/client';

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
  /** Row id from API or local id for demo */
  id: string;
  targetUserId: string;
  user: NearbyUser;
  savedAt: Date;
}

const STORAGE_KEY = 'pg_connections';
const SAVED_KEY = 'pg_saved_profiles';
const DEMO_STORAGE_KEY = 'pg_demo_connections';
const DEMO_SAVED_KEY = 'pg_demo_saved_profiles';

function loadConnections(isDemo: boolean): ConnectionEntry[] {
  const key = isDemo ? DEMO_STORAGE_KEY : STORAGE_KEY;
  try {
    const raw = localStorage.getItem(key);
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

function loadSavedProfilesLocal(isDemo: boolean): SavedProfile[] {
  const key = isDemo ? DEMO_SAVED_KEY : SAVED_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (parsed as SavedProfile[]).map((s) => ({
      ...s,
      targetUserId: s.targetUserId ?? s.user?.id ?? '',
      savedAt: new Date(s.savedAt),
    }));
  } catch {
    return [];
  }
}

function saveConnections(list: ConnectionEntry[], isDemo: boolean) {
  try {
    localStorage.setItem(isDemo ? DEMO_STORAGE_KEY : STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function saveSavedProfilesLocal(list: SavedProfile[], isDemo: boolean) {
  try {
    localStorage.setItem(isDemo ? DEMO_SAVED_KEY : SAVED_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function apiProfileToNearbyUser(p: {
  targetUserId: string;
  name: string;
  picture: string;
  headline: string;
  linkedinUrl: string;
  career: string;
  bio: string;
}): NearbyUser {
  const parts = p.headline?.split(' at ') ?? [];
  return {
    id: p.targetUserId,
    name: p.name || 'Unknown',
    headline: p.headline || '',
    company: parts[1]?.trim() ?? '',
    jobTitle: parts[0]?.trim() ?? '',
    profilePhotoUrl: p.picture || '',
    linkedinProfileUrl: p.linkedinUrl || '',
    linkedinId: p.targetUserId,
    distance: 0,
    angle: 0,
    bio: p.bio || '',
    career: p.career || '',
  };
}

interface ConnectionsContextValue {
  connections: ConnectionEntry[];
  savedProfiles: SavedProfile[];
  savedProfilesLoading: boolean;
  refreshSavedProfiles: () => Promise<void>;
  addConnection: (user: NearbyUser, status?: ConnectionStatus, lat?: number, lng?: number) => void;
  updateStatus: (id: string, status: ConnectionStatus) => void;
  removeConnection: (id: string) => void;
  /** Demo/local + optimistic: merge into list */
  addSavedProfile: (user: NearbyUser) => void;
  /** Server-backed save for discovery; returns messages for toasts */
  saveDiscoveredProfile: (targetUserId: string) => Promise<{ message: string; alreadySaved: boolean }>;
  removeSavedProfile: (entry: SavedProfile) => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const { isDemoUser, token } = useAuth();
  const [connections, setConnections] = useState<ConnectionEntry[]>(() => loadConnections(isDemoUser));
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(() =>
    isDemoUser ? loadSavedProfilesLocal(true) : []
  );
  const [savedProfilesLoading, setSavedProfilesLoading] = useState(false);

  useEffect(() => {
    setConnections(loadConnections(isDemoUser));
    if (isDemoUser) {
      setSavedProfiles(loadSavedProfilesLocal(true));
    }
  }, [isDemoUser]);

  useEffect(() => {
    saveConnections(connections, isDemoUser);
  }, [connections, isDemoUser]);

  useEffect(() => {
    if (isDemoUser) {
      saveSavedProfilesLocal(savedProfiles, true);
    }
  }, [savedProfiles, isDemoUser]);

  const refreshSavedProfiles = useCallback(async () => {
    if (isDemoUser) {
      setSavedProfiles(loadSavedProfilesLocal(true));
      return;
    }
    if (!token) {
      setSavedProfiles([]);
      return;
    }
    setSavedProfilesLoading(true);
    try {
      const res = await apiGet('/saved-profiles');
      const data = (await res.json()) as {
        profiles?: Array<{
          id: string;
          targetUserId: string;
          savedAt: string;
          name: string;
          picture: string;
          headline: string;
          linkedinUrl: string;
          career: string;
          bio: string;
        }>;
      };
      if (!res.ok) return;
      const list: SavedProfile[] = (data.profiles ?? []).map((p) => ({
        id: p.id,
        targetUserId: p.targetUserId,
        savedAt: new Date(p.savedAt),
        user: apiProfileToNearbyUser(p),
      }));
      setSavedProfiles(list);
    } catch {
      /* ignore */
    } finally {
      setSavedProfilesLoading(false);
    }
  }, [isDemoUser, token]);

  useEffect(() => {
    if (!isDemoUser && token) {
      void refreshSavedProfiles();
    }
  }, [isDemoUser, token, refreshSavedProfiles]);

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
      if (prev.some((s) => s.targetUserId === user.id)) return prev;
      return [
        ...prev,
        { id, targetUserId: user.id, user, savedAt: new Date() },
      ];
    });
  }, []);

  const saveDiscoveredProfile = useCallback(
    async (targetUserId: string) => {
      if (isDemoUser) {
        return { message: 'Profile saved.', alreadySaved: false };
      }
      const res = await apiPost(`/saved-profiles/${encodeURIComponent(targetUserId)}`, {});
      const data = (await res.json()) as { message?: string; alreadySaved?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }
      await refreshSavedProfiles();
      return {
        message: data.message || 'Profile saved.',
        alreadySaved: !!data.alreadySaved,
      };
    },
    [isDemoUser, refreshSavedProfiles]
  );

  const removeSavedProfile = useCallback(
    async (entry: SavedProfile) => {
      if (isDemoUser) {
        setSavedProfiles((prev) => prev.filter((s) => s.id !== entry.id));
        return;
      }
      setSavedProfiles((prev) => prev.filter((s) => s.id !== entry.id));
      try {
        const res = await apiRequest(`/saved-profiles/${encodeURIComponent(entry.targetUserId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          await refreshSavedProfiles();
          throw new Error(data.error || 'Failed to remove saved profile');
        }
      } catch (err) {
        await refreshSavedProfiles();
        throw err;
      }
    },
    [isDemoUser, refreshSavedProfiles]
  );

  return (
    <ConnectionsContext.Provider
      value={{
        connections,
        savedProfiles,
        savedProfilesLoading,
        refreshSavedProfiles,
        addConnection,
        updateStatus,
        removeConnection,
        addSavedProfile,
        saveDiscoveredProfile,
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
