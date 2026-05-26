#!/usr/bin/env node
'use strict';

const {
  requireEnv,
  saveReport,
  request,
  DEFAULT_CENTER,
  printFailure,
} = require('../lib/common.cjs');

async function burst(label, fn, count) {
  const results = await Promise.all(
    Array.from({ length: count }, (_, i) => fn(i))
  );
  return { label, count, results };
}

function analyzeBurst(burstResult, limitHint) {
  const { results } = burstResult;
  const successes = results.filter((r) => r.status >= 200 && r.status < 300);
  const rateLimited = results.filter((r) => r.status === 429);
  const serverErrors = results.filter((r) => r.status >= 500);
  const overLimit = results.filter((r) => r.status !== 200 && r.status !== 201);
  const badOverLimit = overLimit.filter((r) => r.status !== 429);
  return {
    label: burstResult.label,
    total: burstResult.count,
    successes: successes.length,
    rateLimited: rateLimited.length,
    serverErrors,
    badOverLimit,
    limitHint,
  };
}

async function main() {
  requireEnv();
  const token = process.env.LOADTEST_JWT_TOKEN;
  const startedAt = Date.now();
  const failures = [];
  let passed = true;

  console.log('Rate limit protection test');
  console.log(`Target: ${process.env.LOADTEST_BASE_URL}`);
  console.log('');

  const heartbeatBurst = await burst(
    'heartbeat',
    () =>
      request('POST', '/sharing/heartbeat', {
        token,
        body: {
          latitude: DEFAULT_CENTER.lat,
          longitude: DEFAULT_CENTER.lng,
        },
      }),
    50
  );

  const nearbyBurst = await burst(
    'nearby',
    () =>
      request('GET', '/sharing/nearby', {
        token,
        query: {
          latitude: DEFAULT_CENTER.lat,
          longitude: DEFAULT_CENTER.lng,
          radiusMeters: 152.4,
          sort: 'distance',
        },
      }),
    50
  );

  const toggleBurst = await burst(
    'discoverable toggle',
    (i) =>
      request('PATCH', '/profile/discoverable', {
        token,
        body: {
          isDiscoverable: i % 2 === 0,
          latitude: DEFAULT_CENTER.lat,
          longitude: DEFAULT_CENTER.lng,
        },
      }),
    20
  );

  const analyses = [
    analyzeBurst(heartbeatBurst, 'heartbeat max ~60/min'),
    analyzeBurst(nearbyBurst, 'nearby max ~40/min'),
    analyzeBurst(toggleBurst, 'discoverable max ~10/min'),
  ];

  for (const analysis of analyses) {
    console.log(`--- ${analysis.label} (${analysis.limitHint}) ---`);
    console.log(`  2xx responses: ${analysis.successes}`);
    console.log(`  429 responses: ${analysis.rateLimited}`);
    console.log(`  500 responses: ${analysis.serverErrors.length}`);

    if (analysis.serverErrors.length > 0) {
      passed = false;
      analysis.serverErrors.forEach((r) => {
        printFailure(`${analysis.label} returned 500`, r, '429 for over-limit, never 500');
        failures.push({ endpoint: analysis.label, status: r.status, body: r.text?.slice(0, 200) });
      });
    }

    const bad = analysis.badOverLimit.filter(
      (r) => r.status !== 401 && r.status !== 403 && r.status !== 0
    );
    if (bad.length > 0) {
      passed = false;
      bad.forEach((r) => {
        printFailure(`${analysis.label} over-limit response`, r, '429 once rate limit is hit');
        failures.push({ endpoint: analysis.label, status: r.status });
      });
    }

    if (analysis.rateLimited === 0 && analysis.successes === analysis.total) {
      console.warn(`  WARN: no 429 observed — rate limiter may not have engaged for ${analysis.label}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  const report = {
    test: 'Rate Limit Protection',
    passed,
    durationMs,
    analyses: analyses.map(
      ({ label, total, successes, rateLimited, serverErrors, badOverLimit, limitHint }) => ({
        label,
        total,
        successes,
        rateLimited,
        serverErrors: serverErrors.map((r) => r.status),
        badOverLimit: badOverLimit.map((r) => r.status),
        limitHint,
      })
    ),
    failures,
    keyMetric: passed ? 'All 429s correct' : 'Server errors detected',
  };

  saveReport('rate-limit', report);

  console.log('');
  console.log('=== Rate Limit Summary ===');
  console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
