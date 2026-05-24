/**
 * Development-only cold-start reset for native (Xcode / Simulator) workflows.
 *
 * Enabled when ANY of:
 * - `VITE_DEV_RESET_ON_LAUNCH=true` at build time (`npm run build:ios`)
 * - Vite dev bundle (`import.meta.env.DEV`) on native
 * - iOS `#if DEBUG` launch flag written by AppDelegate (`__airlinks_debug_reset`)
 *
 * Production / TestFlight / App Store: disabled (Release builds skip native flag).
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { clearSession } from '@/auth/authService';
import { forceHaltSharingLoops } from '@/utils/sharing';

/** Set by AppDelegate on DEBUG launches only — read before wipe. */
const NATIVE_DEBUG_FLAG_KEY = '__airlinks_debug_reset';

/** Known app storage keys (also cleared via localStorage.clear()). */
export const DEV_RESET_STORAGE_KEYS = [
  'auth_session',
  'pg_demo_mode',
  'pg_token',
  'pg_user',
  'pg_just_logged_out',
  'pg_sharing_on',
  'pg_bg_sharing',
  'pg_sharing_user',
  'pg_sharing_token',
  'pg_connections',
  'pg_saved_profiles',
  'pg_demo_connections',
  'pg_demo_saved_profiles',
] as const;

export function isDevelopmentResetEnabled(): boolean {
  if (import.meta.env.VITE_DEV_RESET_ON_LAUNCH === 'true') return true;
  if (import.meta.env.DEV && Capacitor.isNativePlatform()) return true;
  return false;
}

async function isNativeDebugLaunch(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { value } = await Preferences.get({ key: NATIVE_DEBUG_FLAG_KEY });
    return value === '1';
  } catch {
    return false;
  }
}

/** True when automatic or manual dev reset is allowed on this build/device. */
export async function isDevResetAvailable(): Promise<boolean> {
  if (isDevelopmentResetEnabled()) return true;
  return isNativeDebugLaunch();
}

/**
 * Wipe all local session, preferences, Web storage, and sharing timers.
 */
export async function resetDevState(): Promise<void> {
  console.log('[DEV RESET] Clearing app state');

  try {
    forceHaltSharingLoops();
  } catch {
    /* ignore */
  }

  try {
    await clearSession();
    console.log('[DEV RESET] Auth token removed');
  } catch {
    /* ignore */
  }

  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    await Preferences.clear();
    console.log('[DEV RESET] Preferences cleared');
  } catch {
    /* ignore */
  }

  try {
    await Preferences.remove({ key: NATIVE_DEBUG_FLAG_KEY });
  } catch {
    /* ignore */
  }

  console.log('[DEV RESET] Fresh launch enabled');
}

/**
 * Run once at cold start before React mounts.
 * Returns true when a reset ran.
 */
export async function runDevelopmentResetIfNeeded(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const nativeDebug = await isNativeDebugLaunch();
  const enabled = isDevelopmentResetEnabled() || nativeDebug;
  if (!enabled) return false;

  await resetDevState();
  return true;
}
