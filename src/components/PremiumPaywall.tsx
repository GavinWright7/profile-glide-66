import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEntitlement } from '@/hooks/useEntitlement';
import { StoreKit, isStoreKitAvailable } from '@/utils/storeKit';

interface PremiumPaywallProps {
  onClose: () => void;
  feature?: string;
}

const PREMIUM_FEATURES = [
  'Best matches — see likely connections closer to you first',
  'Radar filters — filter by industry and subcategory',
  'Expanded range — discover people up to 2000 feet away',
];

export default function PremiumPaywall({ onClose, feature }: PremiumPaywallProps) {
  const { purchaseViaApple, restoreApplePurchases } = useEntitlement();
  const storeKitAvailable = isStoreKitAvailable();
  const [loading, setLoading] = useState<'subscribe' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<{ displayPrice: string } | null>({ displayPrice: '1.99' });

  useEffect(() => {
    if (storeKitAvailable) {
      StoreKit.getProducts().then((r) => {
        const p = r.products?.[0];
        if (p) setProducts({ displayPrice: p.displayPrice });
      });
    }
  }, [storeKitAvailable]);

  const handleSubscribe = async () => {
    setError(null);
    if (storeKitAvailable) {
      setLoading('subscribe');
      try {
        const ok = await purchaseViaApple();
        if (ok) onClose();
        else setError('Purchase was cancelled or failed.');
      } catch {
        setError('Purchase failed. Please try again.');
      } finally {
        setLoading(null);
      }
    } else {
      setError('In-app purchases are only available on iOS.');
    }
  };

  const handleRestore = async () => {
    setError(null);
    setLoading('restore');
    try {
      const ok = await restoreApplePurchases();
      if (ok) onClose();
      else setError('No purchases to restore.');
    } catch {
      setError('Restore failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 glass-card p-6 max-h-[90vh] overflow-y-auto"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">AirLinks Premium</h2>
            <p className="text-sm text-muted-foreground">
              {feature ? `Unlock ${feature}` : 'Unlock premium features'}
            </p>
          </div>
        </div>

        <ul className="space-y-3 mb-6">
          {PREMIUM_FEATURES.map((text, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <Check size={18} className="text-primary shrink-0 mt-0.5" />
              {text}
            </li>
          ))}
        </ul>

        <div className="text-center mb-6">
          <span className="text-3xl font-bold text-foreground">
            ${products?.displayPrice ?? '1.99'}
          </span>
          <span className="text-muted-foreground">/month</span>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={handleSubscribe}
            disabled={!!loading}
          >
            {loading === 'subscribe' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              'Subscribe'
            )}
          </Button>
          {storeKitAvailable && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleRestore}
              disabled={!!loading}
            >
              {loading === 'restore' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Restore Purchases'
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
