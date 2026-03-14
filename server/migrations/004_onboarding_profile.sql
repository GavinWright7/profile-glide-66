-- Profile Glide — Onboarding profile fields (Professional Background + Goals)
-- Run: psql $DATABASE_URL -f migrations/004_onboarding_profile.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_company TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alma_mater TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS past_companies TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goals TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_goals ON profiles USING GIN(goals);
