const express = require('express');
const router = express.Router();
const {
  startLinkedInOAuth,
  handleLinkedInCallback,
  exchangeCode,
  verifyToken,
  serveRedirectPage,
} = require('../controllers/linkedinAuth');

// Redirect user to LinkedIn consent screen
router.get('/linkedin/start', startLinkedInOAuth);

// LinkedIn callback (exchanges code, redirects to HTTPS page that opens airlinks://)
router.get('/linkedin/callback', handleLinkedInCallback);

// SFSafariViewController-compatible redirect page (serves HTML that opens airlinks://auth)
router.get('/redirect', serveRedirectPage);

// Frontend callback page POSTs the code here; returns { token, user } JSON
router.post('/linkedin/exchange', exchangeCode);

// App calls this on startup to validate a stored JWT (also /auth/me for clarity)
router.get('/verify', verifyToken);
router.get('/me', verifyToken);

module.exports = router;
