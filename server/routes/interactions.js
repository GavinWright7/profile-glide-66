/**
 * Interaction / connection / proximity routes — durable tracking in Neon.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const interactionService = require('../services/interactionService');
const connectionService = require('../services/connectionService');
const interestService = require('../services/interestService');

router.use(requireAuth);

/**
 * POST /interactions/event
 * Body: { targetUserId, eventType, latitude?, longitude?, metadata? }
 * Records interaction funnel event (nearby_seen, card_opened, profile_viewed, etc.)
 */
router.post('/event', async (req, res) => {
  const { targetUserId, eventType, latitude, longitude, metadata } = req.body;
  const actorLinkedInId = req.userId;

  if (!targetUserId || !eventType) {
    return res.status(400).json({ error: 'targetUserId and eventType required' });
  }

  try {
    const actorUserId = await interestService.resolveUserId(actorLinkedInId);
    const targetUserIdResolved = await interestService.resolveUserId(targetUserId);
    if (!actorUserId || !targetUserIdResolved) {
      return res.status(404).json({ error: 'User not found' });
    }

    await interactionService.recordInteraction(actorUserId, targetUserIdResolved, eventType, {
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      metadata: metadata || {},
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[interactions] event error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /interactions/connect
 * Body: { targetUserId, connectionMethod?, latitude?, longitude? }
 * Records explicit connection between two users.
 */
router.post('/connect', async (req, res) => {
  const { targetUserId, connectionMethod = 'in_app_tap', latitude, longitude } = req.body;
  const actorLinkedInId = req.userId;

  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId required' });
  }

  try {
    const actorUserId = await interestService.resolveUserId(actorLinkedInId);
    const targetUserIdResolved = await interestService.resolveUserId(targetUserId);
    if (!actorUserId || !targetUserIdResolved) {
      return res.status(404).json({ error: 'User not found' });
    }

    const conn = await connectionService.createConnection(actorUserId, targetUserIdResolved, {
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      connectionMethod,
    });

    await interactionService.recordInteraction(actorUserId, targetUserIdResolved, 'connection_created', {
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    });

    res.json({ success: true, connection: conn });
  } catch (err) {
    console.error('[interactions] connect error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
