/**
 * Neon PostgreSQL client.
 * Uses pg with connection pooling for serverless/Neon compatibility.
 */
const { Pool } = require('pg');
const config = require('../config');

let pool = null;

function getPool() {
  if (!pool) {
    if (!config.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: config.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[db] ${text.substring(0, 60)}... ${Date.now() - start}ms`);
    }
    return res;
  } catch (err) {
    console.error('[db] query error:', err.message);
    throw err;
  }
}

async function healthCheck() {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Idempotent schema patches applied on every deploy. */
async function runMigrations() {
  await query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT false`
  );
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  // Columns referenced by getNearbyDiscoverableUsers SELECT (idempotent)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}'`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career TEXT`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_job_title TEXT`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_company TEXT`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alma_mater TEXT`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS past_companies TEXT[] DEFAULT '{}'`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS graduation_year TEXT`);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_profiles_discoverable_seen
      ON profiles (is_discoverable, last_seen_at DESC)
      WHERE is_discoverable = true AND last_latitude IS NOT NULL
  `);
  const schoolService = require('./schoolService');
  await schoolService.ensureSchoolsSchema();
  await schoolService.seedSchoolsIfNeeded();
  if (typeof schoolService.ensureExtraSchools === 'function') {
    await schoolService.ensureExtraSchools();
  }
  if (typeof schoolService.ensureCommonAliases === 'function') {
    await schoolService.ensureCommonAliases();
  }
  await schoolService.backfillProfileSchools();
  console.log('[startup] migrations applied');
}

module.exports = { query, getPool, healthCheck, runMigrations };
