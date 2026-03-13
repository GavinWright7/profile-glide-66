-- Profile Glide — Proprietary Data Layer
-- Durable source of truth for user identity, connections, proximity, locations, interactions.
-- Redis: temporary live presence only. Neon: all durable intelligence.
--
-- Run: node scripts/run-migration.js (or psql $DATABASE_URL -f migrations/002_proprietary_data_layer.sql)

-- ── 1. PROFILES: add bio ─────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- ── 2. USER INTERESTS (industry + subcategory) ────────────────────────────────
-- Replaces/supplements profiles.interests for structured interest graph.
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  subcategory TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_interests_unique ON user_interests(user_id, industry, COALESCE(subcategory, ''));
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_industry ON user_interests(industry);
CREATE INDEX IF NOT EXISTS idx_user_interests_subcategory ON user_interests(subcategory) WHERE subcategory IS NOT NULL;

-- ── 3. LOCATIONS ─────────────────────────────────────────────────────────────
-- Venue/location intelligence. geohash for clustering nearby points.
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geohash TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  venue_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_geohash ON locations(geohash) WHERE geohash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_lat_lon ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_locations_venue_type ON locations(venue_type) WHERE venue_type IS NOT NULL;

-- ── 4. USER CONNECTIONS (explicit connection graph) ───────────────────────────
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  location_id UUID REFERENCES locations(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  connection_method TEXT NOT NULL,
  venue_event_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_a_id < user_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_connections_pair ON user_connections(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_user_a ON user_connections(user_a_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_user_b ON user_connections(user_b_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_connected_at ON user_connections(connected_at);
CREATE INDEX IF NOT EXISTS idx_user_connections_location ON user_connections(location_id) WHERE location_id IS NOT NULL;

-- ── 5. USER PROXIMITY EVENTS (passive co-presence) ────────────────────────────
CREATE TABLE IF NOT EXISTS user_proximity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  min_distance_meters DOUBLE PRECISION,
  avg_distance_meters DOUBLE PRECISION,
  location_id UUID REFERENCES locations(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  venue_event_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_proximity_events_user_a ON user_proximity_events(user_a_id);
CREATE INDEX IF NOT EXISTS idx_proximity_events_user_b ON user_proximity_events(user_b_id);
CREATE INDEX IF NOT EXISTS idx_proximity_events_started ON user_proximity_events(started_at);
CREATE INDEX IF NOT EXISTS idx_proximity_events_location ON user_proximity_events(location_id) WHERE location_id IS NOT NULL;

-- ── 6. USER PROXIMITY ROLLUPS (aggregate co-presence) ────────────────────────
CREATE TABLE IF NOT EXISTS user_proximity_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_encounters INTEGER DEFAULT 0,
  total_minutes_nearby INTEGER DEFAULT 0,
  last_seen_nearby_at TIMESTAMPTZ,
  primary_location_id UUID REFERENCES locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_proximity_rollups_user_a ON user_proximity_rollups(user_a_id);
CREATE INDEX IF NOT EXISTS idx_proximity_rollups_user_b ON user_proximity_rollups(user_b_id);
CREATE INDEX IF NOT EXISTS idx_proximity_rollups_last_seen ON user_proximity_rollups(last_seen_nearby_at);

-- ── 7. LOCATION VISITS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS location_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  arrived_at TIMESTAMPTZ NOT NULL,
  departed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  was_discoverable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_visits_user ON location_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_location_visits_location ON location_visits(location_id);
CREATE INDEX IF NOT EXISTS idx_location_visits_arrived ON location_visits(arrived_at);

-- ── 8. LOCATION USER SEGMENTS (industry/subcategory by location) ──────────────
CREATE TABLE IF NOT EXISTS location_user_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  subcategory TEXT,
  visit_count INTEGER DEFAULT 0,
  unique_user_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_segments_unique ON location_user_segments(location_id, industry, COALESCE(subcategory, ''));
CREATE INDEX IF NOT EXISTS idx_location_segments_location ON location_user_segments(location_id);
CREATE INDEX IF NOT EXISTS idx_location_segments_industry ON location_user_segments(industry);

-- ── 9. USER INTERACTION EVENTS (funnel / behavioral) ─────────────────────────
CREATE TABLE IF NOT EXISTS user_interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  location_id UUID REFERENCES locations(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_events_actor ON user_interaction_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_events_target ON user_interaction_events(target_user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_events_type ON user_interaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_interaction_events_created ON user_interaction_events(created_at);
CREATE INDEX IF NOT EXISTS idx_interaction_events_location ON user_interaction_events(location_id) WHERE location_id IS NOT NULL;

-- ── 10. VENUE EVENTS (optional events/hotspots/rooms) ────────────────────────
CREATE TABLE IF NOT EXISTS venue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location_id UUID REFERENCES locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_events_location ON venue_events(location_id);
CREATE INDEX IF NOT EXISTS idx_venue_events_starts ON venue_events(starts_at);

CREATE TABLE IF NOT EXISTS venue_event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_event_id UUID NOT NULL REFERENCES venue_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_attendance_event ON venue_event_attendance(venue_event_id);
CREATE INDEX IF NOT EXISTS idx_venue_attendance_user ON venue_event_attendance(user_id);

-- Note: venue_event_id in user_connections and user_proximity_events references venue_events(id)
-- Added via separate ALTER if venue_events exists (run after venue_events created)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'venue_events') THEN
    ALTER TABLE user_connections DROP CONSTRAINT IF EXISTS fk_user_connections_venue_event;
    ALTER TABLE user_connections ADD CONSTRAINT fk_user_connections_venue_event
      FOREIGN KEY (venue_event_id) REFERENCES venue_events(id) ON DELETE SET NULL;
    ALTER TABLE user_proximity_events DROP CONSTRAINT IF EXISTS fk_proximity_venue_event;
    ALTER TABLE user_proximity_events ADD CONSTRAINT fk_proximity_venue_event
      FOREIGN KEY (venue_event_id) REFERENCES venue_events(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; -- ignore if columns/constraints already exist
END $$;
