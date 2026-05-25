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
const locationService = require('../services/locationService');
const interestService = require('../services/interestService');
const premiumService = require('../services/premiumService');

const MAX_DISTANCE_METERS = config.MAX_DISTANCE_METERS;
const MAX_DISTANCE_METERS_PREMIUM = config.MAX_DISTANCE_METERS_PREMIUM || 609.6;
const PROFILE_CACHE_TTL = 300;
const EMPTY_PROFILE_CACHE_TTL = 60;

/** In-memory store of exact coordinates per userId. Populated by heartbeat and startSharing. */
const exactCoords = new Map();

async function cacheUserProfile(r, userId, profile, ttl = PROFILE_CACHE_TTL) {
  try {
    await redis.withTimeout(r.setex(`pg:profile:${userId}`, ttl, JSON.stringify(profile)));
  } catch {}
}

async function getCachedProfile(r, userId) {
  try {
    const raw = await redis.withTimeout(r.get(`pg:profile:${userId}`));
    if (raw != null) return JSON.parse(raw);
    return null;
  } catch {
    return null;
  }
}

function parseCoord(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/** Prefer Neon full_name, then first_name + last_name. */
function displayNameFromRow(row) {
  if (!row) return '';
  const full = String(row.full_name ?? row.fullName ?? '').trim();
  if (full) return full;
  const first = String(row.first_name ?? row.firstName ?? '').trim();
  const last = String(row.last_name ?? row.lastName ?? '').trim();
  return `${first} ${last}`.trim();
}

function profileFromNeonRow(row) {
  if (!row) return null;
  const fullName = displayNameFromRow(row);
  return {
    fullName,
    headline: row.headline || '',
    photoUrl: row.photo_url || '',
    linkedinUrl: row.linkedin_url || '',
    interests: row.interests || [],
    bio: userService.bioForProfileRow(row),
    career: row.career || '',
    userUuid: row.user_uuid || null,
    isPremium: false,
  };
}

function mergeCachedWithNeon(cached, neonRow) {
  const neon = profileFromNeonRow(neonRow);
  if (!neon) return cached || null;
  if (!cached) return neon;
  const neonName = neon.fullName;
  return {
    ...cached,
    fullName: neonName || cached.fullName || cached.full_name || '',
    headline: neon.headline || cached.headline || '',
    photoUrl: neon.photoUrl || cached.photoUrl || cached.photo_url || '',
    linkedinUrl: neon.linkedinUrl || cached.linkedinUrl || cached.linkedin_url || '',
    bio: neon.bio || cached.bio || '',
    career: neon.career || cached.career || '',
    interests: (cached.interests?.length ? cached.interests : neon.interests) || [],
    userUuid: neon.userUuid || cached.userUuid || null,
  };
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
    try {
      const [profile, isPremium] = await Promise.all([
        userService.getProfileByLinkedInId(userId).catch(() => null),
        premiumService.hasPremiumAccess(userId).catch(() => false),
      ]);
      const r = redis.getRedis();
      if (profile) {
        const fullName = displayNameFromRow(profile);
        await cacheUserProfile(r, userId, {
          fullName,
          headline: profile.headline,
          photoUrl: profile.photo_url,
          linkedinUrl: profile.linkedin_url,
          interests: profile.interests || [],
          bio: userService.bioForProfileRow(profile),
          career: profile.career || '',
          userUuid: profile.user_uuid || null,
          isPremium,
        });
      }
    } catch {}
    console.log(
      `[sharing] start  userId=${userId} lat=${lat.toFixed(5)} lon=${lon.toFixed(5)}`
    );
    res.json({ success: true });
    (async () => {
      try {
        const dbUserId = await interestService.resolveUserId(userId);
        if (dbUserId) {
          const loc = await locationService.findOrCreateLocation({ latitude: lat, longitude: lon });
          await locationService.recordVisit(dbUserId, loc.id, { wasDiscoverable: true });
        }
      } catch (err) {
        console.warn('[sharing] start async persistence error:', err.message);
      }
    })();
  } catch (err) {
    console.error('[sharing] start error:', err.message);
    const isTimeout = /timed out/i.test(err.message);
    res.status(isTimeout ? 503 : 500).json({ error: err.message || 'Failed to start sharing' });
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
    const isTimeout = /timed out/i.test(err.message);
    res.status(isTimeout ? 503 : 500).json({ error: err.message || 'Failed to update heartbeat' });
  }
}

