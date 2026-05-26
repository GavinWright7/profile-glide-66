const rateLimit = require('express-rate-limit');

function logSharingStartKey(req, key) {
  const path = req.originalUrl || req.path || '';
  if (path.includes('/sharing/start')) {
    console.log('[rate-limit][sharing/start]', {
      path,
      userId: req.userId || null,
      headerUserId: req.headers['x-user-id'] || null,
      ip: req.ip,
      key,
    });
  }
}

/** Key per authenticated user — never falls back to IP (requireAuth runs first). */
function userIdKeyGenerator(req) {
  if (req.userId) return req.userId;
  const headerUserIdRaw = req.headers['x-user-id'];
  const headerUserId = Array.isArray(headerUserIdRaw)
    ? headerUserIdRaw[0]
    : headerUserIdRaw;
  const key = headerUserId || 'unauthenticated';
  logSharingStartKey(req, key);
  return key;
}

const skipOptions = (req) => req.method === 'OPTIONS';

/** Automatic heartbeats — app sends ~20/min; 60/min gives headroom for retries/reconnects. */
const heartbeatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userIdKeyGenerator,
  skip: skipOptions,
  message: { error: 'Too many heartbeat updates. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** User-triggered presence (start/stop sharing) — strict limit. */
const presenceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: userIdKeyGenerator,
  skip: skipOptions,
  message: { error: 'Too many presence updates. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const nearbyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: userIdKeyGenerator,
  skip: skipOptions,
  message: { error: 'Too many nearby requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const discoverableRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: userIdKeyGenerator,
  skip: skipOptions,
  message: {
    error: 'Please wait a moment before changing discoverability again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  heartbeatRateLimiter,
  presenceRateLimiter,
  nearbyRateLimiter,
  discoverableRateLimiter,
};
