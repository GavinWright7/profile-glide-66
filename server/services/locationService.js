/**
 * Location / venue intelligence — durable in Neon.
 * Resolves lat/lng to locations, tracks visits, segments.
 */
const db = require('./db');

const GEOHASH_PRECISION = 6;

function simpleGeohash(lat, lon) {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let hash = '';
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let isLon = true;
  for (let i = 0; i < GEOHASH_PRECISION; i++) {
    let ch = 0;
    for (let b = 4; b >= 0; b--) {
      if (isLon) {
        const mid = (lonMin + lonMax) / 2;
        if (lon > mid) { ch |= (1 << b); lonMin = mid; } else { lonMax = mid; }
      } else {
        const mid = (latMin + latMax) / 2;
        if (lat > mid) { ch |= (1 << b); latMin = mid; } else { latMax = mid; }
      }
      isLon = !isLon;
    }
    hash += base32[ch];
  }
  return hash;
}

async function findOrCreateLocation(opts) {
  const {
    latitude,
    longitude,
    name = null,
    address = null,
    city = null,
    state = null,
    country = null,
    venueType = null,
  } = opts;

  const geohash = simpleGeohash(latitude, longitude);

  const existing = await db.query(
    `SELECT * FROM locations WHERE geohash = $1 LIMIT 1`,
    [geohash]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const res = await db.query(
    `INSERT INTO locations (name, latitude, longitude, geohash, address, city, state, country, venue_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [name, latitude, longitude, geohash, address, city, state, country, venueType]
  );
  return res.rows[0];
}

async function recordVisit(userId, locationId, opts = {}) {
  const { arrivedAt = new Date(), departedAt = null, durationSeconds = null, wasDiscoverable = false } = opts;

  const res = await db.query(
    `INSERT INTO location_visits (user_id, location_id, arrived_at, departed_at, duration_seconds, was_discoverable)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, locationId, arrivedAt, departedAt, durationSeconds, wasDiscoverable]
  );
  return res.rows[0];
}

async function updateLocationSegment(locationId, industry, subcategory) {
  const sub = subcategory || null;
  const existing = await db.query(
    `SELECT id, visit_count, unique_user_count FROM location_user_segments 
     WHERE location_id = $1 AND industry = $2 AND (subcategory IS NOT DISTINCT FROM $3)`,
    [locationId, industry, sub]
  );
  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE location_user_segments SET visit_count = visit_count + 1, updated_at = NOW() 
       WHERE location_id = $1 AND industry = $2 AND (subcategory IS NOT DISTINCT FROM $3)`,
      [locationId, industry, sub]
    );
  } else {
    await db.query(
      `INSERT INTO location_user_segments (location_id, industry, subcategory, visit_count, unique_user_count, updated_at)
       VALUES ($1, $2, $3, 1, 1, NOW())`,
      [locationId, industry, sub]
    );
  }
}

module.exports = { findOrCreateLocation, recordVisit, updateLocationSegment, simpleGeohash };
