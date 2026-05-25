-- Persist discoverable preference across sessions
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT false;
