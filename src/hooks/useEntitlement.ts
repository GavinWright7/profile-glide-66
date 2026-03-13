import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  hasPremiumAccess,
  invalidatePremiumCache,
  redeemPromoCode,
  recordApplePurchase,
} from '../services/entitlementService';
import { StoreKit, isStoreKitAvailable } from '../utils/storeKit';

export function useEntitlement() {
  const { token } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setIsPremium(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const premium = await hasPremiumAccess(token);
      setIsPremium(premium);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const redeemCode = useCallback(
    async (code: string) => {
      const ok = await redeemPromoCode(token, code);
      if (ok) await refresh();
      return ok;
    },
    [token, refresh]
  );

  const purchaseViaApple = useCallback(async () => {
    if (!isStoreKitAvailable()) return false;
    const result = await StoreKit.purchasePremium();
    if (result.success && result.productId) {
      await recordApplePurchase(token, result.productId, result.originalTransactionId);
      await refresh();
      return true;
    }
    return false;
  }, [token, refresh]);

  const restoreApplePurchases = useCallback(async () => {
    if (!isStoreKitAvailable()) return false;
    const { success, isPremium: applePremium } = await StoreKit.restorePurchases();
    if (success && applePremium && token) {
      await recordApplePurchase(token, 'premium_monthly');
      await refresh();
      return true;
    }
    return success;
  }, [token, refresh]);

  return {
    isPremium,
    isLoading,
    refresh,
    redeemCode,
    purchaseViaApple,
    restoreApplePurchases,
    isStoreKitAvailable: isStoreKitAvailable(),
  };
}