async function keepalive(req, res) {
  const userId = req.userId;
  try {
    await redis.redisRefreshTtl(userId);
    console.log('[Presence] heartbeat TTL refreshed', {
      userId,
      ttlSeconds: config.REDIS_SESSION_TTL,
    });
    res.json({ success: true, lastHeartbeatAt: new Date().toISOString() });
  } catch (err) {
    console.error('[sharing] keepalive error:', err.message);
    const isTimeout = /timed out/i.test(err.message);
    res.status(isTimeout ? 503 : 500).json({ error: err.message || 'Failed to refresh session' });
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
    const isTimeout = /timed out/i.test(err.message);
    res.status(isTimeout ? 503 : 500).json({ error: err.message || 'Failed to stop sharing' });
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
    const r = redis.getRedis();
    const cachedRequesterProfile = await getCachedProfile(r, userId);
    const isPremium = cachedRequesterProfile?.isPremium ?? await premiumService.hasPremiumAccess(userId).catch(() => false);

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

    const candidates = allEntries.filter(([id]) => id && id !== userId);
    const sessionKeys = candidates.map(([id]) => `${config.REDIS_SESSION_PREFIX}${id}`);
    const sessionVals = sessionKeys.length > 0
      ? await redis.withTimeout(r.mget(...sessionKeys))
      : [];
    const entries = candidates.filter((_, idx) => sessionVals[idx] != null);

    const nearbyUserIds = entries.map(([id]) => id);
    if (nearbyUserIds.length === 0) {
      return res.json({ users: [], count: 0 });
    }

    console.log('[Nearby] hydrating user ids', nearbyUserIds);

    const cachedProfiles = await Promise.all(nearbyUserIds.map((id) => getCachedProfile(r, id)));
    const neonProfiles = await userService.getProfilesByUserIds(nearbyUserIds).catch((err) => {
      console.warn('[Nearby] Neon hydration failed:', err.message);
      return [];
    });
    const neonByUserId = Object.fromEntries(
      neonProfiles.map((p) => [p.linkedin_subject_id, p])
    );

    const profileByUserId = Object.fromEntries(
      nearbyUserIds.map((id, idx) => {
        const merged = mergeCachedWithNeon(cachedProfiles[idx], neonByUserId[id]);
        if (merged) return [id, merged];
        console.warn('[Nearby] missing name fallback', { userId: id });
        return [
          id,
          {
            fullName: '',
            headline: '',
            photoUrl: '',
            linkedinUrl: '',
            interests: [],
            bio: '',
            career: '',
            userUuid: null,
          },
        ];
      })
    );

    // Refresh Redis cache when Neon has a name but cache was empty/stale
    await Promise.all(
      nearbyUserIds.map(async (id) => {
        const profile = profileByUserId[id];
        const neonName = displayNameFromRow(neonByUserId[id]);
        const cachedName = String(profile?.fullName ?? '').trim();
        if (neonName && neonName !== cachedName) {
          try {
            await cacheUserProfile(r, id, { ...profile, fullName: neonName });
          } catch {}
        } else if (!cachedProfiles[nearbyUserIds.indexOf(id)] && profile?.fullName) {
          try {
            await cacheUserProfile(r, id, profile);
          } catch {}
        }
      })
    );
    const myInterests = cachedRequesterProfile?.interests || [];

    let users = entries
      .filter(([id]) => id !== userId)
      .map(([id, dist, latLng]) => {
        const profile = profileByUserId[id];
        const interests = profile?.interests || [];
        const relevanceScore = computeRelevanceScore(myInterests, interests);
        const headline = profile?.headline || '';
        const jobTitle = headline.split(' at ')[0]?.trim() || '';
        let fullName = String(profile?.fullName || profile?.full_name || '').trim();
        if (!fullName) {
          const neonRow = neonByUserId[id];
          fullName = displayNameFromRow(neonRow);
          if (!fullName) {
            console.warn('[Nearby] missing name fallback', { userId: id, hasNeonRow: !!neonRow });
          }
        }
        const u = {
          userId: id,
          fullName,
          headline,
          jobTitle,
          photoUrl: profile?.photoUrl || profile?.photo_url || '',
          linkedinUrl: profile?.linkedinUrl || profile?.linkedin_url || '',
          distanceMeters: Math.round(dist),
          interests: interests,
          bio: profile?.bio || '',
          career: profile?.career || '',
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

    users = users.filter((u) => String(u.fullName || '').trim().length > 0);

    res.json({ users, count: users.length });
  } catch (err) {
    console.error('[sharing] nearby error:', err.message);
    const isTimeout = /timed out/i.test(err.message);
    const isRedis = /redis/i.test(err.message);
    res.status(isTimeout || isRedis ? 503 : 500).json({
      error: err.message || 'Failed to fetch nearby users',
    });
  }
}

/**
 * GET /sharing/debug (no auth — dev convenience)
 */
async function debugSessions(req, res) {
  try {
    const r = redis.getRedis();
    const geo = await redis.withTimeout(r.zrange(config.REDIS_GEO_KEY, 0, -1, 'WITHSCORES'));
    res.json({ geoKeys: geo?.length || 0, note: 'Redis GEO keys (user ids)' });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}

module.exports = { startSharing, heartbeat, keepalive, stopSharing, getNearby, debugSessions };
