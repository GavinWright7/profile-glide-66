const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { updateLinkedInUrl, updateInterests, getProfile, getInterestsOptions, updateProfessionalBackground, updateGoals } = require('../controllers/profile');

router.get('/interests-options', getInterestsOptions);
router.put('/linkedin-url', requireAuth, updateLinkedInUrl);
router.put('/interests', requireAuth, updateInterests);
router.put('/professional-background', requireAuth, updateProfessionalBackground);
router.put('/goals', requireAuth, updateGoals);
router.get('/', requireAuth, getProfile);

module.exports = router;
