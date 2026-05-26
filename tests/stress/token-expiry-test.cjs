#!/usr/bin/env node
'use strict';

const {
  requireEnv,
  saveReport,
  request,
  createExpiredJwt,
  DEFAULT_CENTER,
  formatDuration,
  printFailure,
} = require('../lib/common.cjs');

async function main() {
  requireEnv();
  const validToken = process.env.LOADTEST_JWT_TOKEN;
  const secret = process.env.LOADTEST_JWT_SECRET || '';
  const expiredToken = createExpiredJwt(validToken, secret);
  const startedAt = Date.now();
  let passed = true;
  const failures = [];
  const checks = [];

  console.log('Token expiry handling test');
  console.log(`Target: ${process.env.LOADTEST_BASE_URL}`);
  console.log('');

  const expiredCalls = [
    {
      name: 'heartbeat (expired token)',
      run: () =>
        request('POST', '/sharing/heartbeat', {
          token: expiredToken,
          body: { latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng },
        }),
    },
    {
      name: 'nearby (expired token)',
      run: () =>
        request('GET', '/sharing/nearby', {
          token: expiredToken,
          query: {
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
            radiusMeters: 152.4,
          },
        }),
    },
    {
      name: 'discoverable (expired token)',
      run: () =>
        request('PATCH', '/profile/discoverable', {
          token: expiredToken,
          body: {
            isDiscoverable: true,
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
          },
        }),
    },
  ];

  for (const call of expiredCalls) {
    const result = await call.run();
    checks.push({ phase: 'expired', name: call.name, status: result.status });
    if (result.status !== 401) {
      passed = false;
      printFailure(call.name, result, '401 Unauthorized');
      failures.push({ name: call.name, status: result.status, expected: 401 });
    } else {
      console.log(`  ✓ ${call.name} → 401`);
    }
  }

  const validCalls = [
    {
      name: 'heartbeat (valid token)',
      run: () =>
        request('POST', '/sharing/heartbeat', {
          token: validToken,
          body: { latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng },
        }),
      expect: (status) => status === 200 || status === 429,
    },
    {
      name: 'nearby (valid token)',
      run: () =>
        request('GET', '/sharing/nearby', {
          token: validToken,
          query: {
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
            radiusMeters: 152.4,
            sort: 'distance',
          },
        }),
      expect: (status) => status === 200 || status === 429,
    },
    {
      name: 'discoverable (valid token)',
      run: () =>
        request('PATCH', '/profile/discoverable', {
          token: validToken,
          body: {
            isDiscoverable: true,
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
          },
        }),
      expect: (status) => status === 200 || status === 429,
    },
  ];

  for (const call of validCalls) {
    const result = await call.run();
    checks.push({ phase: 'valid', name: call.name, status: result.status });
    if (!call.expect(result.status)) {
      passed = false;
      printFailure(call.name, result, '200 (or 429 if rate limited)');
      failures.push({ name: call.name, status: result.status, expected: '200 or 429' });
    } else {
      console.log(`  ✓ ${call.name} → ${result.status}`);
    }
    if (result.status >= 500) {
      passed = false;
      failures.push({ name: call.name, status: result.status, crash: true });
    }
  }

  const durationMs = Date.now() - startedAt;
  const report = {
    test: 'Token Expiry Handling',
    passed,
    durationMs,
    checks,
    failures,
    keyMetric: passed ? 'All 401s clean' : 'Auth handling failed',
  };

  saveReport('token-expiry', report);

  console.log('');
  console.log('=== Token Expiry Summary ===');
  console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
