const userService = require('../services/userService');
const config = require('../config');
const db = require('../services/db');

/**
 * GET /debug/nearby
 * Temporary diagnostics — aggregate discoverability counts from profiles table.
 */
async function debugNearby(req, res) {
  try {
    const lat = parseFloat(req.query.latitude) || 40.7128;
    const lon = parseFloat(req.query.longitude) || -74.006;
    const radius = parseFloat(req.query.radiusMeters) || config.MAX_DISTANCE_METERS || 152.4;
    const stats = await userService.getDiscoveryPipelineStats(lat, lon, radius, '__debug__');
    res.json({
      total_discoverable: stats.total_discoverable,
      with_location: stats.with_location,
      recent_24h: stats.recent_24h,
      within_radius: stats.within_radius,
      note: 'Counts from profiles table (is_discoverable, last_latitude, last_seen_at)',
      sampleQuery: { latitude: lat, longitude: lon, radiusMeters: radius },
    });
  } catch (err) {
    console.error('[debug] nearby error:', err.message);
    res.status(500).json({ error: err.message || 'Debug query failed' });
  }
}

/**
 * GET /debug/discovery-state
 * Quick DB health check — discoverable users with location data.
 */
async function discoveryState(req, res) {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_discoverable = true)::int AS discoverable,
        COUNT(*) FILTER (WHERE last_latitude IS NOT NULL)::int AS has_location,
        COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '7 days')::int AS recent
      FROM profiles
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[debug] discovery-state error:', err.message);
    res.status(500).json({ error: err.message || 'Discovery state query failed' });
  }
}

module.exports = { debugNearby, discoveryState };
