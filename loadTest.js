import { createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

// Usage examples:
//   USER_COUNT=500 node loadTest.js
//   USER_COUNT=1000 node loadTest.js
//   USER_COUNT=5000 node loadTest.js
//   USER_COUNT=10000 node loadTest.js

let fetchImpl = globalThis.fetch;
if (!fetchImpl) {
  try {
    ({ default: fetchImpl } = await import('node-fetch'));
  } catch (error) {
    console.error(
      'Native fetch is unavailable and optional dependency node-fetch could not be loaded. Install node-fetch or upgrade to Node 18+.'
    );
    process.exit(1);
  }
}

const BASE_URL = process.env.LOADTEST_BASE_URL ?? 'http://localhost:3001';
const STAGE_LEVELS = [500, 1000, 2500, 5000, 10000];
const USER_COUNT = resolveUserCount();
const HEARTBEAT_INTERVAL_MS = parseEnvInt('LOADTEST_INTERVAL_MS', 5000);
const TEST_DURATION_MS = parseEnvInt('LOADTEST_DURATION_MS', 60000);
const BASE_LATITUDE = parseEnvFloat('LOADTEST_LATITUDE', 40.7128);
const BASE_LONGITUDE = parseEnvFloat('LOADTEST_LONGITUDE', -74.0060);
const JITTER_METERS = parseEnvFloat('LOADTEST_JITTER_METERS', 75);
const JWT_SECRET = process.env.LOADTEST_JWT_SECRET;
const MOVING_USER_RATIO = parseEnvFloat('LOADTEST_MOVING_RATIO', 0.15);
const REQUEST_TIMEOUT_MS = parseEnvInt('LOADTEST_REQUEST_TIMEOUT_MS', 10000);

const RAMP_USERS_PER_SEC = resolveRampRate();
const USERS_PER_BATCH = Math.max(1, RAMP_USERS_PER_SEC);
const BATCH_INTERVAL_MS = 1000;
const REQUEST_JITTER_MAX_MS = 500;

const ENDPOINTS = {
  START: 'start',
  HEARTBEAT: 'heartbeat',
  KEEPALIVE: 'keepalive',
  NEARBY: 'nearby',
};

const metrics = {
  totalRequests: 0,
  failedRequests: 0,
  latenciesMs: [],
  endpointStats: {
    [ENDPOINTS.START]: createEndpointMetrics(),
    [ENDPOINTS.HEARTBEAT]: createEndpointMetrics(),
    [ENDPOINTS.KEEPALIVE]: createEndpointMetrics(),
    [ENDPOINTS.NEARBY]: createEndpointMetrics(),
  },
  failureBuckets: {
    connection: 0,
    auth: 0,
    rateLimit: 0,
    server: 0,
    timeout: 0,
  },
  failures: [],
  concurrency: { current: 0, max: 0 },
  startTimeMs: 0,
  endTimeMs: 0,
};

let stopTime = Date.now() + TEST_DURATION_MS;
let interrupted = false;

process.on('SIGINT', () => {
  if (!interrupted) {
    interrupted = true;
    stopTime = Date.now();
    console.warn('\nStopping load test early (SIGINT received)...');
  } else {
    process.exit(1);
  }
});

function parseEnvInt(key, fallback) {
  const raw = process.env[key];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseEnvFloat(key, fallback) {
  const raw = process.env[key];
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCliValue(flags) {
  const variants = Array.isArray(flags) ? flags : [flags];
  const argv = process.argv.slice(2);
  for (const flag of variants) {
    const prefix = `${flag}=`;
    for (const arg of argv) {
      if (arg.startsWith(prefix)) {
        return arg.slice(prefix.length);
      }
    }
    const idx = argv.indexOf(flag);
    if (idx !== -1 && idx + 1 < argv.length) {
      return argv[idx + 1];
    }
  }
  return null;
}

function resolveUserCount() {
  const cliValue = getCliValue(['--users', '--user-count']);
  const envValue = process.env.USER_COUNT ?? process.env.LOADTEST_USERS;
  const parsed = cliValue ?? envValue;
  const n = parsed ? parseInt(parsed, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return STAGE_LEVELS[0];
}

function resolveRampRate() {
  const cliValue = getCliValue(['--ramp', '--ramp-rate']);
  const envValue = process.env.RAMP_USERS_PER_SEC ?? process.env.LOADTEST_RAMP_USERS_PER_SEC;
  const parsed = cliValue ?? envValue;
  const n = parsed ? parseInt(parsed, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return 50;
}

function logFetchErrorDetails(error, context) {
  const details = {
    context,
    name: error?.name,
    message: error?.message,
    code: error?.code,
    cause: error?.cause,
    stack: error?.stack,
  };
  console.error('[FETCH ERROR]', details);
}

async function fetchWithDetailedErrors(url, init, context = {}) {
  try {
    return await fetchImpl(url, init);
  } catch (error) {
    logFetchErrorDetails(error, { url: url.toString(), method: init?.method || 'GET', ...context });
    throw error;
  }
}

function base64UrlEncode(obj) {
  return Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJwtToken(payload, secret) {
  if (!secret) return null;
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${unsigned}.${signature}`;
}

function randomOffsetMeters(rangeMeters) {
  const r = rangeMeters * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  return { r, theta };
}

function applyOffset(lat, lon, rangeMeters) {
  if (rangeMeters <= 0) return { latitude: lat, longitude: lon };
  const { r, theta } = randomOffsetMeters(rangeMeters);
  const deltaLat = (r * Math.cos(theta)) / 111320;
  const deltaLon = (r * Math.sin(theta)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    latitude: lat + deltaLat,
    longitude: lon + deltaLon,
  };
}

function createEndpointMetrics() {
  return {
    count: 0,
    failures: 0,
    latencies: [],
  };
}

function ensureEndpointStats(key) {
  if (!metrics.endpointStats[key]) {
    metrics.endpointStats[key] = createEndpointMetrics();
  }
  return metrics.endpointStats[key];
}

function categorizeFailure(status) {
  if (status === 401 || status === 403) {
    metrics.failureBuckets.auth += 1;
  } else if (status === 429) {
    metrics.failureBuckets.rateLimit += 1;
  } else if (status >= 500 && status < 600) {
    metrics.failureBuckets.server += 1;
  }
}

function isTimeoutError(error) {
  if (!error) return false;
  if (error.name === 'TimeoutError') return true;
  if (error.name === 'AbortError') return true;
  if (error.code === 'ABORT_ERR') return true;
  if (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout')) {
    return true;
  }
  return false;
}

async function sendRequest({ method, path, query, body, headers, userId, endpoint }) {
  if (REQUEST_JITTER_MAX_MS > 0) {
    const jitter = Math.random() * REQUEST_JITTER_MAX_MS;
    await delay(jitter);
  }

  const url = new URL(path, BASE_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const init = { method, headers: headers ?? {} };
  if (body) {
    init.body = JSON.stringify(body);
  }
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    init.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  const endpointKey = endpoint ?? 'unknown';
  const endpointStats = ensureEndpointStats(endpointKey);
  metrics.totalRequests += 1;
  endpointStats.count += 1;
  metrics.concurrency.current += 1;
  metrics.concurrency.max = Math.max(metrics.concurrency.max, metrics.concurrency.current);

  const startTime = performance.now();
  try {
    const response = await fetchWithDetailedErrors(url, init, { userId, path: `${url.pathname}${url.search}` });
    const duration = performance.now() - startTime;
    metrics.latenciesMs.push(duration);
    endpointStats.latencies.push(duration);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const failure = {
        userId,
        path: `${url.pathname}${url.search}`,
        status: response.status,
        body: errorText,
      };
      metrics.failedRequests += 1;
      metrics.failures.push(failure);
      endpointStats.failures += 1;
      console.error('[FAIL]', failure);
      categorizeFailure(response.status);
    }
  } catch (error) {
    const failure = {
      userId,
      path: `${url.pathname}${url.search}`,
      error: error.message,
    };
    metrics.failedRequests += 1;
    metrics.failures.push(failure);
    endpointStats.failures += 1;
    console.error('[ERROR]', failure);
    if (isTimeoutError(error)) {
      metrics.failureBuckets.timeout += 1;
    } else {
      metrics.failureBuckets.connection += 1;
    }
  } finally {
    metrics.concurrency.current = Math.max(0, metrics.concurrency.current - 1);
  }
}

function buildUserHeaders(userId) {
  const jwt =
    createJwtToken(
      {
        userId,
        user: { id: userId },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      JWT_SECRET,
    ) || null;
  const token = jwt ?? `fake-token-${randomUUID()}`;
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-user-id': userId,
      'x-session-id': randomUUID(),
    },
    tokenIsSigned: Boolean(jwt),
  };
}

async function runUser(index) {
  const userId = `loadtest-user-${index + 1}`;
  const { headers } = buildUserHeaders(userId);

  let coords = applyOffset(BASE_LATITUDE, BASE_LONGITUDE, JITTER_METERS);
  const isMoving = Math.random() < MOVING_USER_RATIO;
  const heartbeatPath = isMoving ? '/sharing/heartbeat' : '/sharing/heartbeat/keepalive';
  const heartbeatEndpoint = isMoving ? ENDPOINTS.HEARTBEAT : ENDPOINTS.KEEPALIVE;

  await sendRequest({
    method: 'POST',
    path: '/sharing/start',
    body: { latitude: coords.latitude, longitude: coords.longitude },
    headers,
    userId,
    endpoint: ENDPOINTS.START,
  });

  while (Date.now() < stopTime) {
    await delay(HEARTBEAT_INTERVAL_MS);
    if (Date.now() >= stopTime) break;
    if (isMoving) {
      coords = applyOffset(coords.latitude, coords.longitude, JITTER_METERS / 2);
      await sendRequest({
        method: 'POST',
        path: heartbeatPath,
        body: { latitude: coords.latitude, longitude: coords.longitude },
        headers,
        userId,
        endpoint: heartbeatEndpoint,
      });
    } else {
      await sendRequest({
        method: 'POST',
        path: heartbeatPath,
        headers,
        userId,
        endpoint: heartbeatEndpoint,
      });
    }
    await sendRequest({
      method: 'GET',
      path: '/sharing/nearby',
      query: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        sort: 'distance',
      },
      headers,
      userId,
      endpoint: ENDPOINTS.NEARBY,
    });
  }
}

async function verifyHealthEndpoint() {
  const healthUrl = new URL('/health', BASE_URL);
  console.log(`[health] Checking ${healthUrl.toString()}`);
  const response = await fetchWithDetailedErrors(healthUrl, { method: 'GET' }, { type: 'health' });
  const bodyText = await response.text().catch(() => '');
  console.log(`[health] status=${response.status}`);
  console.log(`[health] body=${bodyText || '(empty)'}`);
  if (!response.ok) {
    throw new Error('Health check failed, aborting load test.');
  }
}

async function runSmokeTest() {
  console.log('[smoke] Running single-user /sharing/start test...');
  const userId = 'loadtest-smoke-user';
  const { headers, tokenIsSigned } = buildUserHeaders(userId);
  logStartHeaders(headers);
  logAuthorizationStatus(headers.Authorization, tokenIsSigned);

  const coords = applyOffset(BASE_LATITUDE, BASE_LONGITUDE, JITTER_METERS);
  const url = new URL('/sharing/start', BASE_URL);
  const init = {
    method: 'POST',
    headers,
    body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
  };
  const response = await fetchWithDetailedErrors(url, init, { type: 'smoke', userId });
  const bodyText = await response.text().catch(() => '');
  console.log(`[smoke] /sharing/start status: ${response.status}`);
  console.log(`[smoke] /sharing/start body: ${bodyText || '(empty)'}`);

  if (!response.ok) {
    throw new Error('Smoke test failed, aborting load test.');
  }
}

function computeLatencyPercentiles(values) {
  if (!values.length) {
    return { p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: percentileFromSorted(sorted, 0.5),
    p95: percentileFromSorted(sorted, 0.95),
    p99: percentileFromSorted(sorted, 0.99),
  };
}

function percentileFromSorted(sorted, fraction) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)));
  return sorted[idx];
}

function average(values) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

function formatLatency(ms) {
  return `${ms.toFixed(2)} ms`;
}

function printSummary() {
  const durationSeconds = Math.max((metrics.endTimeMs - metrics.startTimeMs) / 1000, 0);
  const avgLatency = average(metrics.latenciesMs);
  const { p50, p95, p99 } = computeLatencyPercentiles(metrics.latenciesMs);
  const requestsPerSecond = durationSeconds > 0 ? metrics.totalRequests / durationSeconds : 0;

  console.log('\nLoad test complete');
  console.log('===================');
  console.log(`Duration: ${durationSeconds.toFixed(1)}s`);
  console.log(`Target users: ${USER_COUNT}`);
  console.log(`Ramp rate: ${RAMP_USERS_PER_SEC} users/sec`);
  console.log(`Total requests: ${metrics.totalRequests}`);
  console.log(`Failed requests: ${metrics.failedRequests}`);
  console.log(`Requests/sec: ${requestsPerSecond.toFixed(1)}`);
  console.log(`Max in-flight requests: ${metrics.concurrency.max}`);
  console.log(`Latency avg/p50/p95/p99: ${formatLatency(avgLatency)} / ${formatLatency(p50)} / ${formatLatency(p95)} / ${formatLatency(p99)}`);
  console.log('Failures by category:');
  console.log(` - Connection failures: ${metrics.failureBuckets.connection}`);
  console.log(` - HTTP 401/403 failures: ${metrics.failureBuckets.auth}`);
  console.log(` - HTTP 429 failures: ${metrics.failureBuckets.rateLimit}`);
  console.log(` - HTTP 5xx failures: ${metrics.failureBuckets.server}`);
  console.log(` - Timeout failures: ${metrics.failureBuckets.timeout}`);

  console.log('\nPer-endpoint stats:');
  Object.entries(metrics.endpointStats).forEach(([endpointName, data]) => {
    const percentiles = computeLatencyPercentiles(data.latencies);
    const avg = average(data.latencies);
    console.log(
      ` ${endpointName.padEnd(12)} count=${data.count} failures=${data.failures} avg=${formatLatency(avg)} p50=${formatLatency(
        percentiles.p50
      )} p95=${formatLatency(percentiles.p95)} p99=${formatLatency(percentiles.p99)}`
    );
  });

  if (metrics.failures.length) {
    console.log('\nSample failures:');
    metrics.failures.slice(0, 5).forEach((failure) => console.log(failure));
  }
}

async function main() {
  console.log(`Using base URL: ${BASE_URL}`);
  console.log('Starting sharing load test with config:', {
    BASE_URL,
    USER_COUNT,
    HEARTBEAT_INTERVAL_MS,
    TEST_DURATION_MS,
    RAMP_USERS_PER_SEC,
  });
  await verifyHealthEndpoint();
  await runSmokeTest();
  console.log('[main] Connectivity checks passed. Starting ramped load test...');
  const startedAt = Date.now();
  metrics.startTimeMs = startedAt;
  stopTime = startedAt + TEST_DURATION_MS;
  await startUsersWithRamp();
  metrics.endTimeMs = Date.now();
  printSummary();
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});

async function startUsersWithRamp() {
  const userPromises = [];
  let launched = 0;

  while (launched < USER_COUNT) {
    const batchSize = Math.min(USERS_PER_BATCH, USER_COUNT - launched);
    for (let i = 0; i < batchSize; i++) {
      const userIndex = launched + i;
      userPromises.push(runUser(userIndex));
    }
    launched += batchSize;

    if (launched < USER_COUNT) {
      await delay(BATCH_INTERVAL_MS);
    }
  }

  await Promise.all(userPromises);
}

function logStartHeaders(headers) {
  const sanitized = { ...headers };
  if ('Authorization' in sanitized) {
    sanitized.Authorization = headers.Authorization ? '(present)' : '(missing)';
  }
  console.log('[smoke] /sharing/start headers:', sanitized);
}

function logAuthorizationStatus(authHeader, tokenIsSigned) {
  if (!authHeader) {
    console.log('[smoke] Authorization header missing.');
    return;
  }
  const hasBearer = authHeader.startsWith('Bearer ');
  const tokenDescription = tokenIsSigned ? 'signed JWT from LOADTEST_JWT_SECRET' : 'fake placeholder token';
  console.log(
    `[smoke] Authorization header ${hasBearer ? 'contains' : 'does NOT contain'} a Bearer token (${tokenDescription}).`
  );
}
