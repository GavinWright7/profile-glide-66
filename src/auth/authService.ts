/**
 * Auth storage and utilities — single source of truth for session persistence.
 *
 * The mobile app:
 *  1. Opens the backend /auth/linkedin/start URL in Capacitor Browser.
 *  2. Backend handles LinkedIn OAuth and redirects to airlinks://auth?token=JWT
 *  3. The app receives the deep link, extracts the token, and stores it here.
 *
 * Auth state is determined by validated token + backend /auth/me, not just storage.
 */

import { Capacitor } from '@capacitor/core';

const TOKEN_KEY = 'pg_session_token';
const USER_KEY = 'pg_user';
const DEMO_KEY = 'pg_demo_mode';
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
  interests: ['Technology', 'Software', 'Product Management'],
  bio: '',
  career: 'App Reviewer',
  currentJobTitle: 'App Reviewer',
  currentCompany: 'Apple',
  almaMater: 'Apple University',
  pastCompanies: [],
  goals: ['Test apps'],
};

const rawBackendUrl: string = import.meta.env.VITE_BACKEND_URL || '';

// Environment sanity — log at module load (no secrets)
if (rawBackendUrl && !rawBackendUrl.includes('YOUR_MAC_LAN_IP')) {
  console.log('[Auth] BACKEND_URL configured:', rawBackendUrl.startsWith('https') ? 'production' : 'development');
} else if (!rawBackendUrl || rawBackendUrl.includes('YOUR_MAC_LAN_IP')) {
  console.error(
    '[AirLinks] VITE_BACKEND_URL is not set.\n' +
    'Edit .env and set it to your Mac\'s LAN IP, e.g.:\n' +
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
  interests?: string[];
  currentJobTitle?: string;
  currentCompany?: string;
  almaMater?: string;
  pastCompanies?: string[];
  goals?: string[];
  /** In-app profile (Neon profiles table) */
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
  return localStorage.getItem(TOKEN_KEY);
}

/** Persist session to localStorage */
export function saveSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

/** Load raw session from storage — does NOT validate. Use for boot only. */
export function loadSession(): AuthSession | null {
  const isDemo = localStorage.getItem(DEMO_KEY) === '1';
  if (isDemo) {
    return { token: 'demo-token', user: APPLE_TESTER_USER };
  }
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  if (!token || !userRaw) return null;
  try {
    const user: AuthUser = JSON.parse(userRaw);
    return { token, user };
  } catch {
    return null;
  }
}

/** Save demo session (Apple Tester mode) */
export function saveDemoSession(): void {
  localStorage.setItem(DEMO_KEY, '1');
  localStorage.setItem(TOKEN_KEY, 'demo-token');
  localStorage.setItem(USER_KEY, JSON.stringify(APPLE_TESTER_USER));
}

/** Clear demo session */
export function clearDemoSession(): void {
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Check if current session is demo mode */
export function isDemoSession(): boolean {
  return localStorage.getItem(DEMO_KEY) === '1';
}

/** Remove session from localStorage */
export function clearSession(): void {
  const wasDemo = localStorage.getItem(DEMO_KEY) === '1';
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (wasDemo) {
    try {
      localStorage.removeItem('pg_demo_connections');
      localStorage.removeItem('pg_demo_saved_profiles');
    } catch { /* ignore */ }
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
