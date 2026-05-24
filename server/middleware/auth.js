const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Express middleware that validates the Bearer JWT token in the
 * Authorization header and attaches req.user / req.userId.
 * Logs reason for 401 (without leaking secrets) for debugging.
 */
function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[auth] 401: no token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user   = payload.user;
    req.userId = payload.userId || payload.user?.id;
    next();
  } catch (err) {
    const reason = err?.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    console.log(`[auth] 401: token ${reason}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
