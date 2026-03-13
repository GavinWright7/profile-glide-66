-- Profile Glide — Premium entitlements
-- Tracks premium status from Apple IAP, promo code, or admin grant.

CREATE TABLE IF NOT EXISTS user_premium (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_premium BOOLEAN NOT NULL DEFAULT true,
  premium_source TEXT NOT NULL,
  subscription_status TEXT,
  premium_started_at TIMESTAMPTZ DEFAULT NOW(),
  premium_expires_at TIMESTAMPTZ,
  apple_product_id TEXT,
  apple_original_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_premium_user ON user_premium(user_id);
CREATE INDEX IF NOT EXISTS idx_user_premium_source ON user_premium(premium_source);
CREATE INDEX IF NOT EXISTS idx_user_premium_expires ON user_premium(premium_expires_at) WHERE premium_expires_at IS NOT NULL;
