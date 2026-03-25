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

// All sharing routes require a valid JWT
router.post('/start', requireAuth, presenceRateLimiter, startSharing);
router.post('/heartbeat', requireAuth, presenceRateLimiter, heartbeat);
router.post('/heartbeat/keepalive', requireAuth, presenceRateLimiter, keepalive);
router.post('/stop', requireAuth, presenceRateLimiter, stopSharing);
router.get('/nearby', requireAuth, nearbyRateLimiter, getNearby);

// Dev-only — shows in-memory session state (remove before production)
router.get('/debug', debugSessions);

module.exports = router;
