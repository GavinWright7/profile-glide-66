import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import {
  AuthUser,
  AuthSession,
  loadSession,
  saveSession,
  clearSession,
  parseDeepLink,
  decodeToken,
  LINKEDIN_AUTH_URL,
  LINKEDIN_AUTH_URL_FRESH,
} from '../auth/authService';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithLinkedIn: (forceAccountChoice?: boolean) => Promise<void>;
  logout: () => void;
  updateSession: (session: AuthSession) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate session from storage on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setToken(session.token);
      setUser(session.user);
    }
    setIsLoading(false);
  }, []);

  // Listen for the deep link callback that carries the JWT
  useEffect(() => {
    const listenerPromise = App.addListener('appUrlOpen', async (event) => {
      const url: string = event.url;

      if (!url.startsWith('profileglide://auth')) return;

      const result = parseDeepLink(url);

      // Close the in-app browser regardless of outcome
      await Browser.close().catch(() => {});

      if (!result) return;

      if ('error' in result) {
        console.error('LinkedIn auth error from deep link:', result.error);
        return;
      }

      const { token: newToken } = result;
      const decodedUser = decodeToken(newToken);

      if (!decodedUser) {
        console.error('Failed to decode JWT from deep link');
        return;
      }

      const session: AuthSession = { token: newToken, user: decodedUser };
      saveSession(session);
      setToken(newToken);
      setUser(decodedUser);
    });

    return () => {
      listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  const loginWithLinkedIn = useCallback(async (forceAccountChoice = false) => {
    const url = forceAccountChoice ? LINKEDIN_AUTH_URL_FRESH : LINKEDIN_AUTH_URL;
    if (Capacitor.isNativePlatform()) {
      // iOS/Android: open LinkedIn in an in-app browser overlay.
      // After auth, LinkedIn redirects to the frontend callback page which
      // triggers the profileglide:// deep link back to the native app.
      await Browser.open({ url });
    } else {
      // Web browser: navigate the current tab directly to the backend start URL.
      // The redirect chain is: backend → LinkedIn → /auth/linkedin/callback
      window.location.href = url;
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const updateSession = useCallback((session: AuthSession) => {
    saveSession(session);
    setToken(session.token);
    setUser(session.user);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        loginWithLinkedIn,
        logout,
        updateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
