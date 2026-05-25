const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { discoverableRateLimiter } = require('../middleware/rateLimit');
const {
  updateLinkedInUrl,
  updateInterests,
  getProfile,
  getMe,
  patchMe,
  updateDiscoverable,
  updateLocation,
  getInterestsOptions,
  updateProfessionalBackground,
  updateGoals,
} = require('../controllers/profile');

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('[profile] route error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Profile request failed' });
      }
    });
  };
}

router.get('/interests-options', getInterestsOptions);
router.get('/me', requireAuth, asyncHandler(getMe));
router.patch('/me', requireAuth, asyncHandler(patchMe));
router.patch('/discoverable', requireAuth, discoverableRateLimiter, asyncHandler(updateDiscoverable));
router.patch('/location', requireAuth, asyncHandler(updateLocation));
router.put('/linkedin-url', requireAuth, asyncHandler(updateLinkedInUrl));
router.put('/interests', requireAuth, asyncHandler(updateInterests));
router.put('/professional-background', requireAuth, asyncHandler(updateProfessionalBackground));
router.put('/goals', requireAuth, asyncHandler(updateGoals));
router.get('/', requireAuth, asyncHandler(getProfile));
router.patch('/', requireAuth, asyncHandler(patchMe));

module.exports = router;
