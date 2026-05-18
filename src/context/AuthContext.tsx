import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import {
  AuthUser,
  AuthSession,
  loadSessionAsync,
  saveSession,
  saveDemoSession,
  clearSession,
  parseDeepLink,
  decodeToken,
  isTokenStructurallyValid,
  isTokenExpired,
  isDemoToken,
  APPLE_TESTER_USER,
  APPLE_TESTER_USER_ID,
  LINKEDIN_AUTH_URL,
  LINKEDIN_AUTH_URL_FORCE_LOGIN,
  LOGGED_OUT_FLAG,
  AUTH_401_EVENT,
  authLog,
  BACKEND_URL,
} from '../auth/authService';
import { SESSION_EXPIRED_MESSAGE } from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True until boot validation completes — prevents protected requests from firing early */
  isLoading: boolean;
  /** True when auth is fully resolved (validated or confirmed logged out) */
  isAuthReady: boolean;
  isDemoUser: boolean;
  loginWithLinkedIn: (forceReauth?: boolean) => Promise<void>;
  loginAsAppleTester: () => void;
  logout: () => void;
  updateSession: (session: AuthSession) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Validate stored session with backend. Returns validated user or null. */
async function validateSessionWithBackend(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Boot: restore and validate session before marking authenticated
  useEffect(() => {
    let cancelled = false;

    async function bootAuth() {
      const session = await loadSessionAsync();

      if (!session) {
        authLog('boot: no session');
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
          setIsAuthReady(true);
        }
        return;
      }

      const { token: storedToken, user: storedUser } = session;

      // Demo: no backend validation needed
      if (isDemoToken(storedToken)) {
        authLog('boot: demo session restored');
        if (!cancelled) {
          setToken(storedToken);
          setUser(storedUser);
          setIsLoading(false);
          setIsAuthReady(true);
        }
        return;
      }

      // Validate structure
      if (!isTokenStructurallyValid(storedToken)) {
        authLog('boot: token structurally invalid, clearing');
        await clearSession();
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
          setIsAuthReady(true);
        }
        return;
      }

      // Check expiry client-side
      if (isTokenExpired(storedToken)) {
        authLog('boot: token expired, clearing');
        await clearSession();
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
          setIsAuthReady(true);
        }
        return;
      }

      // Validate with backend
      const validatedUser = await validateSessionWithBackend(storedToken);
      if (cancelled) return;

      if (!validatedUser) {
        authLog('boot: backend validation failed, clearing');
        await clearSession();
        setToken(null);
        setUser(null);
        setIsLoading(false);
        setIsAuthReady(true);
        return;
      }

      authLog('boot: session validated', validatedUser.id);
      setToken(storedToken);
      setUser(validatedUser);
      setIsLoading(false);
      setIsAuthReady(true);
    }

    bootAuth();
    return () => { cancelled = true; };
  }, []);

  // When any API returns 401 or token expired client-side
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>)?.detail;
      const message = detail?.message ?? SESSION_EXPIRED_MESSAGE;
      authLog('logout triggered by 401/expired');
      void (async () => {
        await clearSession();
      })();
      setToken(null);
      setUser(null);
      toast.error(message, { duration: 4000 });
    };
    window.addEventListener(AUTH_401_EVENT, handler);
    return () => window.removeEventListener(AUTH_401_EVENT, handler);
  }, []);

  // Deep link: LinkedIn auth callback
  useEffect(() => {
    const listenerPromise = App.addListener('appUrlOpen', async (event) => {
      const url: string = event.url;

      if (!url.startsWith('airlinks://auth')) return;

      authLog('callback received', url.startsWith('airlinks://auth?token=') ? 'token' : url.startsWith('airlinks://auth?error=') ? 'error' : 'unknown');
      const result = parseDeepLink(url);

      await Browser.close().catch(() => {});

      if (!result) {
        authLog('deep link: parse returned null');
        return;
      }

      if ('error' in result) {
        authLog('deep link error', result.error);
        return;
      }

      const { token: newToken } = result;
      const decodedUser = decodeToken(newToken);

      if (!decodedUser) {
        authLog('deep link: failed to decode JWT');
        return;
      }

      if (!isTokenStructurallyValid(newToken)) {
        authLog('deep link: token structurally invalid');
        return;
      }

      authLog('login success (deep link)');
      const session: AuthSession = { token: newToken, user: decodedUser };
      saveSession(session);
      setToken(newToken);
      setUser(decodedUser);
    });

    return () => {
      listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  const loginAsAppleTester = useCallback(() => {
    authLog('login: Apple Tester');
    saveDemoSession();
    setToken('demo-token');
    setUser(APPLE_TESTER_USER);
  }, []);

  const loginWithLinkedIn = useCallback(async (forceReauth = false) => {
    let url = LINKEDIN_AUTH_URL;
    try {
      if (forceReauth || sessionStorage.getItem(LOGGED_OUT_FLAG) === '1') {
        url = LINKEDIN_AUTH_URL_FORCE_LOGIN;
        sessionStorage.removeItem(LOGGED_OUT_FLAG);
      }
    } catch {
      /* ignore */
    }
    authLog('opening LinkedIn auth', url);
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
    } else {
      window.location.href = url;
    }
  }, []);

  const logout = useCallback(() => {
    authLog('logout');
    void (async () => {
      await clearSession();
    })();
    setToken(null);
    setUser(null);
  }, []);

  const updateSession = useCallback((session: AuthSession) => {
    authLog('session updated');
    saveSession(session);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const isDemoUser = !!user && user.id === APPLE_TESTER_USER_ID;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        isAuthReady,
        isDemoUser,
        loginWithLinkedIn,
        loginAsAppleTester,
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
