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
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
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

module.exports = { query, getPool, healthCheck };
