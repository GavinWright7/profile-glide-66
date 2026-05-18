const axios = require('axios');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const config = require('../config');
const { signToken } = require('../utils/jwt');

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

function startLinkedInOAuth(req, res) {
  if (req.query.force_login === '1') {
    const base = config.LINKEDIN_REDIRECT_URI.replace(/\/auth\/linkedin\/callback\/?(\?.*)?$/i, '');
    const oauthStartUrl = `${base}/auth/linkedin/start`;
    const logoutUrl = `https://www.linkedin.com/oauth/v2/logout?redirect_uri=${encodeURIComponent(oauthStartUrl)}`;
    return res.redirect(logoutUrl);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.LINKEDIN_CLIENT_ID,
    redirect_uri: config.LINKEDIN_REDIRECT_URI,
    scope: 'openid profile email',
    state: generateState(),
  });

  const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString().replace(/\+/g, "%20")}`;
  console.log('[auth] LinkedIn OAuth start, redirect_uri=', config.LINKEDIN_REDIRECT_URI);
  res.redirect(linkedInAuthUrl);
}

/**
 * Build the HTTPS redirect page URL safely. SFSafariViewController cannot handle
 * 302 redirects to custom URL schemes (airlinks://), so we redirect to an HTTPS
 * page that then opens airlinks:// via JavaScript.
 */
function buildRedirectPageUrl(params) {
  const base = config.LINKEDIN_REDIRECT_URI.replace(/\/auth\/linkedin\/callback\/?(\?.*)?$/i, '');
  const url = new URL('/auth/redirect', base);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && String(v).length > 0) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function handleLinkedInCallback(req, res) {
  const { code, error, error_description } = req.query;
  console.log('[auth] LinkedIn callback received', { hasCode: !!code, hasError: !!error });

  if (error) {
    const errMsg = (error_description || error || 'unknown_error').toString().trim();
    console.error('[auth] LinkedIn OAuth error:', error, error_description);
    const redirectUrl = buildRedirectPageUrl({ error: errMsg });
    console.log('[auth] redirect (error path) ->', redirectUrl);
    return res.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = buildRedirectPageUrl({ error: 'missing_code' });
    console.log('[auth] redirect (no code) ->', redirectUrl);
    return res.redirect(redirectUrl);
  }

  try {
    const tokenResponse = await axios.post(
      LINKEDIN_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.LINKEDIN_REDIRECT_URI,
        client_id: config.LINKEDIN_CLIENT_ID,
        client_secret: config.LINKEDIN_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    const profileResponse = await axios.get(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = profileResponse.data;
    const fullName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim();

    const user = await userService.upsertUser(profile.sub, profile.email || null);
    await userService.upsertProfile(user.id, {
      fullName,
      firstName: profile.given_name || null,
      lastName: profile.family_name || null,
      headline: profile.headline || null,
      photoUrl: profile.picture || null,
    });

    const storedProfile = await userService.getProfileByLinkedInId(profile.sub);
    const linkedinUrl = storedProfile?.linkedin_url || '';
    const interests = storedProfile?.interests || [];

    const userPayload = {
      id: profile.sub,
      name: fullName,
      firstName: profile.given_name || '',
      lastName: profile.family_name || '',
      email: profile.email || '',
      picture: profile.picture || '',
      headline: profile.headline || '',
      linkedinUrl,
      interests,
    };

    const sessionToken = signToken({ userId: userPayload.id, user: userPayload });
    const redirectUrl = buildRedirectPageUrl({ token: sessionToken });
    console.log('[auth] token generated, redirect (success) ->', redirectUrl.replace(/token=[^&]+/, 'token=***'));
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[auth] LinkedIn auth error:', err?.response?.data || err.message);
    const message = (err?.response?.data?.error_description || err?.message || 'Authentication failed').toString().trim();
    const redirectUrl = buildRedirectPageUrl({ error: message });
    console.log('[auth] redirect (error path) ->', redirectUrl);
    res.redirect(redirectUrl);
  }
}

async function exchangeCode(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'No authorization code provided' });

  try {
    const tokenResponse = await axios.post(
      LINKEDIN_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.LINKEDIN_REDIRECT_URI,
        client_id: config.LINKEDIN_CLIENT_ID,
        client_secret: config.LINKEDIN_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    const profileResponse = await axios.get(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = profileResponse.data;
    const fullName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim();

    const user = await userService.upsertUser(profile.sub, profile.email || null);
    await userService.upsertProfile(user.id, {
      fullName,
      firstName: profile.given_name || null,
      lastName: profile.family_name || null,
      headline: profile.headline || null,
      photoUrl: profile.picture || null,
    });

    const storedProfile = await userService.getProfileByLinkedInId(profile.sub);
    const linkedinUrl = storedProfile?.linkedin_url || '';
    const interests = storedProfile?.interests || [];

    const userPayload = {
      id: profile.sub,
      name: fullName,
      firstName: profile.given_name || '',
      lastName: profile.family_name || '',
      email: profile.email || '',
      picture: profile.picture || '',
      headline: profile.headline || '',
      linkedinUrl,
      interests,
    };

    const sessionToken = signToken({ userId: userPayload.id, user: userPayload });

    res.json({ token: sessionToken, user: userPayload });
  } catch (err) {
    console.error('LinkedIn exchange error:', err?.response?.data || err.message);
    const message = err?.response?.data?.error_description || 'Authentication failed';
    res.status(500).json({ error: message });
  }
}

function verifyToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[auth] validate: no token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    console.log('[auth] validate: success userId=', payload.user?.id);
    res.json({ valid: true, user: payload.user });
  } catch (err) {
    const reason = err?.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    console.log('[auth] validate: token', reason);
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Serves an HTTPS page that redirects to airlinks://auth.
 * Required because SFSafariViewController cannot handle 302 redirects to custom URL schemes.
 * Builds the custom URL using URLSearchParams for safe encoding.
 */
function serveRedirectPage(req, res) {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const error = typeof req.query.error === 'string' ? req.query.error.trim() : '';
  const hasToken = token.length > 0;
  const hasError = error.length > 0;

  if (!hasToken && !hasError) {
    console.warn('[auth] redirect page called without token or error');
    return res.status(400).send('Missing token or error parameter');
  }

  // Build airlinks://auth URL using URLSearchParams (handles encoding)
  const target = new URL('airlinks://auth');
  if (hasToken) target.searchParams.set('token', token);
  else target.searchParams.set('error', error);
  const deepLink = target.toString();
  console.log('[auth] serving redirect page, final URL:', deepLink.replace(/token=[^&]+/, 'token=***'));

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting to AirLinks</title>
</head>
<body>
  <p>Redirecting to AirLinks…</p>
  <p><a id="fallback" href="#">Tap here if you're not redirected</a></p>
  <script>
    (function() {
      var params = new URLSearchParams(window.location.search);
      var token = params.get('token') || '';
      var err = params.get('error') || '';
      var target = new URL('airlinks://auth');
      if (token) target.searchParams.set('token', token);
      else if (err) target.searchParams.set('error', err);
      else return;
      var url = target.toString();
      document.getElementById('fallback').href = url;
      window.location.href = url;
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

module.exports = { startLinkedInOAuth, handleLinkedInCallback, exchangeCode, verifyToken, serveRedirectPage };
