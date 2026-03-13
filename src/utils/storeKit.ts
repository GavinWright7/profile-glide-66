import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

export interface StoreKitProduct {
  id: string;
  displayName: string;
  displayPrice: string;
  description: string;
}

export interface StoreKitPlugin {
  getProducts(): Promise<{ products: StoreKitProduct[]; error?: string }>;
  purchasePremium(): Promise<{
    success: boolean;
    cancelled?: boolean;
    pending?: boolean;
    productId?: string;
    originalTransactionId?: string;
  }>;
  restorePurchases(): Promise<{ success: boolean; isPremium: boolean }>;
  getEntitlementStatus(): Promise<{ isPremium: boolean }>;
}

const StoreKit = registerPlugin<StoreKitPlugin>('StoreKit', {
  web: {
    async getProducts() {
      return { products: [] };
    },
    async purchasePremium() {
      return { success: false };
    },
    async restorePurchases() {
      return { success: false, isPremium: false };
    },
    async getEntitlementStatus() {
      return { isPremium: false };
    },
  },
});

export { StoreKit };

export function isStoreKitAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}
