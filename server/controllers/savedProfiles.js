const userService = require('../services/userService');

/**
 * GET /saved-profiles — current user's saved profiles (no emails).
 */
async function listSaved(req, res) {
  const saverId = req.user.id;
  try {
    const rows = await userService.listSavedProfilesForSaver(saverId);
    const profiles = rows.map((r) => ({
      id: r.id,
      targetUserId: r.target_linkedin_subject_id,
      savedAt: r.created_at,
      name: r.full_name || '',
      picture: r.photo_url || '',
      headline: r.headline || '',
      linkedinUrl: r.linkedin_url || '',
      career: r.career || '',
      bio: r.bio || '',
    }));
    res.json({ profiles });
  } catch (err) {
    console.error('[saved-profiles] list error:', err.message);
    res.status(500).json({ error: 'Failed to load saved profiles' });
  }
}

/**
 * POST /saved-profiles/:userId — save target (LinkedIn subject id).
 */
async function saveOne(req, res) {
  const saverId = req.user.id;
  const targetId = String(req.params.userId || '').trim();
  if (!targetId) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  try {
    if (saverId === targetId) {
      return res.status(400).json({ error: 'Cannot save your own profile' });
    }
    const { inserted } = await userService.insertSavedProfile(saverId, targetId);
    if (inserted) {
      return res.status(201).json({ message: 'Profile saved.', alreadySaved: false });
    }
    return res.status(200).json({ message: 'Profile already saved.', alreadySaved: true });
  } catch (err) {
    if (err.code === 'cannot_save_self') {
      return res.status(400).json({ error: 'Cannot save your own profile' });
    }
    console.error('[saved-profiles] save error:', err.message);
    res.status(500).json({ error: 'Failed to save profile' });
  }
}

/**
 * DELETE /saved-profiles/:userId
 */
async function removeOne(req, res) {
  const saverId = req.user.id;
  const targetId = String(req.params.userId || '').trim();
  if (!targetId) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  try {
    await userService.deleteSavedProfile(saverId, targetId);
    res.json({ success: true });
  } catch (err) {
    console.error('[saved-profiles] delete error:', err.message);
    res.status(500).json({ error: 'Failed to remove saved profile' });
  }
}

module.exports = { listSaved, saveOne, removeOne };
