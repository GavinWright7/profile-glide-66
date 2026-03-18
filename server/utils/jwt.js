/**
 * Central JWT signing utility — single source of truth for token issuance.
 * All controllers must use this so expiry and payload shape stay consistent.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

const DEFAULT_EXPIRY = '7d';

/**
 * Sign a session token for the given user.
 * @param {object} payload - { userId, user }
 * @param {string} [expiresIn] - e.g. '7d', '24h'. Default: 7d
 * @returns {string} JWT
 */
function signToken(payload, expiresIn = DEFAULT_EXPIRY) {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn });
}

module.exports = { signToken, DEFAULT_EXPIRY };
