/**
 * Interaction funnel / behavioral events — durable in Neon.
 * Tracks nearby_seen, card_opened, profile_viewed, connect_clicked, etc.
 */
const db = require('./db');

const VALID_EVENT_TYPES = [
  'nearby_seen',
  'card_opened',
  'profile_viewed',
  'linkedin_opened',
  'connect_clicked',
  'connection_created',
  'share_started',
  'share_stopped',
];

async function recordInteraction(actorUserId, targetUserId, eventType, opts = {}) {
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Invalid event_type: ${eventType}`);
  }

  const {
    locationId = null,
    latitude = null,
    longitude = null,
    metadata = {},
  } = opts;

  const res = await db.query(
    `INSERT INTO user_interaction_events (actor_user_id, target_user_id, event_type, location_id, latitude, longitude, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [actorUserId, targetUserId, eventType, locationId, latitude, longitude, JSON.stringify(metadata)]
  );
  return res.rows[0];
}

module.exports = { recordInteraction, VALID_EVENT_TYPES };
