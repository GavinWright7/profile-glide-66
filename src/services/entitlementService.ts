/**
 * Entitlement service — provider-agnostic premium access.
 * Sources: Apple IAP, promo code, backend (admin grant).
 * Single source of truth: hasPremiumAccess()
 */
import { BACKEND_URL } from '../auth/authService';
import { StoreKit, isStoreKitAvailable } from '../utils/storeKit';

const PREMIUM_CACHE_KEY = 'pg_premium_status';
const PREMIUM_CACHE_TTL_MS = 60_000;

let cachedPremium: boolean | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
  return cachedPremium !== null && Date.now() - cacheTimestamp < PREMIUM_CACHE_TTL_MS;
}

/**
 * Check if the user has premium access.
 * Uses backend as source of truth; falls back to local Apple entitlement for offline.
 */
export async function hasPremiumAccess(token: string | null): Promise<boolean> {
  if (!token) return false;
  if (isCacheValid()) return cachedPremium!;

  try {
    const res = await fetch(`${BACKEND_URL}/premium/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    let isPremium = !!data?.isPremium;
    if (!isPremium && isStoreKitAvailable()) {
      const { isPremium: applePremium } = await StoreKit.getEntitlementStatus();
      if (applePremium) {
        await recordApplePurchase(token, 'premium_monthly');
        isPremium = true;
      }
    }
    cachedPremium = isPremium;
    cacheTimestamp = Date.now();
    return isPremium;
  } catch {
    if (isStoreKitAvailable()) {
      const { isPremium } = await StoreKit.getEntitlementStatus();
      return isPremium;
    }
    return false;
  }
}

/**
 * Invalidate cache (e.g. after purchase or promo code).
 */
export function invalidatePremiumCache(): void {
  cachedPremium = null;
  cacheTimestamp = 0;
}

/**
 * Redeem promo code "premium" for dev/testing.
 */
export async function redeemPromoCode(token: string | null, code: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/premium/promo-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      invalidatePremiumCache();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Record Apple purchase with backend.
 */
export async function recordApplePurchase(
  token: string | null,
  productId: string,
  originalTransactionId?: string
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/premium/apple-purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId, originalTransactionId }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      invalidatePremiumCache();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get max radius in meters for the user (500ft free, 2000ft premium).
 */
export const FREE_RADIUS_METERS = 152.4;
export const PREMIUM_RADIUS_METERS = 609.6;
