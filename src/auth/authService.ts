/**
 * Auth storage and utilities — single source of truth for session persistence.
 *
 * The mobile app:
 *  1. Opens the backend /auth/linkedin/start URL in Capacitor Browser.
 *  2. Backend handles LinkedIn OAuth and redirects to airlinks://auth?token=JWT
 *  3. The app receives the deep link, extracts the token, and stores it here.
 *
 * On Capacitor iOS, localStorage does not persist across restarts; session JSON
 * is stored in @capacitor/preferences and hydrated on boot via loadSessionAsync().
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const SESSION_KEY = 'auth_session';
const DEMO_KEY = 'pg_demo_mode';
const LS_TOKEN = 'pg_token';
const LS_USER = 'pg_user';

export const LOGGED_OUT_FLAG = 'pg_just_logged_out';

/** Demo user ID — used to detect Apple Tester / review mode */
export const APPLE_TESTER_USER_ID = 'apple-tester-demo';

/** Full demo user for Apple App Review — no LinkedIn required */
export const APPLE_TESTER_USER: AuthUser = {
  id: APPLE_TESTER_USER_ID,
  name: 'App Reviewer',
  firstName: 'App',
  lastName: 'Reviewer',
  email: 'reviewer@example.com',
  picture: '',
  headline: 'Apple App Review',
  linkedinUrl: 'https://linkedin.com/in/apple-reviewer',
  bio: '',
  career: 'App Reviewer',
  currentJobTitle: 'App Reviewer',
  currentCompany: 'Apple',
  almaMater: 'Apple University',
  pastCompanies: [],
  graduationYear: '2020',
};

const rawBackendUrl: string = import.meta.env.VITE_BACKEND_URL || '';

// Environment sanity — log at module load (no secrets)
if (rawBackendUrl && !rawBackendUrl.includes('YOUR_MAC_LAN_IP')) {
  console.log('[Auth] BACKEND_URL configured:', rawBackendUrl.startsWith('https') ? 'production' : 'development');
} else if (!rawBackendUrl || rawBackendUrl.includes('YOUR_MAC_LAN_IP')) {
  console.error(
    '[AirLinks] VITE_BACKEND_URL is not set.\n' +
    "Edit .env and set it to your Mac's LAN IP, e.g.:\n" +
    '  VITE_BACKEND_URL=http://192.168.1.42:3001\n' +
    'Then run: npm run build && LANG=en_US.UTF-8 npx cap sync ios'
  );
}

export const BACKEND_URL = rawBackendUrl.replace(/\/$/, '');

/** Native apps must advertise platform=mobile to the backend OAuth start. */
export function buildLinkedInStartUrl(options: { forceReauth?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (options.forceReauth) params.set('force_login', '1');
  if (Capacitor.isNativePlatform()) params.set('platform', 'mobile');
  const q = params.toString();
  return `${BACKEND_URL}/auth/linkedin/start${q ? `?${q}` : ''}`;
}

export const LINKEDIN_AUTH_URL = `${BACKEND_URL}/auth/linkedin/start`;
/** Use after logout to force LinkedIn to show login form (no auto-login). */
export const LINKEDIN_AUTH_URL_FORCE_LOGIN = `${BACKEND_URL}/auth/linkedin/start?force_login=1`;

/** Custom event dispatched when session is invalid — AuthProvider listens and logs out */
export const AUTH_401_EVENT = 'auth:401';

/** Safe debug logging — never logs tokens or secrets */
export function authLog(event: string, detail?: string): void {
  const msg = detail ? `[Auth] ${event}: ${detail}` : `[Auth] ${event}`;
  console.log(msg);
}

export interface AuthUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  picture: string;
  headline: string;
  linkedinUrl: string;
  currentJobTitle?: string;
  currentCompany?: string;
  almaMater?: string;
  pastCompanies?: string[];
  graduationYear?: string;
  bio?: string;
  career?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

/** Check if token is the demo placeholder (not a real JWT) */
export function isDemoToken(token: string): boolean {
  return token === 'demo-token';
}

/**
 * Decode JWT payload without verification (client-side only).
 * Returns null if malformed. Used for exp check and user extraction.
 */
function decodeJwtPayload(token: string): { exp?: number; user?: AuthUser } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if JWT is structurally valid (has payload, can be decoded).
 */
export function isTokenStructurallyValid(token: string): boolean {
  if (isDemoToken(token)) return true;
  const payload = decodeJwtPayload(token);
  return payload !== null && typeof payload === 'object';
}

/**
 * Check if JWT is expired (exp claim in seconds, with 60s buffer).
 */
export function isTokenExpired(token: string): boolean {
  if (isDemoToken(token)) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSec = Math.floor(Date.now() / 1000);
  const bufferSec = 60;
  return payload.exp < nowSec + bufferSec;
}

/**
 * Get token from storage — always reads fresh, no caching.
 * Used by API client before each request.
 */
export function getStoredToken(): string | null {
  if (localStorage.getItem(DEMO_KEY) === '1') {
    return 'demo-token';
  }
  return localStorage.getItem(LS_TOKEN);
}

export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(LS_TOKEN, session.token);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LS_USER, JSON.stringify(session.user));
  } catch {
    /* ignore */
  }
  Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) }).catch(() => {});
}

