const rateLimit = require('express-rate-limit');

/**
 * Rate limit for heartbeat/start/stop — 30 req/min per IP.
 * Prevents abuse from high-frequency presence updates.
 */
const sharingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { sharingRateLimiter };
