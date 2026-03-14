-- Social Mode early access waitlist
-- Run: psql $DATABASE_URL -f migrations/005_social_mode_early_access.sql

CREATE TABLE IF NOT EXISTS social_mode_early_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_social_mode_early_access_email ON social_mode_early_access(email);
CREATE INDEX IF NOT EXISTS idx_social_mode_early_access_created ON social_mode_early_access(created_at);
