/**
 * Redis client for live presence and geospatial nearby lookup.
 * Uses ioredis — compatible with Redis 6+ GEO commands.
 * On Railway, REDIS_URL must point to the internal Redis service (not localhost).
 */
const Redis = require('ioredis');
const config = require('../config');

const REDIS_COMMAND_TIMEOUT_MS = 3000;

let client = null;
let initError = null;

function withTimeout(promise, ms = REDIS_COMMAND_TIMEOUT_MS, label = 'Redis') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} operation timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function getRedis() {
  if (client) return client;
  if (initError) throw initError;

  if (!config.REDIS_URL) {
    initError = new Error(
      'REDIS_URL is not set. Set it in Railway → Variables to your Redis service URL (e.g. redis://default:xxx@redis.railway.internal:6379).'
    );
    console.error('[redis]', initError.message);
    throw initError;
  }

  if (config.REDIS_URL.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.error(
      '[redis] REDIS_URL is localhost — this will not work on Railway. Use the internal Redis service URL from Railway → Variables.'
    );
  }

  try {
    client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 200, 1000);
      },
      enableReadyCheck: false,
      connectTimeout: 3000,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    });
    client.on('error', (err) => console.error('[redis]', err.message));
    client.on('connect', () => console.log('[redis] connected'));
  } catch (err) {
    initError = err;
    console.error('[redis] Failed to create client:', err.message);
    throw new Error(
      `Redis unavailable: ${err.message}. Ensure REDIS_URL in Railway Variables points to your Redis service.`
    );
  }

  return client;
}

async function redisGeoAdd(userId, lat, lon) {
  const r = getRedis();
  await withTimeout(r.geoadd(config.REDIS_GEO_KEY, lon, lat, userId));
  await withTimeout(
    r.setex(`${config.REDIS_SESSION_PREFIX}${userId}`, config.REDIS_SESSION_TTL, Date.now().toString())
  );
}

async function redisGeoRemove(userId) {
  const r = getRedis();
  await withTimeout(r.zrem(config.REDIS_GEO_KEY, userId));
  await withTimeout(r.del(`${config.REDIS_SESSION_PREFIX}${userId}`));
}

async function redisGeoSearch(lon, lat, radiusMeters, limit = 50) {
  const r = getRedis();
  return withTimeout(
    r.georadius(
      config.REDIS_GEO_KEY,
      lon,
      lat,
      radiusMeters,
      'm',
      'WITHDIST',
      'ASC',
      'COUNT',
      limit
    )
  );
}

/** Same as redisGeoSearch but includes coordinates for each result. Returns [ [id, dist, [lon, lat]], ... ]. */
async function redisGeoSearchWithCoords(lon, lat, radiusMeters, limit = 50) {
  const r = getRedis();
  return withTimeout(
    r.georadius(
      config.REDIS_GEO_KEY,
      lon,
      lat,
      radiusMeters,
      'm',
      'WITHDIST',
      'WITHCOORD',
      'ASC',
      'COUNT',
      limit
    )
  );
}

async function redisRefreshTtl(userId) {
  const r = getRedis();
  await withTimeout(
    r.setex(`${config.REDIS_SESSION_PREFIX}${userId}`, config.REDIS_SESSION_TTL, Date.now().toString())
  );
}

async function redisHealthCheck() {
  try {
    const r = getRedis();
    await withTimeout(r.ping(), REDIS_COMMAND_TIMEOUT_MS, 'Redis ping');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getRedis,
  withTimeout,
  redisGeoAdd,
  redisGeoRemove,
  redisGeoSearch,
  redisGeoSearchWithCoords,
  redisRefreshTtl,
  redisHealthCheck,
  REDIS_COMMAND_TIMEOUT_MS,
};
