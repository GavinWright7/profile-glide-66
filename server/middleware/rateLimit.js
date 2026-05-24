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

function presenceKeyGenerator(req) {
  const headerUserIdRaw = req.headers['x-user-id'];
  const headerUserId = Array.isArray(headerUserIdRaw)
    ? headerUserIdRaw[0]
    : headerUserIdRaw;
  const key = req.userId || headerUserId || req.ip;
  logSharingStartKey(req, key);
  return key;
}

const skipOptions = (req) => req.method === 'OPTIONS';

const presenceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: presenceKeyGenerator,
  skip: skipOptions,
  message: { error: 'Too many presence updates. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const nearbyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: (req) => req.userId || req.ip,
  skip: skipOptions,
  message: { error: 'Too many nearby requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { presenceRateLimiter, nearbyRateLimiter };
