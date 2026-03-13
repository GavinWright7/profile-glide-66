/**
 * Redis client for live presence and geospatial nearby lookup.
 * Uses ioredis — compatible with Redis 6+ GEO commands.
 */
const Redis = require('ioredis');
const config = require('../config');

let client = null;

function getRedis() {
  if (!client) {
    if (!config.REDIS_URL) {
      throw new Error('REDIS_URL is not set');
    }
    client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
    });
    client.on('error', (err) => console.error('[redis]', err.message));
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
  redisRefreshTtl,
  redisHealthCheck,
};
