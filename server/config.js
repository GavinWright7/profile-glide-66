/**
 * Central config — env vars and constants.
 * All production-sensitive values come from environment.
 */

// Load .env locally only (Railway already injects env vars)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const PLACEHOLDER_PATTERNS = /^YOUR_|_HERE$|^change-this/i;

function missingEnvKeys(keys) {
  return keys.filter((key) => {
    const val = process.env[key];
    return !val || PLACEHOLDER_PATTERNS.test(val);
  });
}

function requireEnv(keys) {
  const invalid = missingEnvKeys(keys);

  if (invalid.length) {
    const msg = `FATAL: Missing required environment variables: ${invalid.join(', ')}. Set these in Railway → Variables.`;
    console.error('\n❌', msg);
    process.exit(1);
  }
}

/** Log missing env at startup without exiting — server can still bind PORT and serve /health. */
function warnEnv(keys) {
  const invalid = missingEnvKeys(keys);
  if (invalid.length) {
    console.warn(
      `[startup] Missing or placeholder env vars (some routes may fail): ${invalid.join(', ')}`
    );
  }
  return invalid;
}

module.exports = {

  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  /** Admin map dashboard — never hardcode; set in Railway Variables and local server/.env */
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY?.trim(),

  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID?.trim(),
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET?.trim(),
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI?.trim(),
  /** Deep link base after OAuth, e.g. airlinks://auth */
  MOBILE_DEEP_LINK_SCHEME: (process.env.MOBILE_DEEP_LINK_SCHEME || 'airlinks://auth').trim(),

  HEARTBEAT_TIMEOUT_MS: 45000,
  /** Free tier: 500 ft; premium: 2000 ft */
  MAX_DISTANCE_METERS: 152.4,
  MAX_DISTANCE_METERS_PREMIUM: 609.6,

  REDIS_GEO_KEY: 'pg:active:geo',
  REDIS_SESSION_PREFIX: 'pg:session:',
  /** Legacy Redis session TTL — nearby discovery uses Neon last_seen_at (24h). */
  REDIS_SESSION_TTL: 86400,

  /** Users visible in nearby if last_seen_at is within this window. */
  DISCOVERY_MAX_AGE_HOURS: 24,

  requireEnv,
  warnEnv,
  missingEnvKeys,
};