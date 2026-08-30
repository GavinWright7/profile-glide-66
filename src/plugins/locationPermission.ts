import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

export type LocationAuthStatus =
  | 'notDetermined'
  | 'restricted'
  | 'denied'
  | 'authorizedWhenInUse'
  | 'authorizedAlways'
  | 'unknown';

export interface LocationPermissionPlugin {
  getStatus(): Promise<{ status: LocationAuthStatus }>;
  requestWhenInUse(): Promise<{ status: LocationAuthStatus }>;
  requestAlways(): Promise<{ status: LocationAuthStatus }>;
  openSettings(): Promise<void>;
}

const LocationPermission = registerPlugin<LocationPermissionPlugin>('LocationPermission', {
  web: {
    async getStatus() {
      return { status: 'authorizedWhenInUse' };
    },
    async requestWhenInUse() {
      return { status: 'authorizedWhenInUse' };
    },
    async requestAlways() {
      return { status: 'authorizedWhenInUse' };
    },
    async openSettings() {},
  },
});

export const ALWAYS_LOCATION_LATER_KEY = 'pg_always_location_later';
export const ALWAYS_LOCATION_REQUESTED_KEY = 'pg_always_location_requested';

export async function getLocationAuthStatus(): Promise<LocationAuthStatus> {
  if (!Capacitor.isNativePlatform()) return 'authorizedWhenInUse';
  try {
    const { status } = await LocationPermission.getStatus();
    return status;
  } catch {
    return 'unknown';
  }
}

export async function requestWhenInUseLocation(): Promise<LocationAuthStatus> {
  if (!Capacitor.isNativePlatform()) return 'authorizedWhenInUse';
  const { status } = await LocationPermission.requestWhenInUse();
  return status;
}

export async function requestAlwaysLocation(): Promise<LocationAuthStatus> {
  if (!Capacitor.isNativePlatform()) return 'authorizedWhenInUse';
  markAlwaysLocationRequested();
  const { status } = await LocationPermission.requestAlways();
  return status;
}

export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocationPermission.openSettings();
}

export function markAlwaysLocationLater(): void {
  try {
    localStorage.setItem(ALWAYS_LOCATION_LATER_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function markAlwaysLocationRequested(): void {
  try {
    localStorage.setItem(ALWAYS_LOCATION_REQUESTED_KEY, 'true');
  } catch {
    /* ignore */
  }
}

export function hasRequestedAlwaysLocation(): boolean {
  try {
    return localStorage.getItem(ALWAYS_LOCATION_REQUESTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function hasDeferredAlwaysLocation(): boolean {
  try {
    return localStorage.getItem(ALWAYS_LOCATION_LATER_KEY) !== null;
  } catch {
    return false;
  }
}

export function isAlwaysAuthorized(status: LocationAuthStatus): boolean {
  return status === 'authorizedAlways';
}

export function hasUsableLocation(status: LocationAuthStatus): boolean {
  return status === 'authorizedAlways' || status === 'authorizedWhenInUse';
}
