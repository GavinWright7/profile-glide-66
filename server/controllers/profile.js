const jwt = require('jsonwebtoken');
const { validateAndNormalize } = require('../utils/linkedinUrl');
const userService = require('../services/userService');
const config = require('../config');
const { INTEREST_OPTIONS } = require('../constants/interests');
const { getSubcategoriesForIndustry } = require('../constants/subcategories');
const interestService = require('../services/interestService');

/**
 * PUT /profile/linkedin-url
 * Body: { linkedin_url: string }
 * Validates, saves to Neon, returns new JWT with updated user.
 */
async function updateLinkedInUrl(req, res) {
  const { linkedin_url } = req.body;
  const normalized = validateAndNormalize(linkedin_url);

  if (!normalized) {
    return res.status(400).json({
      error: 'Invalid LinkedIn URL. Use format: https://www.linkedin.com/in/your-username/',
    });
  }

  const user = req.user;

  try {
    await userService.updateLinkedInUrl(user.id, normalized);
    const updatedUser = { ...user, linkedinUrl: normalized };

    const token = jwt.sign(
      { userId: user.id, user: updatedUser },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('[profile] linkedin_url updated for', user.id, '→', normalized);
    res.json({ token, user: updatedUser });
  } catch (err) {
    console.error('[profile] updateLinkedInUrl error:', err.message);
    res.status(500).json({ error: 'Failed to update LinkedIn URL' });
  }
}

/**
 * PUT /profile/interests
 * Body: { interests: string[] }
 * Saves interests to Neon (max 3 from allowed list), returns new JWT.
 */
function getInterestsOptions(req, res) {
  const subcategories = {};
  for (const ind of INTEREST_OPTIONS) {
    subcategories[ind] = getSubcategoriesForIndustry(ind);
  }
  res.json({ industries: INTEREST_OPTIONS, subcategories });
}

async function updateInterests(req, res) {
  let { interests } = req.body;
  const user = req.user;

  if (!Array.isArray(interests) || interests.length > 3) {
    return res.status(400).json({
      error: 'interests must be an array of up to 3 items, each with industry and subcategories',
    });
  }

  if (typeof interests[0] === 'string') {
    interests = interests.map((industry) => ({ industry, subcategories: [] }));
  }

  for (const item of interests) {
    if (!item || typeof item !== 'object' || !item.industry) {
      return res.status(400).json({ error: 'Each interest must have an industry' });
    }
    if (!Array.isArray(item.subcategories)) {
      return res.status(400).json({ error: 'subcategories must be an array of strings' });
    }
  }

  try {
    await interestService.saveUserInterests(user.id, interests);
    const flatIndustries = interests.map((i) => i.industry);
    await userService.updateInterests(user.id, flatIndustries);
    const updatedUser = { ...user, interests: flatIndustries };

    const token = jwt.sign(
      { userId: user.id, user: updatedUser },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('[profile] interests updated for', user.id);
    res.json({ token, user: updatedUser });
  } catch (err) {
    console.error('[profile] updateInterests error:', err.message);
    res.status(500).json({ error: 'Failed to update interests' });
  }
}

/**
 * GET /profile
 * Returns current user profile from Neon (merged with JWT).
 */
async function getProfile(req, res) {
  const user = req.user;

  try {
    const stored = await userService.getProfileByLinkedInId(user.id);
    const linkedinUrl = stored?.linkedin_url ?? user.linkedinUrl ?? '';
    const interests = stored?.interests ?? user.interests ?? [];
    const merged = { ...user, linkedinUrl, interests };
    res.json({ user: merged });
  } catch (err) {
    console.error('[profile] getProfile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

module.exports = { updateLinkedInUrl, updateInterests, getProfile, getInterestsOptions };
