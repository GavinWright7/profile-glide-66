/**
 * Premium entitlement routes.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const premiumService = require('../services/premiumService');

router.use(requireAuth);

/**
 * GET /premium/status
 * Returns current premium status for the authenticated user.
 */
router.get('/status', async (req, res) => {
  try {
    const status = await premiumService.getPremiumStatus(req.userId);
    res.json(status);
  } catch (err) {
    console.error('[premium] status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch premium status' });
  }
});

/**
 * POST /premium/promo-code
 * Body: { code: string }
 * Redeems promo code "premium" for dev/testing.
 */
router.post('/promo-code', async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code required' });
  }

  try {
    const granted = await premiumService.grantPremiumByPromoCode(req.userId, code.trim());
    if (!granted) {
      return res.status(400).json({ error: 'Invalid or expired promo code' });
    }
    res.json({ success: true, isPremium: true });
  } catch (err) {
    console.error('[premium] promo-code error:', err.message);
    res.status(500).json({ error: 'Failed to redeem promo code' });
  }
});

/**
 * POST /premium/apple-purchase
 * Body: { productId, originalTransactionId? }
 * Records successful Apple IAP and grants premium.
 */
router.post('/apple-purchase', async (req, res) => {
  const { productId, originalTransactionId } = req.body;
  if (!productId || productId !== 'premium_monthly') {
    return res.status(400).json({ error: 'Invalid product' });
  }

  try {
    await premiumService.grantPremiumByApple(
      req.userId,
      productId,
      originalTransactionId || null
    );
    res.json({ success: true, isPremium: true });
  } catch (err) {
    console.error('[premium] apple-purchase error:', err.message);
    res.status(500).json({ error: 'Failed to record purchase' });
  }
});

module.exports = router;
