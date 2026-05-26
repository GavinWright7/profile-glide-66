#!/usr/bin/env node
'use strict';

const {
  requireEnv,
  saveReport,
  request,
  DEFAULT_CENTER,
  formatDuration,
  isConnectionError,
  printFailure,
} = require('../lib/common.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  requireEnv();
  const token = process.env.LOADTEST_JWT_TOKEN;
  const startedAt = Date.now();
  const concurrency = Number(process.env.LOADTEST_DB_CONCURRENCY || 200);
  let passed = true;
  const failures = [];
  const connectionErrors = [];

  console.log(`DB connection pool test (${concurrency} concurrent nearby queries)`);
  console.log(`Target: ${process.env.LOADTEST_BASE_URL}`);
  console.log('');

  console.log('Waiting 65s for rate limiter cooldown from previous tests...');
  await sleep(65000);

  const nearbyPromises = Array.from({ length: concurrency }, (_, i) =>
    request('GET', '/sharing/nearby', {
      token,
      query: {
        latitude: DEFAULT_CENTER.lat + i * 0.000001,
        longitude: DEFAULT_CENTER.lng,
        radiusMeters: 152.4,
        sort: 'distance',
      },
      timeoutMs: 30000,
    })
  );

  const nearbyResults = await Promise.all(nearbyPromises);
  const succeeded = nearbyResults.filter((r) => r.status === 200).length;
  const failed = nearbyResults.filter((r) => r.status !== 200);

  for (const result of nearbyResults) {
    if (isConnectionError(result)) {
      connectionErrors.push(result.error?.message || 'connection error');
      passed = false;
    }
    if (result.status >= 500) {
      passed = false;
      failures.push({ phase: 'nearby-burst', status: result.status, body: result.text?.slice(0, 200) });
      printFailure('nearby burst request', result, '200 or 429, not 5xx');
    }
  }

  console.log(`Nearby burst: ${succeeded}/${concurrency} returned 200`);
  if (connectionErrors.length) {
    console.error(`Connection errors: ${connectionErrors.length}`);
    connectionErrors.slice(0, 5).forEach((e) => console.error(`  ${e}`));
  }

  const discovery = await request('GET', '/debug/discovery-state', { token: null });
  if (discovery.status !== 200) {
    passed = false;
    printFailure('GET /debug/discovery-state', discovery, '200 with discoverable/has_location/recent counts');
    failures.push({ phase: 'discovery-state', status: discovery.status });
  }

  const state = discovery.json || {};
  const discoverable = Number(state.discoverable || 0);
  const hasLocation = Number(state.has_location || 0);
  const recent = Number(state.recent || 0);

  console.log('Discovery state:', state);

  if (!(discoverable > 0 && hasLocation > 0 && recent > 0)) {
    passed = false;
    failures.push({
      phase: 'discovery-state-counts',
      expected: 'discoverable, has_location, recent > 0',
      got: state,
    });
    printFailure(
      'discovery-state counts',
      { status: 200, text: JSON.stringify(state) },
      'discoverable > 0, has_location > 0, recent > 0'
    );
  }

  const durationMs = Date.now() - startedAt;
  const report = {
    test: 'DB Connection Pool',
    passed,
    durationMs,
    nearby: {
      concurrency,
      succeeded,
      failed: failed.length,
      connectionErrors: connectionErrors.length,
    },
    discoveryState: state,
    failures,
    keyMetric: `${succeeded}/${concurrency} succeeded`,
  };

  saveReport('db-connection', report);

  console.log('');
  console.log('=== DB Connection Test Summary ===');
  console.log(`Succeeded: ${succeeded}/${concurrency}`);
  console.log(`Connection errors: ${connectionErrors.length}`);
  console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
