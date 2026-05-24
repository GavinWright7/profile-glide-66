const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { presenceRateLimiter, nearbyRateLimiter } = require('../middleware/rateLimit');
const {
  startSharing,
  heartbeat,
  keepalive,
  stopSharing,
  getNearby,
  debugSessions,
} = require('../controllers/sharing');

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('[sharing] route error:', err.message);
      if (!res.headersSent) {
        const isTimeout = /timed out/i.test(err.message);
        res.status(isTimeout ? 503 : 500).json({
          error: err.message || 'Sharing service unavailable',
        });
      }
    });
  };
}

// All sharing routes require a valid JWT
router.post('/start', requireAuth, presenceRateLimiter, asyncHandler(startSharing));
router.post('/heartbeat', requireAuth, presenceRateLimiter, asyncHandler(heartbeat));
router.post('/heartbeat/keepalive', requireAuth, presenceRateLimiter, asyncHandler(keepalive));
router.post('/stop', requireAuth, presenceRateLimiter, asyncHandler(stopSharing));
router.get('/nearby', requireAuth, nearbyRateLimiter, asyncHandler(getNearby));

// Dev-only — shows in-memory session state (remove before production)
router.get('/debug', asyncHandler(debugSessions));

module.exports = router;
