/**
 * Explicit connection graph — durable in Neon.
 * Tracks every real connection between two users.
 */
const db = require('./db');

function orderedPair(userAId, userBId) {
  return userAId < userBId ? [userAId, userBId] : [userBId, userAId];
}

async function createConnection(userAId, userBId, opts = {}) {
  const [a, b] = orderedPair(userAId, userBId);
  const {
    locationId = null,
    latitude = null,
    longitude = null,
    connectionMethod = 'in_app_tap',
    venueEventId = null,
  } = opts;

  const res = await db.query(
    `INSERT INTO user_connections (user_a_id, user_b_id, location_id, latitude, longitude, connection_method, venue_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_a_id, user_b_id) DO NOTHING
     RETURNING *`,
    [a, b, locationId, latitude, longitude, connectionMethod, venueEventId]
  );
  return res.rows[0];
}

async function getConnectionsForUser(userId) {
  const res = await db.query(
    `SELECT uc.*, 
       ua.linkedin_subject_id AS user_a_linkedin_id,
       ub.linkedin_subject_id AS user_b_linkedin_id
     FROM user_connections uc
     JOIN users ua ON ua.id = uc.user_a_id
     JOIN users ub ON ub.id = uc.user_b_id
     WHERE uc.user_a_id = $1 OR uc.user_b_id = $1
     ORDER BY uc.connected_at DESC`,
    [userId]
  );
  return res.rows;
}

async function areConnected(userAId, userBId) {
  const [a, b] = orderedPair(userAId, userBId);
  const res = await db.query(
    `SELECT 1 FROM user_connections WHERE user_a_id = $1 AND user_b_id = $2`,
    [a, b]
  );
  return res.rows.length > 0;
}

module.exports = { createConnection, getConnectionsForUser, areConnected };
