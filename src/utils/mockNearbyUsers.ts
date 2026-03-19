/**
 * Mock nearby users for development/testing only.
 * NEVER used in production builds.
 */

import type { NearbyShareUser } from './sharing';
import { distanceMeters } from './geo';

const IS_DEV = import.meta.env.DEV;
const MOCK_EXPLICIT = import.meta.env.VITE_USE_MOCK_NEARBY_USERS === 'true';
const MOCK_DISABLED = import.meta.env.VITE_USE_MOCK_NEARBY_USERS === 'false';

/** Fallback center for mock users when location unavailable. */
const FALLBACK_CENTER = { lat: 37.7749, lng: -122.4194 };

/** Enable mock users when no real users exist. Dev only, or when VITE_USE_MOCK_NEARBY_USERS=true. */
export function shouldUseMockNearbyUsers(realCount: number): boolean {
  if (realCount > 0) return false;
  if (MOCK_DISABLED) return false;
  if (MOCK_EXPLICIT) return true;
  if (IS_DEV) return true;
  return false;
}

/** Get center for mock generation; uses fallback when location is null. */
export function getMockCenter(
  currentLocation: { lat: number; lng: number } | null
): { lat: number; lng: number } {
  if (currentLocation) return currentLocation;
  return FALLBACK_CENTER;
}

const MOCK_PROFILES: Array<{
  fullName: string;
  headline: string;
  interests: string[];
}> = [
  { fullName: 'Sarah Chen', headline: 'Investment Banking Analyst at Goldman Sachs', interests: ['Investment Banking', 'Financial Services'] },
  { fullName: 'Marcus Johnson', headline: 'Startup Founder at TechVentures', interests: ['Venture Capital', 'Technology'] },
  { fullName: 'Emily Rodriguez', headline: 'Software Engineer at Google', interests: ['Software', 'AI/ML'] },
  { fullName: 'David Kim', headline: 'Management Consultant at McKinsey', interests: ['Management', 'Strategy'] },
  { fullName: 'Jessica Walsh', headline: 'Product Manager at Stripe', interests: ['SaaS', 'Fintech'] },
  { fullName: 'James Thompson', headline: 'Venture Partner at a16z', interests: ['Venture Capital', 'Technology'] },
  { fullName: 'Olivia Martinez', headline: 'Healthcare IT Lead at Epic', interests: ['Healthcare IT', 'Technology'] },
  { fullName: 'Ryan O\'Brien', headline: 'Brand Director at Nike', interests: ['Brand', 'Marketing'] },
];

/**
 * Offsets in degrees. ~111km per degree lat; lng varies by lat.
 * 0.00045 deg ≈ 50m, 0.0045 deg ≈ 500m at mid-latitudes.
 */
const OFFSETS: Array<{ dLat: number; dLng: number }> = [
  { dLat: 0.0004, dLng: 0 },
  { dLat: -0.00035, dLng: 0 },
  { dLat: 0, dLng: 0.0005 },
  { dLat: 0, dLng: -0.00045 },
  { dLat: 0.0003, dLng: 0.0003 },
  { dLat: -0.0003, dLng: 0.0003 },
  { dLat: 0.00025, dLng: -0.00025 },
  { dLat: -0.00025, dLng: -0.00025 },
];

export function generateMockNearbyUsers(
  centerLat: number,
  centerLng: number
): NearbyShareUser[] {
  if (!IS_DEV && !MOCK_EXPLICIT) return [];
  const users: NearbyShareUser[] = [];

  for (let i = 0; i < Math.min(MOCK_PROFILES.length, OFFSETS.length); i++) {
    const profile = MOCK_PROFILES[i];
    const offset = OFFSETS[i];
    const lat = centerLat + offset.dLat;
    const lng = centerLng + offset.dLng;
    const dist = Math.round(distanceMeters(centerLat, centerLng, lat, lng));

    users.push({
      userId: `mock-dev-${i}`,
      fullName: profile.fullName,
      headline: profile.headline,
      photoUrl: '',
      linkedinUrl: '',
      distanceMeters: dist,
      interests: profile.interests,
      relevanceScore: 0,
      latitude: lat,
      longitude: lng,
    });
  }

  users.sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (IS_DEV) {
    console.log(
      '[mockNearbyUsers] Generated',
      users.length,
      'mock users for dev. Coords:',
      users.map((u) => ({
        name: u.fullName,
        lat: u.latitude?.toFixed(6),
        lng: u.longitude?.toFixed(6),
        dist: u.distanceMeters,
      }))
    );
  }

  return users;
}
