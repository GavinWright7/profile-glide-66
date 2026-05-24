const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const config = require('../config');
const { signToken } = require('../utils/jwt');

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const OAUTH_SCOPE = 'openid profile email';

function generateState(platform, forceLogin) {
  const payload = {
    n: crypto.randomBytes(16).toString('hex'),
    platform: platform || 'web',
    forceLogin: !!forceLogin,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function parseOAuthState(state) {
  if (!state || typeof state !== 'string') return { platform: 'unknown', forceLogin: false };
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    return {
      platform: parsed.platform || 'unknown',
      forceLogin: !!parsed.forceLogin,
      nonce: parsed.n,
    };
  } catch {
    return { platform: 'unknown', forceLogin: false, raw: state };
  }
}

function buildLinkedInAuthorizationUrl({ isMobile, forceLogin }) {
  const platform = isMobile ? 'mobile' : 'web';
  const state = generateState(platform, forceLogin);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.LINKEDIN_CLIENT_ID,
    redirect_uri: config.LINKEDIN_REDIRECT_URI,
    scope: OAUTH_SCOPE,
    state,
  });

  // Optional: extended login for native in-app browsers (LinkedIn documented).
  if (isMobile) {
    params.set('enable_extended_login', 'true');
  }

  return {
    url: `${LINKEDIN_AUTHORIZE_URL}?${params.toString()}`,
    state,
    platform,
  };
}

function buildMobileDeepLink(params) {
  const base = config.MOBILE_DEEP_LINK_SCHEME || 'airlinks://auth';
  const target = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && String(v).length > 0) target.searchParams.set(k, String(v));
  });
  return target.toString();
}

function startLinkedInOAuth(req, res) {
  const forceLogin = req.query.force_login === '1';
  const isMobile = req.query.platform === 'mobile';
  const { url: linkedInAuthUrl, state, platform } = buildLinkedInAuthorizationUrl({
    isMobile,
    forceLogin,
  });

  console.log('[auth] LinkedIn OAuth start', {
    platform,
    forceLogin,
    client_id: config.LINKEDIN_CLIENT_ID,
    redirect_uri: config.LINKEDIN_REDIRECT_URI,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    state,
    authorization_url: linkedInAuthUrl,
  });

  // Always redirect directly to /oauth/v2/authorization.
  // The uas/login?session_redirect= wrapper breaks in iOS in-app browsers (LinkedIn "Bummer" error).
  res.redirect(linkedInAuthUrl);
}

function debugLinkedInConfig(_req, res) {
  res.json({
    hasClientId: Boolean(config.LINKEDIN_CLIENT_ID),
    hasClientSecret: Boolean(config.LINKEDIN_CLIENT_SECRET),
    redirectUri: config.LINKEDIN_REDIRECT_URI || null,
    mobileDeepLinkScheme: config.MOBILE_DEEP_LINK_SCHEME || null,
  });
}

/**
 * Build the HTTPS redirect page URL safely. SFSafariViewController cannot handle
 * 302 redirects to custom URL schemes (airlinks://), so we redirect to an HTTPS
 * page that then opens the mobile deep link via JavaScript.
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
  const { code, error, error_description, state } = req.query;
  const stateInfo = parseOAuthState(typeof state === 'string' ? state : '');

  console.log('[auth] LinkedIn callback received', {
    hasCode: !!code,
    hasError: !!error,
    error,
    error_description,
    state,
    platform: stateInfo.platform,
    forceLogin: stateInfo.forceLogin,
  });

  if (error) {
    const errMsg = (error_description || error || 'unknown_error').toString().trim();
    console.error('[auth] LinkedIn OAuth error:', {
      error,
      error_description,
      state,
      platform: stateInfo.platform,
    });
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
      currentJobTitle: storedProfile?.current_job_title || '',
      currentCompany: storedProfile?.current_company || '',
      almaMater: storedProfile?.alma_mater || '',
      pastCompanies: storedProfile?.past_companies || [],
      goals: storedProfile?.goals || [],
      bio: storedProfile?.bio || '',
      career: storedProfile?.career || '',
      graduationYear: storedProfile?.graduation_year != null ? String(storedProfile.graduation_year) : '',
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
      currentJobTitle: storedProfile?.current_job_title || '',
      currentCompany: storedProfile?.current_company || '',
      almaMater: storedProfile?.alma_mater || '',
      pastCompanies: storedProfile?.past_companies || [],
      goals: storedProfile?.goals || [],
      bio: storedProfile?.bio || '',
      career: storedProfile?.career || '',
      graduationYear: storedProfile?.graduation_year != null ? String(storedProfile.graduation_year) : '',
    };

    const sessionToken = signToken({ userId: userPayload.id, user: userPayload });

    res.json({ token: sessionToken, user: userPayload });
  } catch (err) {
    console.error('LinkedIn exchange error:', err?.response?.data || err.message);
    const message = err?.response?.data?.error_description || 'Authentication failed';
    res.status(500).json({ error: message });
  }
}

async function verifyToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[auth] validate: no token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const merged = await userService.getMergedUserForAuth(
      payload.user?.id,
      payload.user
    );
    console.log('[auth] validate: success userId=', merged?.id);
    res.json({ valid: true, user: merged });
  } catch (err) {
    const reason = err?.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    console.log('[auth] validate: token', reason);
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
}

/**
 * Serves an HTTPS page that redirects to the mobile deep link (airlinks://auth?token=…).
 * Required because SFSafariViewController cannot handle 302 redirects to custom URL schemes.
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

  const deepLink = buildMobileDeepLink(hasToken ? { token } : { error });
  console.log('[auth] serving redirect page, final URL:', deepLink.replace(/token=[^&]+/, 'token=***'));

  const deepLinkBase = config.MOBILE_DEEP_LINK_SCHEME || 'airlinks://auth';
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
      var target = new URL(${JSON.stringify(deepLinkBase)});
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

module.exports = {
  startLinkedInOAuth,
  handleLinkedInCallback,
  exchangeCode,
  verifyToken,
  serveRedirectPage,
  debugLinkedInConfig,
  buildLinkedInAuthorizationUrl,
};
