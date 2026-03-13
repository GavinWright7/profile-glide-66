const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { sharingRateLimiter } = require('../middleware/rateLimit');
const {
  startSharing,
  heartbeat,
  stopSharing,
  getNearby,
  debugSessions,
} = require('../controllers/sharing');

// Rate limit presence endpoints
router.use(sharingRateLimiter);

// All sharing routes require a valid JWT
router.post('/start', requireAuth, startSharing);
router.post('/heartbeat', requireAuth, heartbeat);
router.post('/stop', requireAuth, stopSharing);
router.get('/nearby', requireAuth, getNearby);

// Dev-only — shows in-memory session state (remove before production)
router.get('/debug', debugSessions);

module.exports = router;