export async function loadSessionAsync(): Promise<AuthSession | null> {
  try {
    const prefsPromise = Preferences.get({ key: SESSION_KEY });
    const timeoutPromise = new Promise<{ value: null }>((resolve) =>
      setTimeout(() => resolve({ value: null }), 3000)
    );
    const { value } = await Promise.race([prefsPromise, timeoutPromise]);
    if (value) {
      const parsed = JSON.parse(value) as AuthSession;
      if (parsed?.token && parsed?.user) {
        try {
          localStorage.setItem(LS_TOKEN, parsed.token);
          localStorage.setItem(LS_USER, JSON.stringify(parsed.user));
        } catch {
          /* ignore */
        }
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const token = localStorage.getItem(LS_TOKEN);
    const userRaw = localStorage.getItem(LS_USER);
    if (localStorage.getItem(DEMO_KEY) === '1') {
      return { token: 'demo-token', user: APPLE_TESTER_USER };
    }
    if (token && userRaw) {
      return { token, user: JSON.parse(userRaw) as AuthUser };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Sync read from localStorage only (iOS cold WebView often empty until loadSessionAsync runs). */
export function loadSession(): AuthSession | null {
  try {
    if (localStorage.getItem(DEMO_KEY) === '1') {
      return { token: 'demo-token', user: APPLE_TESTER_USER };
    }
    const token = localStorage.getItem(LS_TOKEN);
    const userRaw = localStorage.getItem(LS_USER);
    if (token && userRaw) {
      return { token, user: JSON.parse(userRaw) as AuthUser };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Save demo session (Apple Tester mode) */
export function saveDemoSession(): void {
  try {
    localStorage.setItem(DEMO_KEY, '1');
  } catch {
    /* ignore */
  }
  saveSession({ token: 'demo-token', user: APPLE_TESTER_USER });
}

/** Clear demo session */
export function clearDemoSession(): void {
  try {
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  } catch {
    /* ignore */
  }
  void Preferences.remove({ key: SESSION_KEY });
}

/** Check if current session is demo mode */
export function isDemoSession(): boolean {
  return localStorage.getItem(DEMO_KEY) === '1';
}

export async function clearSession(): Promise<void> {
  const wasDemo = localStorage.getItem(DEMO_KEY) === '1';
  try {
    localStorage.removeItem(LS_TOKEN);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_USER);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
  try {
    await Preferences.remove({ key: SESSION_KEY });
  } catch {
    /* ignore */
  }
  if (wasDemo) {
    try {
      localStorage.removeItem('pg_demo_connections');
      localStorage.removeItem('pg_demo_saved_profiles');
    } catch {
      /* ignore */
    }
  }
}

/**
 * Build airlinks://auth deep link URL safely (canonical pattern for redirects).
 * Uses URLSearchParams for proper encoding; never concatenate raw token/error.
 */
export function buildAuthDeepLink(params: { token?: string; error?: string }): string {
  const target = new URL('airlinks://auth');
  if (params.token) target.searchParams.set('token', String(params.token).trim());
  else if (params.error) target.searchParams.set('error', String(params.error).trim());
  return target.toString();
}

/**
 * Parse a airlinks://auth deep link URL and return token or error.
 */
export function parseDeepLink(url: string): { token: string } | { error: string } | null {
  try {
    const normalized = url.replace(/^airlinks:\/\//, 'https://airlinks/');
    const parsed = new URL(normalized);
    const token = parsed.searchParams.get('token');
    const error = parsed.searchParams.get('error');
    if (token) return { token };
    if (error) return { error };
    return null;
  } catch {
    return null;
  }
}

/**
 * Decode user from JWT payload (client-side only, no verification).
 */
export function decodeToken(token: string): AuthUser | null {
  const payload = decodeJwtPayload(token);
  return payload?.user ?? null;
}
