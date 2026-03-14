/**
 * All auth interactions go through the backend — never directly to LinkedIn.
 *
 * The mobile app:
 *  1. Opens the backend /auth/linkedin/start URL in Capacitor Browser.
 *  2. Backend handles LinkedIn OAuth and redirects to profileglide://auth?token=JWT
 *  3. The app receives the deep link, extracts the token, and stores it here.
 */

const TOKEN_KEY = 'pg_session_token';
const USER_KEY = 'pg_user';
export const LOGGED_OUT_FLAG = 'pg_just_logged_out';

const rawBackendUrl: string = import.meta.env.VITE_BACKEND_URL || '';

if (!rawBackendUrl || rawBackendUrl.includes('YOUR_MAC_LAN_IP')) {
  console.error(
    '[ProfileGlide] VITE_BACKEND_URL is not set.\n' +
    'Edit .env and set it to your Mac\'s LAN IP, e.g.:\n' +
    '  VITE_BACKEND_URL=http://192.168.1.42:3001\n' +
    'Then run: npm run build && LANG=en_US.UTF-8 npx cap sync ios'
  );
}

export const BACKEND_URL = rawBackendUrl.replace(/\/$/, '');

export const LINKEDIN_AUTH_URL = `${BACKEND_URL}/auth/linkedin/start`;
/** Use after logout to force LinkedIn to show login form (no auto-login). */
export const LINKEDIN_AUTH_URL_FORCE_LOGIN = `${BACKEND_URL}/auth/linkedin/start?force_login=1`;

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
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

/** Persist session to localStorage */
export function saveSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

/** Load session from localStorage */
export function loadSession(): AuthSession | null {
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

/** Remove session from localStorage */
export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Parse a profileglide://auth deep link URL and return token or error.
 * Expected formats:
 *   profileglide://auth?token=<jwt>
 *   profileglide://auth?error=<message>
 */
export function parseDeepLink(url: string): { token: string } | { error: string } | null {
  try {
    // Replace the custom scheme with https so URL can be parsed normally
    const normalized = url.replace(/^profileglide:\/\//, 'https://profileglide/');
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
 * Decode the JWT payload (without verification — verification is backend's job).
 * Used client-side only to extract the user object from a stored token.
 */
export function decodeToken(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.user as AuthUser;
  } catch {
    return null;
  }
}
