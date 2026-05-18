#!/usr/bin/env node
/**
 * Add onboarding profile columns to profiles table if they don't exist.
 * Run: node server/scripts/migrate-profile-columns.js
 * Requires: DATABASE_URL in server/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../services/db');

const SQL = `
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_job_title TEXT,
  ADD COLUMN IF NOT EXISTS current_company TEXT,
  ADD COLUMN IF NOT EXISTS alma_mater TEXT,
  ADD COLUMN IF NOT EXISTS past_companies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goals TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS graduation_year TEXT;
`;

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in server/.env');
    process.exit(1);
  }

  try {
    await db.query(SQL);
    console.log('Migration complete: profile columns (including graduation_year) added if missing.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
