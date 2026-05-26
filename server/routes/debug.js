const express = require('express');
const router = express.Router();
const { debugNearby, discoveryState } = require('../controllers/debug');

router.get('/nearby', debugNearby);
router.get('/discovery-state', discoveryState);

module.exports = router;
