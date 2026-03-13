/**
 * User interests (industry + subcategory) — durable in Neon.
 * Supports onboarding: 3 industries, optional subcategories per industry.
 */
const db = require('./db');
const { INTEREST_OPTIONS } = require('../constants/interests');
const { isValidSubcategory } = require('../constants/subcategories');

async function resolveUserId(linkedinSubjectId) {
  const res = await db.query(
    `SELECT id FROM users WHERE linkedin_subject_id = $1`,
    [linkedinSubjectId]
  );
  return res.rows[0]?.id || null;
}

async function saveUserInterests(linkedinSubjectId, interests) {
  const userId = await resolveUserId(linkedinSubjectId);
  if (!userId) throw new Error('User not found');

  await db.query(`DELETE FROM user_interests WHERE user_id = $1`, [userId]);

  if (!interests || interests.length === 0) return [];

  const toInsert = [];
  for (const item of interests) {
    if (!item || typeof item !== 'object' || !item.industry || !INTEREST_OPTIONS.includes(item.industry)) continue;
    const subs = Array.isArray(item.subcategories) ? item.subcategories : [];
    if (subs.length === 0) {
      toInsert.push({ industry: item.industry, subcategory: null });
    } else {
      for (const sub of subs) {
        if (isValidSubcategory(item.industry, sub)) {
          toInsert.push({ industry: item.industry, subcategory: sub });
        }
      }
    }
  }

  const rows = [];
  for (const { industry, subcategory } of toInsert) {
    try {
      const res = await db.query(
        `INSERT INTO user_interests (user_id, industry, subcategory)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, industry, subcategory]
      );
      if (res.rows[0]) rows.push(res.rows[0]);
    } catch (err) {
      if (err.code !== '23505') throw err; /* unique violation - skip */
    }
  }

  return rows;
}

async function getUserInterests(linkedinSubjectId) {
  const userId = await resolveUserId(linkedinSubjectId);
  if (!userId) return [];

  const res = await db.query(
    `SELECT industry, subcategory FROM user_interests WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return res.rows;
}

module.exports = { saveUserInterests, getUserInterests, resolveUserId };
