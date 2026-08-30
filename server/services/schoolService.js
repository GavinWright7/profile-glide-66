const db = require('./db');
const schoolsData = require('../data/schools.json');

function normalizeSchoolName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureSchoolsSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      country TEXT,
      state_region TEXT,
      city TEXT,
      aliases TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id INTEGER`);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_school_id_fkey'
      ) THEN
        ALTER TABLE profiles
          ADD CONSTRAINT profiles_school_id_fkey
          FOREIGN KEY (school_id) REFERENCES schools(id)
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_schools_normalized_prefix ON schools (normalized_name text_pattern_ops)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_schools_canonical_lower ON schools (lower(canonical_name))`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_schools_aliases ON schools USING GIN (aliases)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles (school_id)`);
}

async function seedSchoolsIfNeeded() {
  const countRes = await db.query(`SELECT COUNT(*)::int AS n FROM schools`);
  const count = countRes.rows[0]?.n ?? 0;
  if (count >= 1000) return { seeded: false, count };

  const client = await db.getPool().connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    const batchSize = 250;
    for (let i = 0; i < schoolsData.length; i += batchSize) {
      const batch = schoolsData.slice(i, i + batchSize);
      const values = [];
      const params = [];
      for (const school of batch) {
        const canonical = String(school.name || '').trim();
        const normalized = school.normalized || normalizeSchoolName(canonical);
        if (!canonical || !normalized) continue;
        const aliases = Array.isArray(school.aliases)
          ? school.aliases.map((a) => normalizeSchoolName(a)).filter(Boolean)
          : [];
        const offset = params.length;
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
        );
        params.push(
          canonical,
          normalized,
          school.country || 'United States',
          school.state || null,
          school.city || null,
          aliases
        );
        inserted += 1;
      }
      if (values.length === 0) continue;
      await client.query(
        `INSERT INTO schools (canonical_name, normalized_name, country, state_region, city, aliases)
         VALUES ${values.join(',')}
         ON CONFLICT (normalized_name) DO UPDATE
           SET aliases = (
             SELECT ARRAY(SELECT DISTINCT unnest(schools.aliases || EXCLUDED.aliases))
           )`,
        params
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const after = await db.query(`SELECT COUNT(*)::int AS n FROM schools`);
  await ensureExtraSchools();
  await ensureCommonAliases();
  console.log('[schools] seeded', { attempted: inserted, total: after.rows[0]?.n });
  return { seeded: true, count: after.rows[0]?.n ?? inserted };
}

const COMMON_ALIASES = {
  'stanford university': ['stanford'],
};

const EXTRA_SCHOOLS = [
  {
    name: 'New York University Abu Dhabi',
    normalized: 'new york university abu dhabi',
    country: 'United Arab Emirates',
    city: 'Abu Dhabi',
    aliases: ['nyu abu dhabi', 'nyuad'],
  },
  {
    name: 'New York University Shanghai',
    normalized: 'new york university shanghai',
    country: 'China',
    city: 'Shanghai',
    aliases: ['nyu shanghai', 'nyush'],
  },
];

async function ensureExtraSchools() {
  for (const school of EXTRA_SCHOOLS) {
    const aliases = (school.aliases || []).map((a) => normalizeSchoolName(a)).filter(Boolean);
    await db.query(
      `INSERT INTO schools (canonical_name, normalized_name, country, state_region, city, aliases)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (normalized_name) DO UPDATE
         SET aliases = (
           SELECT ARRAY(SELECT DISTINCT unnest(schools.aliases || EXCLUDED.aliases))
         )`,
      [
        school.name,
        school.normalized,
        school.country || null,
        school.state || null,
        school.city || null,
        aliases,
      ]
    );
  }
}

async function ensureCommonAliases() {
  for (const [normalized, aliases] of Object.entries(COMMON_ALIASES)) {
    await db.query(
      `UPDATE schools
       SET aliases = (
         SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(aliases, ARRAY[]::text[]) || $2::text[]))
       )
       WHERE normalized_name = $1`,
      [normalized, aliases]
    );
  }
}

async function backfillProfileSchools() {
  const exact = await db.query(`
    UPDATE profiles p
    SET school_id = s.id
    FROM schools s
    WHERE p.school_id IS NULL
      AND p.alma_mater IS NOT NULL
      AND trim(p.alma_mater) <> ''
      AND regexp_replace(lower(trim(p.alma_mater)), '[^a-z0-9&]+', ' ', 'g') = s.normalized_name
    RETURNING p.user_id
  `);

  const alias = await db.query(`
    WITH candidates AS (
      SELECT p2.user_id, array_agg(DISTINCT s.id) AS ids
      FROM profiles p2
      JOIN schools s
        ON regexp_replace(lower(trim(p2.alma_mater)), '[^a-z0-9&]+', ' ', 'g') = ANY(s.aliases)
      WHERE p2.school_id IS NULL
        AND p2.alma_mater IS NOT NULL
        AND trim(p2.alma_mater) <> ''
      GROUP BY p2.user_id
    )
    UPDATE profiles p
    SET school_id = candidates.ids[1]
    FROM candidates
    WHERE p.user_id = candidates.user_id
      AND p.school_id IS NULL
      AND cardinality(candidates.ids) = 1
    RETURNING p.user_id
  `);

  const leftover = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE school_id IS NOT NULL)::int AS matched,
      COUNT(*) FILTER (
        WHERE school_id IS NULL AND alma_mater IS NOT NULL AND trim(alma_mater) <> ''
      )::int AS unmatched
    FROM profiles
  `);

  const ambiguousRes = await db.query(`
    SELECT COUNT(*)::int AS n
    FROM (
      SELECT p2.user_id
      FROM profiles p2
      JOIN schools s
        ON regexp_replace(lower(trim(p2.alma_mater)), '[^a-z0-9&]+', ' ', 'g') = ANY(s.aliases)
      WHERE p2.school_id IS NULL
        AND p2.alma_mater IS NOT NULL
        AND trim(p2.alma_mater) <> ''
      GROUP BY p2.user_id
      HAVING COUNT(DISTINCT s.id) > 1
    ) t
  `);

  const report = {
    exactMatches: exact.rowCount || 0,
    aliasMatches: alias.rowCount || 0,
    matched: leftover.rows[0]?.matched ?? 0,
    unmatched: leftover.rows[0]?.unmatched ?? 0,
    ambiguous: ambiguousRes.rows[0]?.n ?? 0,
  };
  console.log('[schools] backfill', report);
  return report;
}

