/**
 * Central config — env vars and constants.
 * All production-sensitive values come from environment.
 */

// Load .env locally only (Railway already injects env vars)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const PLACEHOLDER_PATTERNS = /^YOUR_|_HERE$|^change-this/i;

function requireEnv(keys) {
  const invalid = keys.filter((key) => {
    const val = process.env[key];
    return !val || PLACEHOLDER_PATTERNS.test(val);
  });

  if (invalid.length) {
    const msg = `FATAL: Missing required environment variables: ${invalid.join(', ')}. Set these in Railway → Variables.`;
    console.error('\n❌', msg);
    process.exit(1);
  }
}

module.exports = {

  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET,

  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI,

  HEARTBEAT_TIMEOUT_MS: 45000,
  /** TESTING: ~20,000 km — any two U.S. locations (incl. territories). Revert to 152.4 / 609.6 for production. */
  MAX_DISTANCE_METERS: 20_000_000,
  MAX_DISTANCE_METERS_PREMIUM: 20_000_000,

  REDIS_GEO_KEY: 'pg:active:geo',
  REDIS_SESSION_PREFIX: 'pg:session:',
  REDIS_SESSION_TTL: 120,

  requireEnv,
};