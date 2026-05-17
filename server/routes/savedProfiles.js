const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { listSaved, saveOne, removeOne } = require('../controllers/savedProfiles');

router.get('/', requireAuth, listSaved);
router.post('/:userId', requireAuth, saveOne);
router.delete('/:userId', requireAuth, removeOne);

module.exports = router;
