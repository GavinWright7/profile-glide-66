#!/usr/bin/env node
/**
 * Reset test user "Gavin Wright" — deletes all data so onboarding can be retested.
 * DEV/TEST ONLY. Uses DATABASE_URL from server/.env.
 *
 * Run: node scripts/reset-test-user.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const SEARCH_NAME = 'Gavin Wright';
const SEARCH_LINKEDIN = 'gavin';

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in server/.env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const userRes = await client.query(
      `SELECT u.id, u.linkedin_subject_id, p.full_name, p.linkedin_url
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE p.full_name ILIKE $1 OR p.linkedin_url ILIKE $2`,
      [`%${SEARCH_NAME}%`, `%${SEARCH_LINKEDIN}%`]
    );

    if (userRes.rows.length === 0) {
      console.log(`No user found matching "${SEARCH_NAME}" or linkedin_url containing "${SEARCH_LINKEDIN}".`);
      return;
    }

    if (userRes.rows.length > 1) {
      console.log(`Multiple users found. Deleting first match.`);
    }

    const user = userRes.rows[0];
    const userId = user.id;
    const displayName = user.full_name || user.linkedin_subject_id || userId;

    console.log(`Deleting test user ${displayName} (${userId})...`);

    const counts = {};

    const tables = [
      { name: 'events', where: 'user_id = $1' },
      { name: 'user_interaction_events', where: 'actor_user_id = $1 OR target_user_id = $1' },
      { name: 'user_connections', where: 'user_a_id = $1 OR user_b_id = $1' },
      { name: 'user_proximity_events', where: 'user_a_id = $1 OR user_b_id = $1' },
      { name: 'user_proximity_rollups', where: 'user_a_id = $1 OR user_b_id = $1' },
      { name: 'location_visits', where: 'user_id = $1' },
      { name: 'venue_event_attendance', where: 'user_id = $1' },
      { name: 'user_interests', where: 'user_id = $1' },
      { name: 'profiles', where: 'user_id = $1' },
    ];

    for (const { name, where } of tables) {
      try {
        const delRes = await client.query(
          `DELETE FROM ${name} WHERE ${where} RETURNING id`,
          [userId]
        );
        counts[name] = delRes.rowCount ?? 0;
      } catch (err) {
        if (err.code === '42P01') {
          counts[name] = 0;
        } else {
          throw err;
        }
      }
    }

    const userDel = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (userDel.rowCount === 0) {
      console.error('Failed to delete user row.');
      process.exit(1);
    }

    console.log(`Removed ${counts.user_interests ?? 0} interests`);
    console.log(`Removed ${counts.user_connections ?? 0} connections`);
    console.log(`Removed ${counts.user_proximity_events ?? 0} proximity events`);
    console.log(`Removed ${counts.user_proximity_rollups ?? 0} proximity rollups`);
    console.log(`Removed ${counts.location_visits ?? 0} location visits`);
    console.log(`Removed ${counts.user_interaction_events ?? 0} interaction events`);
    if (counts.events > 0) console.log(`Removed ${counts.events} audit events`);
    if (counts.venue_event_attendance > 0) console.log(`Removed ${counts.venue_event_attendance} venue attendance`);
    console.log('User deleted successfully.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
