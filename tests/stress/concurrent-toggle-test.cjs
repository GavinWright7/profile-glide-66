#!/usr/bin/env node
'use strict';

const {
  requireEnv,
  saveReport,
  request,
  DEFAULT_CENTER,
  formatDuration,
  printFailure,
} = require('../lib/common.cjs');

async function main() {
  requireEnv();
  const token = process.env.LOADTEST_JWT_TOKEN;
  const startedAt = Date.now();
  let passed = true;
  const failures = [];

  console.log('Concurrent discoverable toggle test (20 simultaneous writes)');
  console.log(`Target: ${process.env.LOADTEST_BASE_URL}`);
  console.log('');

  const toggleRequests = Array.from({ length: 20 }, (_, i) =>
    request('PATCH', '/profile/discoverable', {
      token,
      body: {
        isDiscoverable: i % 2 === 0,
        latitude: DEFAULT_CENTER.lat + i * 0.000001,
        longitude: DEFAULT_CENTER.lng,
      },
    })
  );

  const results = await Promise.all(toggleRequests);
  const statuses = results.map((r) => r.status);
  const serverErrors = results.filter((r) => r.status >= 500);
  const invalid = results.filter((r) => r.status !== 200 && r.status !== 429 && r.status !== 0);

  console.log(`Statuses: ${JSON.stringify(statuses)}`);

  if (serverErrors.length > 0) {
    passed = false;
    serverErrors.forEach((r) => {
      printFailure('concurrent toggle', r, '200 or 429 only — never 500');
      failures.push({ status: r.status, body: r.text?.slice(0, 200) });
    });
  }

  const badStatuses = results.filter(
    (r) => r.status !== 200 && r.status !== 429 && r.status !== 401
  );
  if (badStatuses.some((r) => r.status >= 500)) {
    passed = false;
  }

  const stateResult = await request('GET', '/debug/discovery-state', { token: null });
  const state = stateResult.json || {};
  const discoverable = Number(state.discoverable || 0);
  const hasLocation = Number(state.has_location || 0);

  console.log('Post-toggle discovery state:', state);

  if (stateResult.status !== 200) {
    passed = false;
    printFailure('GET /debug/discovery-state', stateResult, '200 with consistent counts');
    failures.push({ step: 'discovery-state', status: stateResult.status });
  }

  if (discoverable < 0 || hasLocation < 0 || Number.isNaN(discoverable)) {
    passed = false;
    failures.push({ step: 'db-consistency', state });
    printFailure(
      'DB consistency check',
      { status: 200, text: JSON.stringify(state) },
      'non-negative discoverable/has_location counts'
    );
  }

  const durationMs = Date.now() - startedAt;
  const report = {
    test: 'Concurrent Toggle',
    passed,
    durationMs,
    statuses,
    serverErrorCount: serverErrors.length,
    discoveryState: state,
    failures,
    keyMetric: passed ? 'No 500s, DB consistent' : 'Errors or inconsistent DB state',
  };

  saveReport('concurrent-toggle', report);

  console.log('');
  console.log('=== Concurrent Toggle Summary ===');
  console.log(`500 errors: ${serverErrors.length}`);
  console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
