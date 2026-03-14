const axios = require('axios');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const config = require('../config');

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

  const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  res.redirect(linkedInAuthUrl);
}

async function handleLinkedInCallback(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('LinkedIn OAuth error:', error, error_description);
    return res.redirect(
      `profileglide://auth?error=${encodeURIComponent(error_description || error)}`
    );
  }

  if (!code) {
    return res.redirect('profileglide://auth?error=missing_code');
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

    const sessionToken = jwt.sign(
      { userId: userPayload.id, user: userPayload },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const deepLink = `profileglide://auth?token=${encodeURIComponent(sessionToken)}`;
    res.redirect(deepLink);
  } catch (err) {
    console.error('LinkedIn auth error:', err?.response?.data || err.message);
    const message = err?.response?.data?.error_description || 'Authentication failed';
    res.redirect(`profileglide://auth?error=${encodeURIComponent(message)}`);
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

    const sessionToken = jwt.sign(
      { userId: userPayload.id, user: userPayload },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

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
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    res.json({ valid: true, user: payload.user });
  } catch {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}

module.exports = { startLinkedInOAuth, handleLinkedInCallback, exchangeCode, verifyToken };
