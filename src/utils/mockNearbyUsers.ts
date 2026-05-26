/**
 * Location utilities. Mock nearby users removed for production.
 */

/** Radar/map center — null when real GPS is unavailable (never use a hardcoded fallback). */
export function getMockCenter(
  currentLocation: { lat: number; lng: number } | null
): { lat: number; lng: number } | null {
  return currentLocation;
}
