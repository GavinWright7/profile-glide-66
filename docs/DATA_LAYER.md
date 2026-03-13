# Profile Glide — Proprietary Data Layer

## Why Neon for Durable Data

All durable user, profile, connection, proximity, location, and interaction data lives in **Neon (PostgreSQL)**. This is the single source of truth for:

- **Identity & profile** — users, profiles, interests
- **Connection graph** — explicit connections between users
- **Proximity graph** — passive co-presence (repeated nearby without connecting)
- **Location intelligence** — venues, visits, industry segments
- **Interaction funnel** — card_opened, profile_viewed, connect_clicked, etc.
- **Audit trail** — event history for analytics

Neon provides durability, horizontal scaling, and SQL analytics. This data becomes a **proprietary asset** that supports paid features and product differentiation.

---

## Why Redis Only for Temporary Presence

**Redis** holds only ephemeral, live state:

- Active sharing sessions (who is discoverable right now)
- Current lat/lng heartbeat
- GEO index for fast nearby lookup
- TTL-based expiration (no durable storage)

Redis is optimized for low-latency, high-throughput presence. Durable intelligence must not live only in Redis — it would be lost on restart and cannot scale for analytics.

---

## Data Moat

This design creates a **proprietary real-world professional interaction graph**:

1. **Explicit connections** — who actually connected, where, when
2. **Passive proximity** — who is repeatedly near whom (latent graph)
3. **Location intelligence** — which industries frequent which venues
4. **Interaction funnel** — who gets viewed/tapped most, conversion by location
5. **Visit patterns** — dwell time, discoverability by place

Future paid packages can answer:

- Which industries frequent this venue?
- Which users are constantly near each other?
- Which places produce the most real connections?
- Which passive proximity relationships later convert?

---

## Schema Summary

| Table | Purpose |
|-------|---------|
| `users` | Identity (LinkedIn subject, email) |
| `profiles` | full_name, headline, photo, linkedin_url, bio |
| `user_interests` | industry + subcategory (structured interest graph) |
| `user_connections` | Explicit connections (user_a, user_b, location, method) |
| `user_proximity_events` | Single co-presence events |
| `user_proximity_rollups` | Aggregate encounters, total minutes nearby |
| `locations` | Venues (lat/lng, geohash, address, venue_type) |
| `location_visits` | User visits to locations |
| `location_user_segments` | Industry/subcategory by location |
| `user_interaction_events` | Funnel events (nearby_seen, card_opened, etc.) |
| `venue_events` | Optional events/hotspots |
| `venue_event_attendance` | Who attended which event |

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/profile/interests-options` | Industries + subcategories |
| PUT | `/profile/interests` | Save interests (industry or {industry, subcategory}) |
| POST | `/interactions/event` | Record funnel event |
| POST | `/interactions/connect` | Record explicit connection |

---

## Migration Commands

```bash
cd server
node scripts/run-migration.js
```

Runs `001_initial_schema.sql` and `002_proprietary_data_layer.sql` in order.
