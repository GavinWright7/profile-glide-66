-- Saved profiles (Neon) — links saver ↔ discovered user by LinkedIn subject id
-- Run: psql $DATABASE_URL -f migrations/008_saved_profiles.sql

CREATE TABLE IF NOT EXISTS saved_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saver_linkedin_subject_id TEXT NOT NULL,
  target_linkedin_subject_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(saver_linkedin_subject_id, target_linkedin_subject_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_profiles_saver ON saved_profiles(saver_linkedin_subject_id);
CREATE INDEX IF NOT EXISTS idx_saved_profiles_target ON saved_profiles(target_linkedin_subject_id);
