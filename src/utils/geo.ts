/**
 * Geographic bearing and direction utilities for the directional arrow feature.
 * Uses the haversine formula for bearing calculation.
 */

/** Distance between two points in meters (haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Bearing from point A to point B in degrees (0–360). North = 0, East = 90. */
export function bearingDegrees(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const fromLatRad = toRad(fromLat);
  const fromLngRad = toRad(fromLng);
  const toLatRad = toRad(toLat);
  const toLngRad = toRad(toLng);

  const dLng = toLngRad - fromLngRad;
  const y = Math.sin(dLng) * Math.cos(toLatRad);
  const x =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(dLng);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;
  return bearing;
}

/**
 * Relative angle for arrow rotation: how the arrow should point relative to the phone.
 * phoneHeading = direction the phone is facing (0–360, north = 0).
 * targetBearing = bearing from user to target (0–360).
 * Returns: angle in degrees for CSS transform rotate(). 0 = arrow points straight ahead.
 */
export function relativeArrowAngle(phoneHeading: number, targetBearing: number): number {
  let rel = targetBearing - phoneHeading;
  while (rel > 180) rel -= 360;
  while (rel < -180) rel += 360;
  return rel;
}

/**
 * Move point A toward point B by a fraction (0–1). Used for simulated approach.
 * fraction 0.05 = move 5% of the way toward B.
 */
export function interpolateToward(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  fraction: number
): { lat: number; lng: number } {
  return {
    lat: fromLat + (toLat - fromLat) * fraction,
    lng: fromLng + (toLng - fromLng) * fraction,
  };
}
