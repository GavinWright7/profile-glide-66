/**
 * Admin routes — protected by x-admin-key. Local admin tools only.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../services/db');

const router = express.Router();

router.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Headers', 'x-admin-key, content-type');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', 'x-admin-key, content-type');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.sendStatus(200);
});

const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.ip,
  skip: (req) => req.method === 'OPTIONS',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Please slow down.' },
});

router.use(adminRateLimiter);

function logMapDataAccess(req, authorized) {
  if (req.path !== '/map-data') return;
  console.log('[admin][map-data]', {
    timestamp: new Date().toISOString(),
    ok: authorized,
    result: authorized ? 'success' : '403',
    ip: req.ip,
  });
}

function requireAdminKey(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const key = req.headers['x-admin-key'];
  const valid = Boolean(config.ADMIN_SECRET_KEY) && key === config.ADMIN_SECRET_KEY;
  logMapDataAccess(req, valid);
  if (!valid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.use(requireAdminKey);

/**
 * GET /admin/map-data
 * Discoverable users with location seen in the last 24 hours.
 */
router.get('/map-data', async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT
         p.full_name,
         p.first_name,
         p.last_name,
         p.photo_url,
         p.headline,
         p.linkedin_url,
         p.last_latitude,
         p.last_longitude,
         p.last_seen_at,
         u.linkedin_subject_id
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_discoverable = true
         AND p.last_latitude IS NOT NULL
         AND p.last_longitude IS NOT NULL
         AND p.last_seen_at > NOW() - INTERVAL '24 hours'
       ORDER BY p.last_seen_at DESC`
    );

    const users = result.rows.map((row) => ({
      full_name: row.full_name || '',
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      photo_url: row.photo_url || '',
      headline: row.headline || '',
      linkedin_url: row.linkedin_url || '',
      last_latitude: row.last_latitude != null ? Number(row.last_latitude) : null,
      last_longitude: row.last_longitude != null ? Number(row.last_longitude) : null,
      last_seen_at: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
      linkedin_subject_id: row.linkedin_subject_id || '',
    }));

    res.json({
      users,
      count: users.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin][map-data] error:', err.message);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

module.exports = router;
