-- Persistent discoverability location (survives Redis TTL / app background)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_discoverable_seen
  ON profiles (is_discoverable, last_seen_at DESC)
  WHERE is_discoverable = true AND last_latitude IS NOT NULL;
