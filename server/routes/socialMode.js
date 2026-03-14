const express = require('express');
const router = express.Router();
const db = require('../services/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /social-mode/early-access — add email to waitlist (public, no auth) */
router.post('/early-access', async (req, res) => {
  try {
    const { email, name } = req.body;
    const trimmed = typeof email === 'string' ? email.trim() : '';
    const nameVal = typeof name === 'string' ? name.trim() : null;

    if (!trimmed) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const { rowCount } = await db.query(
      `INSERT INTO social_mode_early_access (email, name) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [trimmed.toLowerCase(), nameVal || null]
    );

    res.status(201).json({
      success: true,
      message: rowCount > 0 ? 'You\'re on the list!' : 'You\'re already on the list!',
    });
  } catch (err) {
    console.error('[social-mode] early-access error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
