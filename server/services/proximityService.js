/**
 * Passive proximity graph — durable in Neon.
 * Tracks repeated co-presence even when users never connect.
 */
const db = require('./db');

function orderedPair(userAId, userBId) {
  return userAId < userBId ? [userAId, userBId] : [userBId, userAId];
}

async function recordProximityEvent(userAId, userBId, opts) {
  const [a, b] = orderedPair(userAId, userBId);
  const {
    startedAt,
    endedAt,
    durationSeconds,
    minDistanceMeters = null,
    avgDistanceMeters = null,
    locationId = null,
    latitude = null,
    longitude = null,
    venueEventId = null,
  } = opts;

  const res = await db.query(
    `INSERT INTO user_proximity_events 
     (user_a_id, user_b_id, started_at, ended_at, duration_seconds, min_distance_meters, avg_distance_meters, location_id, latitude, longitude, venue_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [a, b, startedAt, endedAt, durationSeconds, minDistanceMeters, avgDistanceMeters, locationId, latitude, longitude, venueEventId]
  );

  await upsertProximityRollup(a, b, {
    durationSeconds,
    locationId,
    lastSeenAt: endedAt,
  });

  return res.rows[0];
}

async function upsertProximityRollup(userAId, userBId, opts = {}) {
  const [a, b] = orderedPair(userAId, userBId);
  const { durationSeconds = 0, locationId = null, lastSeenAt = new Date() } = opts;

  const res = await db.query(
    `INSERT INTO user_proximity_rollups (user_a_id, user_b_id, total_encounters, total_minutes_nearby, last_seen_nearby_at, primary_location_id, updated_at)
     VALUES ($1, $2, 1, GREATEST(0, $3 / 60), $4, $5, NOW())
     ON CONFLICT (user_a_id, user_b_id)
     DO UPDATE SET
       total_encounters = user_proximity_rollups.total_encounters + 1,
       total_minutes_nearby = user_proximity_rollups.total_minutes_nearby + GREATEST(0, $3 / 60),
       last_seen_nearby_at = $4,
       primary_location_id = COALESCE($5, user_proximity_rollups.primary_location_id),
       updated_at = NOW()
     RETURNING *`,
    [a, b, durationSeconds, lastSeenAt, locationId]
  );
  return res.rows[0];
}

module.exports = { recordProximityEvent, upsertProximityRollup };
