-- Canonical schools table + optional profiles.school_id.
-- Also applied idempotently by server/services/db.js on startup.

CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  country TEXT,
  state_region TEXT,
  city TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_school_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_school_id_fkey
      FOREIGN KEY (school_id) REFERENCES schools(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schools_normalized_prefix ON schools (normalized_name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_schools_canonical_lower ON schools (lower(canonical_name));
CREATE INDEX IF NOT EXISTS idx_schools_aliases ON schools USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles (school_id);
