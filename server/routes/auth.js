const express = require('express');
const router = express.Router();
const {
  startLinkedInOAuth,
  handleLinkedInCallback,
  exchangeCode,
  verifyToken,
} = require('../controllers/linkedinAuth');

// Redirect user to LinkedIn consent screen
router.get('/linkedin/start', startLinkedInOAuth);

// Legacy: LinkedIn backend-managed callback (redirects to deep link)
router.get('/linkedin/callback', handleLinkedInCallback);

// Frontend callback page POSTs the code here; returns { token, user } JSON
router.post('/linkedin/exchange', exchangeCode);

// App calls this on startup to validate a stored JWT
router.get('/verify', verifyToken);

module.exports = router;
