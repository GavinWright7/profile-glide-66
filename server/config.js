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
    console.error('\n❌ Missing or placeholder environment variables:');
    invalid.forEach((k) => console.error(`   ${k}`));
    console.error('\nSet these in Railway → Variables.\n');
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
  MAX_DISTANCE_METERS: 152.4,
  MAX_DISTANCE_METERS_PREMIUM: 609.6,

  REDIS_GEO_KEY: 'pg:active:geo',
  REDIS_SESSION_PREFIX: 'pg:session:',
  REDIS_SESSION_TTL: 60,

  requireEnv,
};