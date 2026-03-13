/**
 * Premium entitlement service — provider-agnostic.
 * Sources: apple_iap, promo_code, admin_grant.
 */
const db = require('./db');
const interestService = require('./interestService');

const PREMIUM_SOURCES = ['apple_iap', 'promo_code', 'admin_grant'];
const PROMO_CODE_PREMIUM = 'premium';

async function resolveUserId(linkedinSubjectId) {
  const res = await db.query(
    `SELECT id FROM users WHERE linkedin_subject_id = $1`,
    [linkedinSubjectId]
  );
  return res.rows[0]?.id || null;
}

async function hasPremiumAccess(linkedinSubjectId) {
  const userId = await resolveUserId(linkedinSubjectId);
  if (!userId) return false;

  const res = await db.query(
    `SELECT is_premium, premium_expires_at FROM user_premium
     WHERE user_id = $1 AND is_premium = true`,
    [userId]
  );
  const row = res.rows[0];
  if (!row) return false;
  if (row.premium_expires_at && new Date(row.premium_expires_at) < new Date()) {
    await db.query(
      `UPDATE user_premium SET is_premium = false, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    return false;
  }
  return true;
}

async function grantPremiumByPromoCode(linkedinSubjectId, code) {
  if (code !== PROMO_CODE_PREMIUM) return false;

  const userId = await resolveUserId(linkedinSubjectId);
  if (!userId) return false;

  await db.query(
    `INSERT INTO user_premium (user_id, is_premium, premium_source, updated_at)
     VALUES ($1, true, 'promo_code', NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       is_premium = true, premium_source = 'promo_code', updated_at = NOW()`,
    [userId]
  );
  return true;
}

async function grantPremiumByApple(linkedinSubjectId, productId, originalTransactionId) {
  const userId = await resolveUserId(linkedinSubjectId);
  if (!userId) return false;

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  await db.query(
    `INSERT INTO user_premium (user_id, is_premium, premium_source, subscription_status, premium_started_at, premium_expires_at, apple_product_id, apple_original_transaction_id, updated_at)
     VALUES ($1, true, 'apple_iap', 'active', NOW(), $2, $3, $4, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       is_premium = true,
       premium_source = 'apple_iap',
       subscription_status = 'active',
       premium_expires_at = $2,
       apple_product_id = $3,
       apple_original_transaction_id = COALESCE($4, user_premium.apple_original_transaction_id),
       updated_at = NOW()`,
    [userId, expiresAt, productId, originalTransactionId]
  );
  return true;
}

async function getPremiumStatus(linkedinSubjectId) {
  const userId = await resolveUserId(linkedinSubjectId);
  if (!userId) return { isPremium: false };

  const res = await db.query(
    `SELECT is_premium, premium_source, premium_expires_at FROM user_premium WHERE user_id = $1`,
    [userId]
  );
  const row = res.rows[0];
  if (!row || !row.is_premium) return { isPremium: false };
  if (row.premium_expires_at && new Date(row.premium_expires_at) < new Date()) {
    return { isPremium: false };
  }
  return {
    isPremium: true,
    source: row.premium_source,
    expiresAt: row.premium_expires_at,
  };
}

module.exports = {
  hasPremiumAccess,
  grantPremiumByPromoCode,
  grantPremiumByApple,
  getPremiumStatus,
  PROMO_CODE_PREMIUM,
};
