-- AirLinks — optional bio + career for in-app profile (Neon profiles)
-- Run: psql $DATABASE_URL -f migrations/007_profile_bio_career.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career TEXT;