async function searchSchools(query, limit = 15) {
  const q = normalizeSchoolName(query);
  if (!q) return [];
  const capped = Math.min(Math.max(Number(limit) || 15, 1), 20);
  const res = await db.query(
    `SELECT id, canonical_name, city, state_region, country
     FROM schools
     WHERE normalized_name LIKE $1 || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(aliases) AS alias
          WHERE alias LIKE $1 || '%'
        )
        OR normalized_name LIKE '%' || $1 || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(aliases) AS alias
          WHERE alias LIKE '%' || $1 || '%'
        )
     ORDER BY
       CASE
         WHEN normalized_name LIKE $1 || '%' THEN 0
         WHEN EXISTS (SELECT 1 FROM unnest(aliases) AS alias WHERE alias LIKE $1 || '%') THEN 1
         WHEN normalized_name LIKE '%' || $1 || '%' THEN 2
         ELSE 3
       END,
       canonical_name ASC
     LIMIT $2`,
    [q, capped]
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    name: row.canonical_name,
    city: row.city || '',
    state: row.state_region || '',
    country: row.country || 'United States',
  }));
}

async function resolveUniqueSchoolId(text) {
  const q = normalizeSchoolName(text);
  if (!q) return null;
  const exact = await db.query(
    `SELECT id FROM schools WHERE normalized_name = $1`,
    [q]
  );
  if (exact.rows.length === 1) return exact.rows[0].id;
  if (exact.rows.length > 1) return null;
  const alias = await db.query(
    `SELECT id FROM schools WHERE $1 = ANY(aliases)`,
    [q]
  );
  if (alias.rows.length === 1) return alias.rows[0].id;
  return null;
}

async function getSchoolById(id) {
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  const res = await db.query(
    `SELECT id, canonical_name, normalized_name, city, state_region, country
     FROM schools WHERE id = $1`,
    [numeric]
  );
  return res.rows[0] || null;
}

module.exports = {
  normalizeSchoolName,
  ensureSchoolsSchema,
  seedSchoolsIfNeeded,
  ensureCommonAliases,
  ensureExtraSchools,
  backfillProfileSchools,
  searchSchools,
  resolveUniqueSchoolId,
  getSchoolById,
};
