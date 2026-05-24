/**
 * Centralized authenticated API client.
 * Single source for all protected backend requests.
 *
 * - Reads token fresh from storage before each request (no stale closures)
 * - Checks JWT exp client-side before sending (proactive expiry handling)
 * - Attaches Authorization header automatically
 * - Handles 401 in one place: clears session, dispatches auth:401, redirects
 */

import {
  BACKEND_URL,
  getStoredToken,
  isTokenExpired,
  isDemoToken,
  AUTH_401_EVENT,
  authLog,
} from '../auth/authService';

const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please log in again.';

function buildUrl(path: string): string {
  const base = BACKEND_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Trigger session invalidation: clear storage, dispatch event.
 * Caller (AuthContext) listens and updates state.
 */
function triggerSessionExpired(reason: string): void {
  authLog('session expired', reason);
  window.dispatchEvent(new CustomEvent(AUTH_401_EVENT, { detail: { message: SESSION_EXPIRED_MESSAGE } }));
}

/**
 * Get a valid token for an authenticated request.
 * Returns null if no token, demo token (callers must skip backend for demo users), or expired.
 * If expired, triggers session expired and returns null.
 */
function getValidToken(): string | null {
  const token = getStoredToken();
  if (!token) return null;
  if (isDemoToken(token)) return null; // Demo users must not hit protected endpoints
  if (isTokenExpired(token)) {
    triggerSessionExpired('token exp checked client-side');
    return null;
  }
  return token;
}

export interface ApiRequestInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** If true, skip token attachment (for public endpoints called from components that have token) */
  skipAuth?: boolean;
}

/**
 * Make an authenticated request to the backend.
 * - Gets token fresh from storage
 * - Checks exp before sending
 * - Adds Authorization: Bearer <token>
 * - On 401: triggers session expired, does not throw (returns response for caller to handle)
 */
export async function apiRequest(
  path: string,
  init: ApiRequestInit = {}
): Promise<Response> {
  const { skipAuth = false, headers = {}, ...rest } = init;

  const url = path.startsWith('http') ? path : buildUrl(path);
  const token = skipAuth ? null : getValidToken();

  if (!skipAuth && !token) {
    console.debug('[Auth] apiRequest skipped: no valid token', path);
    return new Response(JSON.stringify({ error: 'No token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeaders: Record<string, string> = { ...headers };
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: authHeaders,
  });

  if (res.status === 401) {
    authLog('401 received', path);
    triggerSessionExpired('backend returned 401');
  }

  return res;
}

/** GET with JSON response */
export async function apiGet<T = unknown>(path: string, params?: Record<string, string>): Promise<Response> {
  const url = params && Object.keys(params).length > 0
    ? `${buildUrl(path)}?${new URLSearchParams(params).toString()}`
    : buildUrl(path);
  return apiRequest(url, { method: 'GET' });
}

/** POST with JSON body */
export async function apiPost(path: string, body: object): Promise<Response> {
  return apiRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** PUT with JSON body */
export async function apiPut(path: string, body: object): Promise<Response> {
  return apiRequest(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** PATCH with JSON body */
export async function apiPatch(path: string, body: object): Promise<Response> {
  return apiRequest(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export { SESSION_EXPIRED_MESSAGE };
