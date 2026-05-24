/**
 * Development-only cold-start reset for native (Xcode / Simulator) workflows.
 *
 * Production / TestFlight / App Store: disabled unless you build without the flag
 * (use `npm run build:ios:prod`).
 *
 * Enabled when `VITE_DEV_RESET_ON_LAUNCH=true` is set at **build time** (see `npm run build:ios`).
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { clearSession } from '@/auth/authService';
import { forceHaltSharingLoops } from '@/utils/sharing';

export function isDevelopmentResetEnabled(): boolean {
  return import.meta.env.VITE_DEV_RESET_ON_LAUNCH === 'true';
}

/**
 * Wipe local session, preferences, Web storage, and sharing timers so the app
 * opens on the LinkedIn landing screen. No-op in production or on web (unless
 * you explicitly enable the env flag on web, which this project does not).
 */
export async function runDevelopmentResetIfNeeded(): Promise<void> {
  if (!isDevelopmentResetEnabled()) return;
  if (!Capacitor.isNativePlatform()) return;

  console.log('[DEV RESET] Clearing auth/session state');

  try {
    forceHaltSharingLoops();
  } catch {
    /* ignore */
  }

  try {
    await clearSession();
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
  } catch {
    /* ignore */
  }

  console.log('[DEV RESET] Reset complete');
}
