/**
 * Redis client for live presence and geospatial nearby lookup.
 * Uses ioredis — compatible with Redis 6+ GEO commands.
 * On Railway, REDIS_URL must point to the internal Redis service (not localhost).
 */
const Redis = require('ioredis');
const config = require('../config');

let client = null;
let initError = null;

function getRedis() {
  if (client) return client;
  if (initError) throw initError;

  if (!config.REDIS_URL) {
    initError = new Error('REDIS_URL is not set. Set it in Railway → Variables to your Redis service URL (e.g. redis://default:xxx@redis.railway.internal:6379).');
    console.error('[redis]', initError.message);
    throw initError;
  }

  if (config.REDIS_URL.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.error('[redis] REDIS_URL is localhost — this will not work on Railway. Use the internal Redis service URL from Railway → Variables.');
  }

  try {
    client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      connectTimeout: 5000,
    });
    client.on('error', (err) => console.error('[redis]', err.message));
    client.on('connect', () => console.log('[redis] connected'));
  } catch (err) {
    initError = err;
    console.error('[redis] Failed to create client:', err.message);
    throw new Error(`Redis unavailable: ${err.message}. Ensure REDIS_URL in Railway Variables points to your Redis service.`);
  }

  return client;
}

async function redisGeoAdd(userId, lat, lon) {
  const r = getRedis();
  await r.geoadd(config.REDIS_GEO_KEY, lon, lat, userId);
  await r.setex(`${config.REDIS_SESSION_PREFIX}${userId}`, config.REDIS_SESSION_TTL, Date.now().toString());
}

async function redisGeoRemove(userId) {
  const r = getRedis();
  await r.zrem(config.REDIS_GEO_KEY, userId);
  await r.del(`${config.REDIS_SESSION_PREFIX}${userId}`);
}

async function redisGeoSearch(lon, lat, radiusMeters, limit = 50) {
  const r = getRedis();
  const raw = await r.georadius(
    config.REDIS_GEO_KEY,
    lon,
    lat,
    radiusMeters,
    'm',
    'WITHDIST',
    'ASC',
    'COUNT',
    limit
  );
  return raw;
}

/** Same as redisGeoSearch but includes coordinates for each result. Returns [ [id, dist, [lon, lat]], ... ]. */
async function redisGeoSearchWithCoords(lon, lat, radiusMeters, limit = 50) {
  const r = getRedis();
  const raw = await r.georadius(
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
  );
  return raw;
}

async function redisRefreshTtl(userId) {
  const r = getRedis();
  await r.setex(`${config.REDIS_SESSION_PREFIX}${userId}`, config.REDIS_SESSION_TTL, Date.now().toString());
}

async function redisHealthCheck() {
  try {
    const r = getRedis();
    await r.ping();
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getRedis,
  redisGeoAdd,
  redisGeoRemove,
  redisGeoSearch,
  redisGeoSearchWithCoords,
  redisRefreshTtl,
  redisHealthCheck,
};
