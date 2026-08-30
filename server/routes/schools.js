const express = require('express');
const router = express.Router();
const { searchSchools } = require('../controllers/schools');

// Public catalog — school names are not private. Auth is optional.
router.get('/search', searchSchools);

module.exports = router;
