/**
 * User and profile persistence in Neon.
 * Handles: upsert user, profile fields.
 *
 * MIGRATION NEEDED — run in NeonDB before deploying:
 * ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
 */
const db = require('./db');

async function upsertUser(linkedinSubjectId, email) {
  const res = await db.query(
    `INSERT INTO users (linkedin_subject_id, email, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (linkedin_subject_id)
     DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
     RETURNING id, linkedin_subject_id, email, created_at, updated_at`,
    [linkedinSubjectId, email || null]
  );
  return res.rows[0];
}

async function upsertProfile(userId, data) {
  const {
    fullName,
    firstName,
    lastName,
    headline,
    photoUrl,
    linkedinUrl,
  } = data;

  const res = await db.query(
    `INSERT INTO profiles (user_id, full_name, first_name, last_name, headline, photo_url, linkedin_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
       first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
       last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
       headline = COALESCE(EXCLUDED.headline, profiles.headline),
       photo_url = COALESCE(EXCLUDED.photo_url, profiles.photo_url),
       linkedin_url = COALESCE(NULLIF(EXCLUDED.linkedin_url, ''), profiles.linkedin_url),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      fullName || null,
      firstName || null,
      lastName || null,
      headline || null,
      photoUrl || null,
      linkedinUrl || null,
    ]
  );
  return res.rows[0];
}

async function getProfileByLinkedInId(linkedinSubjectId) {
  const res = await db.query(
    `SELECT p.*, u.linkedin_subject_id, u.email
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     WHERE u.linkedin_subject_id = $1`,
    [linkedinSubjectId]
  );
  return res.rows[0] || null;
}

async function getProfilesByUserIds(linkedinSubjectIds) {
  if (!linkedinSubjectIds || linkedinSubjectIds.length === 0) return [];
  const placeholders = linkedinSubjectIds.map((_, i) => `$${i + 1}`).join(',');
  const res = await db.query(
    `SELECT u.linkedin_subject_id, u.id AS user_uuid, p.user_id, p.full_name, p.headline, p.photo_url, p.linkedin_url, p.bio
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     WHERE u.linkedin_subject_id IN (${placeholders})`,
    linkedinSubjectIds
  );
  return res.rows;
}

async function updateLinkedInUrl(linkedinSubjectId, linkedinUrl) {
  const res = await db.query(
    `UPDATE profiles p
     SET linkedin_url = $2, updated_at = NOW()
     FROM users u
     WHERE u.id = p.user_id AND u.linkedin_subject_id = $1
     RETURNING p.*`,
    [linkedinSubjectId, linkedinUrl]
  );
  return res.rows[0] || null;
}

async function updateInterests(linkedinSubjectId, interests) {
  const res = await db.query(
    `UPDATE profiles p
     SET interests = $2, updated_at = NOW()
     FROM users u
     WHERE u.id = p.user_id AND u.linkedin_subject_id = $1
     RETURNING p.*`,
    [linkedinSubjectId, Array.isArray(interests) ? interests : []]
  );
  return res.rows[0] || null;
}

async function updateProfessionalBackground(linkedinSubjectId, data) {
  const { currentJobTitle, currentCompany, almaMater, pastCompanies } = data;
  const res = await db.query(
    `UPDATE profiles p
     SET current_job_title = $2,
         current_company = $3,
         alma_mater = $4,
         past_companies = $5,
         updated_at = NOW()
     FROM users u
     WHERE u.id = p.user_id AND u.linkedin_subject_id = $1
     RETURNING p.*`,
    [
      linkedinSubjectId,
      currentJobTitle || null,
      currentCompany || null,
      almaMater || null,
      Array.isArray(pastCompanies) ? pastCompanies : [],
    ]
  );
  return res.rows[0] || null;
}

async function updateGoals(linkedinSubjectId, goals) {
  const res = await db.query(
    `UPDATE profiles p
     SET goals = $2, updated_at = NOW()
     FROM users u
     WHERE u.id = p.user_id AND u.linkedin_subject_id = $1
     RETURNING p.*`,
    [linkedinSubjectId, Array.isArray(goals) ? goals : []]
  );
  return res.rows[0] || null;
}

async function updateBio(linkedinSubjectId, bio) {
  const value = bio != null && String(bio).trim() !== '' ? String(bio).trim() : null;
  const res = await db.query(
    `UPDATE profiles p
     SET bio = $2, updated_at = NOW()
     FROM users u
     WHERE u.id = p.user_id AND u.linkedin_subject_id = $1
     RETURNING p.*`,
    [linkedinSubjectId, value]
  );
  return res.rows[0] || null;
}

module.exports = {
  upsertUser,
  upsertProfile,
  getProfileByLinkedInId,
  getProfilesByUserIds,
  updateLinkedInUrl,
  updateInterests,
  updateProfessionalBackground,
  updateGoals,
  updateBio,
};
