/**
 * sharing.js — live presence + location-based nearby discovery.
 *
 * Storage: Redis GEO for nearby lookup, Neon for profiles/interests.
 * A user is "visible" when in Redis GEO and session TTL is fresh.
 * Nearby: Redis GEO → user IDs + distances → Neon profiles → merge.
 * Sort: distance (default) or relevance (matching interests).
 */

const config = require('../config');
const redis = require('../services/redis');
const userService = require('../services/userService');
const interactionService = require('../services/interactionService');
const locationService = require('../services/locationService');
const interestService = require('../services/interestService');
const premiumService = require('../services/premiumService');

const MAX_DISTANCE_METERS = config.MAX_DISTANCE_METERS;
const MAX_DISTANCE_METERS_PREMIUM = config.MAX_DISTANCE_METERS_PREMIUM || 609.6;

/** In-memory store of exact coordinates per userId. Populated by heartbeat and startSharing. */
const exactCoords = new Map();

function parseCoord(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/**
 * POST /sharing/start
 * Body: { latitude, longitude }
 * Registers the authenticated user as actively sharing in Redis GEO.
 */
async function startSharing(req, res) {
  const { latitude, longitude } = req.body;
  const lat = parseCoord(latitude);
  const lon = parseCoord(longitude);

  if (lat === null || lon === null) {
    return res.status(400).json({ error: 'latitude and longitude are required numbers' });
  }

  const userId = req.userId;

  try {
    await redis.redisGeoAdd(userId, lat, lon);
    exactCoords.set(userId, { latitude: lat, longitude: lon });
    const dbUserId = await interestService.resolveUserId(userId);
    if (dbUserId) {
      const loc = await locationService.findOrCreateLocation({ latitude: lat, longitude: lon });
      await locationService.recordVisit(dbUserId, loc.id, { wasDiscoverable: true });
    }
    console.log(
      `[sharing] start  userId=${userId} lat=${lat.toFixed(5)} lon=${lon.toFixed(5)}`
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[sharing] start error:', err.message);
    res.status(500).json({ error: 'Failed to start sharing' });
  }
}

/**
 * POST /sharing/heartbeat
 * Body: { latitude, longitude }
 * Updates position in Redis GEO and refreshes session TTL.
 */
async function heartbeat(req, res) {
  const { latitude, longitude } = req.body;
  const lat = parseCoord(latitude);
  const lon = parseCoord(longitude);

  if (lat === null || lon === null) {
    return res.status(400).json({ error: 'latitude and longitude are required numbers' });
  }

  const userId = req.userId;

  try {
    await redis.redisGeoAdd(userId, lat, lon);
    exactCoords.set(userId, { latitude: lat, longitude: lon });
    await redis.redisRefreshTtl(userId);
    res.json({ success: true, lastHeartbeatAt: new Date().toISOString() });
  } catch (err) {
    console.error('[sharing] heartbeat error:', err.message);
    res.status(500).json({ error: 'Failed to update heartbeat' });
  }
}

/**
 * POST /sharing/stop
 * Removes the user from Redis GEO.
 */
async function stopSharing(req, res) {
  const userId = req.userId;

  try {
    await redis.redisGeoRemove(userId);
    exactCoords.delete(userId);
    console.log(`[sharing] stop   userId=${userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[sharing] stop error:', err.message);
    res.status(500).json({ error: 'Failed to stop sharing' });
  }
}

/**
 * Compute relevance score: number of matching interests.
 */
function computeRelevanceScore(myInterests, theirInterests) {
  if (!myInterests?.length || !theirInterests?.length) return 0;
  const set = new Set((theirInterests || []).map((i) => String(i).toLowerCase()));
  return (myInterests || []).filter((i) => set.has(String(i).toLowerCase())).length;
}

/**
 * GET /sharing/nearby?latitude=<lat>&longitude=<lon>&sort=distance|relevance&radiusMeters=&filterIndustries=&filterSubcategories=
 * Returns active users within radius (500ft free, 2000ft premium).
 * sort=relevance, filters: premium only. filterIndustries/filterSubcategories: comma-separated.
 */
async function getNearby(req, res) {
  const lat = parseCoord(req.query.latitude);
  const lon = parseCoord(req.query.longitude);
  const sort = (req.query.sort || 'distance').toLowerCase();
  const radiusParam = parseFloat(req.query.radiusMeters);
  const filterIndustries = req.query.filterIndustries
    ? req.query.filterIndustries.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const filterSubcategories = req.query.filterSubcategories
    ? req.query.filterSubcategories.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (lat === null || lon === null) {
    return res.status(400).json({ error: 'latitude and longitude query params required' });
  }

  const userId = req.userId;

  try {
    const isPremium = await premiumService.hasPremiumAccess(userId);

    const maxRadius = isPremium ? MAX_DISTANCE_METERS_PREMIUM : MAX_DISTANCE_METERS;
    let radiusMeters = Number.isFinite(radiusParam) ? radiusParam : maxRadius;
    if (radiusMeters > maxRadius) {
      return res.status(403).json({ error: 'Premium required for expanded range', requiresPremium: true });
    }
    radiusMeters = Math.min(radiusMeters, maxRadius);

    const validSort = ['distance', 'relevance'].includes(sort) ? sort : 'distance';
    if (validSort === 'relevance' && !isPremium) {
      return res.status(403).json({ error: 'Premium required for relevance sorting', requiresPremium: true });
    }

    const hasFilters = filterIndustries.length > 0 || filterSubcategories.length > 0;
    if (hasFilters && !isPremium) {
      return res.status(403).json({ error: 'Premium required for radar filters', requiresPremium: true });
    }

    const raw = await redis.redisGeoSearchWithCoords(lon, lat, radiusMeters, 50);
    const allEntries = Array.isArray(raw)
      ? raw.map((r) => {
          if (!Array.isArray(r)) return [r, 0, null];
          const id = r[0];
          const dist = parseFloat(r[1]) || 0;
          const coord = r[2];
          const latLng = coord && Array.isArray(coord) && coord.length >= 2
            ? { latitude: parseFloat(coord[1]), longitude: parseFloat(coord[0]) }
            : null;
          return [id, dist, latLng];
        })
      : [];

    const r = redis.getRedis();
    const entries = [];
    for (const [id, dist, latLng] of allEntries) {
      if (!id || id === userId) continue;
      const hasSession = await r.exists(`${config.REDIS_SESSION_PREFIX}${id}`);
      if (hasSession) entries.push([id, dist, latLng]);
    }

    const nearbyUserIds = entries.map(([id]) => id);
    if (nearbyUserIds.length === 0) {
      return res.json({ users: [], count: 0 });
    }

    const profiles = await userService.getProfilesByUserIds(nearbyUserIds);
    const profileByUserId = Object.fromEntries(
      profiles.map((p) => [p.linkedin_subject_id, p])
    );

    const myProfile = await userService.getProfileByLinkedInId(userId);
    const myInterests = myProfile?.interests || [];

    let users = entries
      .filter(([id]) => id !== userId)
      .map(([id, dist, latLng]) => {
        const profile = profileByUserId[id];
        const interests = profile?.interests || [];
        const relevanceScore = computeRelevanceScore(myInterests, interests);
        const headline = profile?.headline || '';
        const jobTitle = headline.split(' at ')[0]?.trim() || '';
        const u = {
          userId: id,
          fullName: profile?.full_name || '',
          headline,
          jobTitle,
          photoUrl: profile?.photo_url || '',
          linkedinUrl: profile?.linkedin_url || '',
          distanceMeters: Math.round(dist),
          interests: interests,
          relevanceScore,
        };
        const precise = exactCoords.get(id);
        if (precise) {
          u.latitude = precise.latitude;
          u.longitude = precise.longitude;
        } else if (latLng) {
          u.latitude = latLng.latitude;
          u.longitude = latLng.longitude;
        }
        return u;
      });

    if (hasFilters) {
      users = users.filter((u) => {
        const interests = (u.interests || []).map((i) => String(i).toLowerCase());
        if (filterIndustries.length > 0) {
          const matchIndustry = filterIndustries.some((f) =>
            interests.some((i) => i.includes(f.toLowerCase()))
          );
          if (!matchIndustry) return false;
        }
        if (filterSubcategories.length > 0) {
          const matchSub = filterSubcategories.some((f) =>
            interests.some((i) => i.includes(f.toLowerCase()))
          );
          if (!matchSub) return false;
        }
        return true;
      });
    }

    if (validSort === 'relevance') {
      users.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else {
      users.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    const actorUserId = await interestService.resolveUserId(userId);
    if (actorUserId) {
      for (const u of users) {
        const targetProfile = profileByUserId[u.userId];
        const targetUserId = targetProfile?.user_uuid;
        if (targetUserId) {
          interactionService.recordInteraction(actorUserId, targetUserId, 'nearby_seen', {
            latitude: lat,
            longitude: lon,
          }).catch(() => {});
        }
      }
    }

    res.json({ users, count: users.length });
  } catch (err) {
    console.error('[sharing] nearby error:', err.message);
    res.status(500).json({ error: 'Failed to fetch nearby users' });
  }
}

/**
 * GET /sharing/debug (no auth — dev convenience)
 */
async function debugSessions(req, res) {
  try {
    const r = redis.getRedis();
    const geo = await r.zrange(config.REDIS_GEO_KEY, 0, -1, 'WITHSCORES');
    res.json({ geoKeys: geo?.length || 0, note: 'Redis GEO keys (user ids)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { startSharing, heartbeat, stopSharing, getNearby, debugSessions };
