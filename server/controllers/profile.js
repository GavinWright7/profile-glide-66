const { validateAndNormalize } = require('../utils/linkedinUrl');
const userService = require('../services/userService');
const { signToken } = require('../utils/jwt');
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

    const token = signToken({ userId: user.id, user: updatedUser });

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

    const token = signToken({ userId: user.id, user: updatedUser });

    console.log('[profile] interests updated for', user.id);
    res.json({ token, user: updatedUser });
  } catch (err) {
    console.error('[profile] updateInterests error:', err.message);
    res.status(500).json({ error: 'Failed to update interests' });
  }
}

/**
 * PUT /profile/professional-background
 * Body: { currentJobTitle, currentCompany, almaMater, pastCompanies?: string[] }
 */
async function updateProfessionalBackground(req, res) {
  const { currentJobTitle, currentCompany, almaMater, pastCompanies } = req.body;
  const user = req.user;

  const jobTitle = String(currentJobTitle ?? '').trim();
  const company = String(currentCompany ?? '').trim();
  const alma = String(almaMater ?? '').trim();
  const past = Array.isArray(pastCompanies)
    ? pastCompanies.map((s) => String(s ?? '').trim()).filter(Boolean)
    : [];

  if (!jobTitle || !alma) {
    return res.status(400).json({
      error: 'Current job title and alma mater are required',
    });
  }

  try {
    await userService.updateProfessionalBackground(user.id, {
      currentJobTitle: jobTitle,
      currentCompany: company || null,
      almaMater: alma,
      pastCompanies: past,
    });
    const updatedUser = {
      ...user,
      currentJobTitle: jobTitle,
      currentCompany: company || null,
      almaMater: alma,
      pastCompanies: past,
    };

    const token = signToken({ userId: user.id, user: updatedUser });

    console.log('[profile] professional background updated for', user.id);
    res.json({ token, user: updatedUser });
  } catch (err) {
    console.error('[profile] updateProfessionalBackground error:', err.message);
    res.status(500).json({ error: 'Failed to update professional background' });
  }
}

/**
 * PUT /profile/goals
 * Body: { goals: string[] }
 */
async function updateGoals(req, res) {
  const { goals } = req.body;
  const user = req.user;

  if (!Array.isArray(goals) || goals.length === 0) {
    return res.status(400).json({
      error: 'At least one goal is required',
    });
  }

  const normalized = goals.map((s) => String(s ?? '').trim()).filter(Boolean);
  if (normalized.length === 0) {
    return res.status(400).json({
      error: 'At least one goal is required',
    });
  }

  try {
    await userService.updateGoals(user.id, normalized);
    const updatedUser = { ...user, goals: normalized };

    const token = signToken({ userId: user.id, user: updatedUser });

    console.log('[profile] goals updated for', user.id);
    res.json({ token, user: updatedUser });
  } catch (err) {
    console.error('[profile] updateGoals error:', err.message);
    res.status(500).json({ error: 'Failed to update goals' });
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
    const currentJobTitle = stored?.current_job_title ?? user.currentJobTitle ?? null;
    const currentCompany = stored?.current_company ?? user.currentCompany ?? null;
    const almaMater = stored?.alma_mater ?? user.almaMater ?? null;
    const pastCompanies = stored?.past_companies ?? user.pastCompanies ?? [];
    const bio =
      stored?.bio != null && String(stored.bio).trim() !== ''
        ? String(stored.bio).trim()
        : user.bio ?? '';
    const merged = {
      ...user,
      linkedinUrl,
      currentJobTitle,
      currentCompany,
      almaMater,
      pastCompanies,
      bio,
    };
    delete merged.interests;
    delete merged.goals;
    res.json({ user: merged });
  } catch (err) {
    console.error('[profile] getProfile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

/**
 * PATCH /profile
 * Body: { bio: string }
 */
async function patchProfile(req, res) {
  const user = req.user;
  const { bio } = req.body;
  const trimmed = bio != null ? String(bio).trim() : '';

  try {
    await userService.updateBio(user.id, trimmed);
    const updatedUser = { ...user, bio: trimmed };
    delete updatedUser.interests;
    delete updatedUser.goals;
    const token = signToken({ userId: user.id, user: updatedUser });

    console.log('[profile] bio updated for', user.id);
    res.json({ token, user: updatedUser });
  } catch (err) {
    console.error('[profile] patchProfile error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

module.exports = {
  updateLinkedInUrl,
  updateInterests,
  getProfile,
  getInterestsOptions,
  updateProfessionalBackground,
  updateGoals,
  patchProfile,
};
