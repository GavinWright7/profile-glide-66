const express = require('express');
const router = express.Router();
const { debugNearby } = require('../controllers/debug');

router.get('/nearby', debugNearby);

module.exports = router;
