-- Add name column to Social Mode early access
-- Run: node scripts/run-migration.js (from server/)

ALTER TABLE social_mode_early_access ADD COLUMN IF NOT EXISTS name TEXT;
