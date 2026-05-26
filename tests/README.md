# AirLinks Infrastructure Test Suite

Automated stress and load tests for the production backend (`LOADTEST_BASE_URL`) and discovery pipeline. All scripts use Node.js built-ins (Node 18+ recommended) with native `fetch`.

## Prerequisites

1. **Node.js 18+** (native `fetch`)
2. **Valid JWT** from a signed-in AirLinks session (not demo/Apple Tester)
3. **Optional:** `LOADTEST_JWT_SECRET` — signs a properly expired JWT for token-expiry tests (falls back to invalid signature if unset)
4. **Artillery** (installed automatically by `run-load-test.sh` if missing)

## Environment variables

```bash
export LOADTEST_JWT_TOKEN=your_jwt_token_here
export LOADTEST_BASE_URL=https://reliable-connection-production.up.railway.app
```

Optional overrides:

| Variable | Default | Used by |
|----------|---------|---------|
| `LOADTEST_JWT_SECRET` | — | Token expiry test (proper expired JWT) |
| `LOADTEST_PERSISTENCE_WAIT_MS` | `600000` (10 min) | Background persistence test |
| `LOADTEST_HEARTBEAT_USERS` | `1` | Heartbeat stress (use 1 for single-user; >1 shares one rate-limit bucket) |
| `LOADTEST_HEARTBEAT_DURATION_MS` | `120000` | Heartbeat stress |
| `LOADTEST_DB_CONCURRENCY` | `200` | DB connection test |

## Run all tests

```bash
# Set your token first
export LOADTEST_JWT_TOKEN=your_jwt_token_here
export LOADTEST_BASE_URL=https://reliable-connection-production.up.railway.app

node tests/run-all-tests.cjs
```

**Note:** The full suite takes ~12+ minutes (background persistence waits 10 minutes). Reports are written to `tests/reports/`.

## Run individual tests

```bash
node tests/stress/heartbeat-stress.cjs
node tests/stress/rate-limit-test.cjs
node tests/stress/db-connection-test.cjs
node tests/stress/background-persistence-test.cjs
node tests/stress/token-expiry-test.cjs
node tests/stress/concurrent-toggle-test.cjs
bash tests/load/run-load-test.sh
```

## What each test checks

### Artillery load test (`tests/load/`)

- **Phases:** 60s warmup @ 10 req/s → 120s ramp to 100 req/s → 60s spike @ 500 req/s
- **Scenarios:** heartbeat loop, nearby poll, discoverable toggle
- **PASS:** p95 ≤ 500ms and error rate ≤ 5%
- **FAIL:** Check Railway **Metrics → Response time p95**, **HTTP 5xx rate**, and deploy logs for OOM/timeouts

### Heartbeat stress (`tests/stress/heartbeat-stress.cjs`)

- Default: **1 virtual client**, heartbeat every 3s for 2 minutes (~20/min vs 60/min limit)
- With `LOADTEST_HEARTBEAT_USERS>1` and one token: 429s are expected (shared rate-limit bucket); only 500s fail the run
- **PASS (single user):** No 500 errors and success rate ≥ 50%
- **FAIL:** Check Railway logs for `[sharing] heartbeat error`, Redis timeouts, or DB pool exhaustion

### Rate limit protection (`tests/stress/rate-limit-test.cjs`)

- 50 rapid heartbeats, 50 rapid nearby polls, 20 rapid discoverable toggles
- **PASS:** Over-limit responses are **429**, never **500**
- **FAIL:** Check `server/middleware/rateLimit.js` and Railway logs for unhandled exceptions in limiter middleware

### DB connection pool (`tests/stress/db-connection-test.cjs`)

- 200 concurrent `GET /sharing/nearby` requests
- Validates `GET /debug/discovery-state` returns `discoverable > 0`, `has_location > 0`, `recent > 0`
- **PASS:** No connection errors, no 5xx, discovery counts healthy
- **FAIL:** Check Neon **Connections** dashboard, Railway logs for `[db] query error`, and run:

```sql
SELECT COUNT(*) FILTER (WHERE is_discoverable) AS discoverable,
       COUNT(*) FILTER (WHERE last_latitude IS NOT NULL) AS has_location,
       COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours') AS recent
FROM profiles;
```

### Background persistence (`tests/stress/background-persistence-test.cjs`)

- Sets user discoverable + heartbeat, waits 10 minutes idle, re-checks 24h window
- **PASS:** `recent > 0` and last heartbeat age < 24 hours
- **FAIL:** Check `profiles.last_seen_at`, `is_discoverable`, and Railway `[heartbeat]` / `[persistUserLocation]` logs

### Token expiry handling (`tests/stress/token-expiry-test.cjs`)

- Expired JWT → heartbeat, nearby, discoverable must return **401**
- Valid JWT → same endpoints return **200** (or **429** if rate limited)
- **PASS:** No 500 on auth failures
- **FAIL:** Check `server/middleware/auth.js` and `JWT_SECRET` consistency on Railway

### Concurrent toggle (`tests/stress/concurrent-toggle-test.cjs`)

- 20 simultaneous `PATCH /profile/discoverable` (mix true/false)
- **PASS:** Only 200/429, no 500; discovery-state counts remain consistent
- **FAIL:** Check Neon row for your user’s `is_discoverable` and profile controller logs

## Reports

JSON reports are saved to `tests/reports/` (gitignored):

```
tests/reports/load-20260519-120000.json
tests/reports/heartbeat-stress-2026-05-19T12-00-00-000Z.json
...
```

Each report includes `passed`, `durationMs`, `keyMetric`, and failure details.

## Getting a JWT token

1. Sign in to the app (TestFlight or local build against production)
2. Copy the token from secure storage / debug panel, or decode from network requests (`Authorization: Bearer …`)
3. Export as `LOADTEST_JWT_TOKEN`

Tokens expire after 7 days — refresh if tests return 401 on valid-token checks.

## Production safety

These tests hit **production** when `LOADTEST_BASE_URL` points at Railway. They will:

- Consume rate limits for your test user
- Write heartbeats and discoverable state to Neon
- Generate significant load during Artillery spike phase

Use a dedicated test account, not your primary profile, when running the full suite.
