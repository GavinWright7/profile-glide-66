-- Graduation year for professional background / generated bio
-- Run: psql $DATABASE_URL -f migrations/008_graduation_year.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS graduation_year TEXT;
