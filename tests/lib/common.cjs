/**
 * Shared helpers for infrastructure stress/load tests.
 * Node 18+ (native fetch). Optional: node-fetch on older Node.
 */
const fs = require('fs');
const path = require('path');
const { createHmac } = require('crypto');
const { performance } = require('perf_hooks');

const DEFAULT_BASE_URL = 'https://reliable-connection-production.up.railway.app';
const DEFAULT_CENTER = { lat: 37.7858, lng: -122.4064 };

let fetchImpl = globalThis.fetch;

async function ensureFetch() {
  if (fetchImpl) return fetchImpl;
  try {
    ({ default: fetchImpl } = await import('node-fetch'));
    return fetchImpl;
  } catch {
    throw new Error('fetch is unavailable. Use Node.js 18+ or install node-fetch.');
  }
}

function getBaseUrl() {
  return (process.env.LOADTEST_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getJwtToken() {
  return process.env.LOADTEST_JWT_TOKEN || '';
}

function requireEnv() {
  const missing = [];
  if (!getBaseUrl()) missing.push('LOADTEST_BASE_URL');
  if (!getJwtToken()) missing.push('LOADTEST_JWT_TOKEN');
  if (missing.length) {
    console.error(`ERROR: Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('Example:');
    console.error('  export LOADTEST_BASE_URL=https://reliable-connection-production.up.railway.app');
    console.error('  export LOADTEST_JWT_TOKEN=your_jwt_token_here');
    process.exit(1);
  }
}

function reportsDir() {
  const dir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function timestampSlug() {
  if (process.env.LOADTEST_RUN_ID) return process.env.LOADTEST_RUN_ID;
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function saveReport(basename, data) {
  const file = path.join(reportsDir(), `${basename}-${timestampSlug()}.json`);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Report saved: ${file}`);
  return file;
}

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function randomCoordsNear(centerLat, centerLng, radiusMeters) {
  const r = radiusMeters * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const deltaLat = (r * Math.cos(theta)) / 111320;
  const deltaLon =
    (r * Math.sin(theta)) / (111320 * Math.cos((centerLat * Math.PI) / 180));
  return {
    lat: centerLat + deltaLat,
    lng: centerLng + deltaLon,
  };
}

function buildUrl(routePath, query) {
  const url = new URL(routePath.startsWith('/') ? routePath : `/${routePath}`, `${getBaseUrl()}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request(method, routePath, options = {}) {
  const fetch = await ensureFetch();
  const {
    token = getJwtToken(),
    body,
    query,
    timeoutMs = 15000,
    headers = {},
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const init = {
      method,
      headers: {
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      signal: controller.signal,
    };
    if (body != null) init.body = JSON.stringify(body);

    const res = await fetch(buildUrl(routePath, query), init);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return {
      ok: res.ok,
      status: res.status,
      json,
      text,
      durationMs: performance.now() - started,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: '',
      durationMs: performance.now() - started,
      error: err,
    };
  } finally {
    clearTimeout(timer);
  }
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function base64UrlEncode(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${unsigned}.${signature}`;
}

function createExpiredJwt(validToken, secret) {
  const payload = decodeJwtPayload(validToken) || {};
  const userId = payload.userId || payload.user?.id || 'expired-test-user';
  const expiredPayload = {
    userId,
    user: payload.user || { id: userId },
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  };
  if (secret) return signJwt(expiredPayload, secret);
  return `${base64UrlEncode({ alg: 'HS256', typ: 'JWT' })}.${base64UrlEncode(expiredPayload)}.invalid-signature`;
}

function isConnectionError(result) {
  if (!result.error) return false;
  const msg = `${result.error.message || ''} ${result.error.code || ''}`.toLowerCase();
  return (
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout') ||
    msg.includes('socket') ||
    msg.includes('aborted') ||
    msg.includes('fetch failed')
  );
}

function printFailure(label, result, expected) {
  console.error(`FAIL: ${label}`);
  console.error(`  Expected: ${expected}`);
  console.error(`  Got status: ${result.status || 'NO_RESPONSE'}`);
  if (result.error) console.error(`  Error: ${result.error.message}`);
  if (result.text) console.error(`  Body: ${result.text.slice(0, 300)}`);
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_CENTER,
  ensureFetch,
  getBaseUrl,
  getJwtToken,
  requireEnv,
  reportsDir,
  saveReport,
  formatDuration,
  percentile,
  randomCoordsNear,
  buildUrl,
  request,
  decodeJwtPayload,
  createExpiredJwt,
  isConnectionError,
  printFailure,
};
