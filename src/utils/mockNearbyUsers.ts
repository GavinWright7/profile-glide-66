/**
 * Location fallback utilities. Mock nearby users removed for production.
 */

/** Fallback center when location unavailable (e.g. for Find Person radar). */
const FALLBACK_CENTER = { lat: 37.7749, lng: -122.4194 };

/** Get center for radar/map; uses fallback when location is null. */
export function getMockCenter(
  currentLocation: { lat: number; lng: number } | null
): { lat: number; lng: number } {
  if (currentLocation) return currentLocation;
  return FALLBACK_CENTER;
}
