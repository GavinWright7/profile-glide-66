require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../services/db');
const schoolService = require('../services/schoolService');

async function main() {
  await schoolService.ensureSchoolsSchema();
  const seed = await schoolService.seedSchoolsIfNeeded();
  const backfill = await schoolService.backfillProfileSchools();
  const users = await db.query(`
    SELECT
      p.full_name,
      p.is_discoverable,
      p.alma_mater,
      p.school_id,
      p.last_seen_at,
      (p.last_latitude IS NOT NULL AND p.last_longitude IS NOT NULL) AS has_coords,
      u.linkedin_subject_id
    FROM profiles p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.full_name
  `);
  console.log(JSON.stringify({ seed, backfill, users: users.rows }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
