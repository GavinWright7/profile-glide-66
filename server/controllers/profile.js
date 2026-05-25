const { validateAndNormalize } = require('../utils/linkedinUrl');
const userService = require('../services/userService');
const { signToken } = require('../utils/jwt');
const { INTEREST_OPTIONS } = require('../constants/interests');
const { getSubcategoriesForIndustry } = require('../constants/subcategories');
const interestService = require('../services/interestService');
const {
  resolveDisplayBio,
  bioProfileFromRow,
  bioProfileFromUser,
} = require('../utils/bioTemplate');

const MAX_BIO_LEN = 800;

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
 * Body: { currentJobTitle, currentCompany, almaMater, graduationYear?, pastCompanies?: string[] }
 */
async function updateProfessionalBackground(req, res) {
  const { currentJobTitle, currentCompany, almaMater, graduationYear, pastCompanies } = req.body;
  const user = req.user;

  const jobTitle = String(currentJobTitle ?? '').trim();
  const company = String(currentCompany ?? '').trim();
  const alma = String(almaMater ?? '').trim();
  const gradRaw = graduationYear != null ? String(graduationYear).trim() : '';

  if (!jobTitle || !alma) {
    return res.status(400).json({
      error: 'Current job title and alma mater are required',
    });
  }

  if (gradRaw) {
    if (!/^\d{4}$/.test(gradRaw)) {
      return res.status(400).json({
        error: 'Graduation year must be a 4-digit year (e.g. 2026) or omitted',
      });
    }
    const gradNum = parseInt(gradRaw, 10);
    if (gradNum < 1950 || gradNum > 2100) {
      return res.status(400).json({
        error: 'Graduation year must be between 1950 and 2100',
      });
    }
  }

  const past = Array.isArray(pastCompanies)
    ? pastCompanies.map((s) => String(s ?? '').trim()).filter(Boolean)
    : [];
  const gradValue = gradRaw || null;

  try {
    const updatedRow = await userService.updateProfessionalBackground(user.id, {
      currentJobTitle: jobTitle,
      currentCompany: company || null,
      almaMater: alma,
      pastCompanies: past,
      graduationYear: gradValue,
    });
    if (!updatedRow) {
      console.error('[profile] professional background: no profile row updated for subject', user.id);
      return res.status(500).json({ error: 'Could not save professional background (profile missing)' });
    }

    // Plain object: avoids rare spread/toJSON quirks; always include camelCase fields the app expects.
    const updatedUser = {
      id: user.id,
      name: user.name ?? '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      picture: user.picture ?? '',
      headline: user.headline ?? '',
      linkedinUrl: user.linkedinUrl ?? '',
      interests: Array.isArray(user.interests) ? user.interests : [],
      goals: Array.isArray(user.goals) ? user.goals : [],
      bio: updatedRow
        ? userService.bioForProfileRow(updatedRow)
        : resolveDisplayBio(
            user.bio ?? '',
            bioProfileFromUser({
              firstName: user.firstName,
              currentJobTitle: jobTitle,
              currentCompany: company || null,
              almaMater: alma,
              pastCompanies: past,
              graduationYear: gradValue,
            })
          ),
      career: user.career ?? '',
      currentJobTitle: jobTitle,
      currentCompany: company || null,
      almaMater: alma,
      pastCompanies: past,
      ...(gradValue ? { graduationYear: gradValue } : {}),
    };

    const token = signToken({ userId: user.id, user: updatedUser });

    console.log('[profile] professional background updated for', user.id, {
      graduationYear: updatedUser.graduationYear,
      responseUserKeys: Object.keys(updatedUser),
    });
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
    const almaMater =
      stored?.alma_mater != null && String(stored.alma_mater).trim() !== ''
        ? String(stored.alma_mater).trim()
        : user.almaMater != null && String(user.almaMater).trim() !== ''
          ? String(user.almaMater).trim()
          : null;
    const pastCompanies = stored?.past_companies ?? user.pastCompanies ?? [];
    const graduationYear =
      stored?.graduation_year != null && String(stored.graduation_year).trim() !== ''
        ? String(stored.graduation_year).trim()
        : user.graduationYear ?? '';
    const storedBio =
      stored?.bio != null && String(stored.bio).trim() !== ''
        ? String(stored.bio).trim()
        : user.bio ?? '';
    const career = stored?.career ?? user.career ?? '';
    const bio = resolveDisplayBio(
      storedBio,
      bioProfileFromRow(stored, {
        ...user,
        currentJobTitle,
        currentCompany,
        almaMater,
        pastCompanies,
        graduationYear,
      })
    );
    const merged = {
      ...user,
      linkedinUrl,
      currentJobTitle,
      currentCompany,
      almaMater,
      pastCompanies,
      graduationYear,
      bio,
      career,
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
 * GET /profile/me — same as GET /profile (canonical name).
 */
async function getMe(req, res) {
  const user = req.user;
  try {
    const merged = await userService.getMergedUserForAuth(user.id, user);
    res.json({ user: merged });
  } catch (err) {
    console.error('[profile] getMe error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

/**
 * PATCH /profile/me
 * Body: { bio?, career?, interests? } — partial updates allowed.
 */
async function patchMe(req, res) {
  const user = req.user;
  const { bio, career, interests } = req.body;

  if (
    bio === undefined &&
    career === undefined &&
    interests === undefined
  ) {
    return res.status(400).json({
      error: 'Provide at least one of: bio, career, interests',
    });
  }

  if (bio !== undefined && typeof bio !== 'string') {
    return res.status(400).json({ error: 'bio must be a string' });
  }
  if (bio !== undefined && String(bio).length > MAX_BIO_LEN) {
    return res.status(400).json({
      error: `Bio must be ${MAX_BIO_LEN} characters or less`,
    });
  }

  try {
    if (interests !== undefined) {
      let interestsPayload = interests;
      if (!Array.isArray(interestsPayload) || interestsPayload.length > 3) {
        return res.status(400).json({
          error:
            'interests must be an array of up to 3 items, each with industry and subcategories',
        });
      }
      if (typeof interestsPayload[0] === 'string') {
        interestsPayload = interestsPayload.map((industry) => ({
          industry,
          subcategories: [],
        }));
      }
      for (const item of interestsPayload) {
        if (!item || typeof item !== 'object' || !item.industry) {
          return res
            .status(400)
            .json({ error: 'Each interest must have an industry' });
        }
        if (!Array.isArray(item.subcategories)) {
          return res
            .status(400)
            .json({ error: 'subcategories must be an array of strings' });
        }
      }
      await interestService.saveUserInterests(user.id, interestsPayload);
      const flatIndustries = interestsPayload.map((i) => i.industry);
      await userService.updateInterests(user.id, flatIndustries);
    }

    if (bio !== undefined || career !== undefined) {
      if (bio !== undefined) {
        console.log('[Profile] saving bio', { userId: user.id, length: String(bio).length });
      }
      try {
        await userService.updateProfileMePatch(user.id, { bio, career });
      } catch (err) {
        if (err.code === 'bio_too_long') {
          return res.status(400).json({
            error: `Bio must be ${MAX_BIO_LEN} characters or less`,
          });
        }
        throw err;
      }
      if (bio !== undefined) {
        const row = await userService.getProfileByLinkedInId(user.id);
        console.log('[Profile] saved bio result', {
          userId: user.id,
          storedLength: row?.bio != null ? String(row.bio).length : 0,
        });
      }
    }

    const merged = await userService.getMergedUserForAuth(user.id, user);
    const token = signToken({ userId: user.id, user: merged });
    console.log('[profile] PATCH /me for', user.id);
    res.json({ token, user: merged });
  } catch (err) {
    console.error('[profile] patchMe error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function updateDiscoverable(req, res) {
  const user = req.user;
  const { isDiscoverable } = req.body;
  if (typeof isDiscoverable !== 'boolean') {
    return res.status(400).json({ error: 'isDiscoverable must be a boolean' });
  }
  try {
    await userService.updateIsDiscoverable(user.id, isDiscoverable);
    const merged = await userService.getMergedUserForAuth(user.id, user);
    const token = signToken({ userId: user.id, user: merged });
    res.json({ token, user: merged });
  } catch (err) {
    console.error('[profile] updateDiscoverable error:', err.message);
    res.status(500).json({ error: 'Failed to update discoverable preference' });
  }
}

module.exports = {
  updateLinkedInUrl,
  updateInterests,
  getProfile,
  getMe,
  patchMe,
  updateDiscoverable,
  getInterestsOptions,
  updateProfessionalBackground,
  updateGoals,
};
