# Migration Plan: In-Memory → Neon + Redis

## Old Architecture (Limitations)

### In-memory storage
- **sessions** `Map`: userId → session (location, heartbeat, profile snapshot)
- **profileStore** `Map`: userId → { linkedin_url }
- Data lost on restart
- Single process cannot hold 100k+ sessions in RAM
- Cannot scale horizontally (each instance has its own memory)

### No database
- `linkedin_url`, interests, and profile data not persisted
- No durable user records, audit trail, or analytics foundation

### Performance
- `getNearby` looped over all sessions O(n)
- With 100k+ users: slow and CPU-heavy
- Heartbeats every 10–15s from many users = very high request volume

### Single server
- No load balancing, replication, or failover
- One process handles all traffic

---

## New Architecture

### Database: Neon (PostgreSQL)
- **users**: identity (linkedin_subject_id, email)
- **profiles**: full_name, headline, photo_url, linkedin_url, interests (TEXT[])
- **events**: optional audit/analytics
- GIN index on `profiles.interests` for relevance queries

### Session / presence: Redis
- **GEO set** (`pg:active:geo`): userId → (lon, lat) for nearby lookup
- **Session keys** (`pg:session:{userId}`): TTL 60s, refreshed on heartbeat
- Nearby: Redis GEO → user IDs + distances → filter by session TTL → Neon profiles

### Flow
1. `POST /sharing/start`: add user to Redis GEO, set session TTL
2. `POST /sharing/heartbeat`: update GEO position, refresh TTL
3. `POST /sharing/stop`: remove from Redis GEO
4. `GET /sharing/nearby`: Redis GEO → filter by session → Neon profiles → merge, sort by distance or relevance

---

## Code Changes

### Removed
- `server/controllers/sharing.js`: in-memory `sessions` Map
- `server/controllers/profile.js`: in-memory `profileStore` Map
- `server/controllers/linkedinAuth.js`: `getProfileStore()` usage

### Added
- `server/services/db.js` — Neon/pg connection pool
- `server/services/redis.js` — Redis GEO + session TTL
- `server/services/userService.js` — user/profile/interest persistence
- `server/middleware/rateLimit.js` — rate limiting for sharing endpoints
- `server/constants/interests.js` — allowed interest options
- `server/migrations/001_initial_schema.sql` — schema
- `server/scripts/run-migration.js` — migration runner

### Modified
- `server/controllers/linkedinAuth.js` — upsert user/profile in Neon
- `server/controllers/profile.js` — use userService, add interests
- `server/controllers/sharing.js` — Redis GEO + Neon profiles
- `server/server.js` — require DATABASE_URL, REDIS_URL, health check
- `server/routes/profile.js` — add PUT /interests, GET /interests-options
- `server/routes/sharing.js` — rate limiter

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | Neon PostgreSQL connection string |
| REDIS_URL | Yes | Redis connection string (e.g. redis://localhost:6379) |
| JWT_SECRET | Yes | JWT signing secret |
| LINKEDIN_CLIENT_ID | Yes | LinkedIn OAuth app client ID |
| LINKEDIN_CLIENT_SECRET | Yes | LinkedIn OAuth app client secret |
| LINKEDIN_REDIRECT_URI | Yes | OAuth callback URL |
| PORT | No | Server port (default 3001) |

---

## Commands

```bash
# Install dependencies
cd server && npm install

# Run migration (requires DATABASE_URL)
node scripts/run-migration.js

# Start server (requires DATABASE_URL, REDIS_URL, etc.)
npm run dev
```

---

## Why Neon + Redis Improves Scalability

1. **Neon**: Durable storage for users, profiles, interests. Horizontal scaling: multiple app instances share the same DB. Connection pooling, serverless-friendly.
2. **Redis**: O(log n) GEO queries instead of O(n) in-memory loops. Session TTL for automatic cleanup. Shared across instances.
3. **Horizontal scaling**: No server-local state. Any instance can serve any request. Load balancer can distribute traffic.

## Why Neon Fits

- PostgreSQL-compatible (standard SQL, GIN indexes for interests)
- Serverless/connection pooling built-in
- No MongoDB required; schema is relational
- Geospatial: Redis handles live nearby; Neon stores durable data
