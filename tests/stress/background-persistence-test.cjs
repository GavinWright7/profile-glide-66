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

const WAIT_MS = Number(
  process.env.LOADTEST_PERSISTENCE_WAIT_MS || 10 * 60 * 1000
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  requireEnv();
  const token = process.env.LOADTEST_JWT_TOKEN;
  const startedAt = Date.now();
  let passed = true;
  const failures = [];
  const steps = [];

  console.log('Background persistence test');
  console.log(`Target: ${process.env.LOADTEST_BASE_URL}`);
  console.log(`Idle wait: ${formatDuration(WAIT_MS)}`);
  console.log('');

  console.log('Waiting 65s for rate limiter cooldown from previous tests...');
  await sleep(65000);

  const toggleOn = await request('PATCH', '/profile/discoverable', {
    token,
    body: {
      isDiscoverable: true,
      latitude: DEFAULT_CENTER.lat,
      longitude: DEFAULT_CENTER.lng,
    },
  });
  steps.push({ step: 'discoverable-on', status: toggleOn.status });
  if (toggleOn.status !== 200) {
    passed = false;
    printFailure('PATCH /profile/discoverable true', toggleOn, '200');
    failures.push({ step: 'discoverable-on', status: toggleOn.status });
  }

  const heartbeat = await request('POST', '/sharing/heartbeat', {
    token,
    body: { latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng },
  });
  steps.push({
    step: 'initial-heartbeat',
    status: heartbeat.status,
    lastHeartbeatAt: heartbeat.json?.lastHeartbeatAt,
  });
  if (heartbeat.status !== 200) {
    passed = false;
    printFailure('POST /sharing/heartbeat', heartbeat, '200');
    failures.push({ step: 'initial-heartbeat', status: heartbeat.status });
  }

  const heartbeatAt = heartbeat.json?.lastHeartbeatAt
    ? new Date(heartbeat.json.lastHeartbeatAt)
    : new Date();

  const beforeState = await request('GET', '/debug/discovery-state', { token: null });
  steps.push({ step: 'discovery-state-before-wait', body: beforeState.json });

  console.log(`Waiting ${formatDuration(WAIT_MS)} (simulating app closed / no heartbeats)...`);
  const waitStarted = Date.now();
  while (Date.now() - waitStarted < WAIT_MS) {
    const remaining = WAIT_MS - (Date.now() - waitStarted);
    process.stdout.write(`\r  remaining: ${formatDuration(remaining)}   `);
    await new Promise((r) => setTimeout(r, Math.min(10000, remaining)));
  }
  console.log('\n');

  const afterState = await request('GET', '/debug/discovery-state', { token: null });
  const recent = Number(afterState.json?.recent || 0);
  steps.push({ step: 'discovery-state-after-wait', body: afterState.json });

  if (recent <= 0) {
    passed = false;
    printFailure(
      'recent count after wait',
      { status: afterState.status, text: JSON.stringify(afterState.json) },
      'recent > 0 (user still within 24h window)'
    );
    failures.push({ step: 'recent-count', got: recent, expected: '> 0' });
  }

  const ageMs = Date.now() - heartbeatAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const within24h = ageHours < 24;
  steps.push({
    step: 'last-seen-age',
    lastHeartbeatAt: heartbeatAt.toISOString(),
    ageHours: Number(ageHours.toFixed(2)),
    within24h,
  });

  if (!within24h) {
    passed = false;
    failures.push({
      step: 'last-seen-age',
      expected: '< 24 hours',
      gotHours: ageHours,
    });
    printFailure(
      'last_seen_at age via heartbeat timestamp',
      { status: 200, text: `${ageHours.toFixed(2)} hours old` },
      'less than 24 hours old'
    );
  }

  const durationMs = Date.now() - startedAt;
  const report = {
    test: 'Background Persistence',
    passed,
    durationMs,
    waitMs: WAIT_MS,
    steps,
    failures,
    keyMetric: passed ? 'Still discoverable ✓' : 'User disappeared from 24h window',
  };

  saveReport('background-persistence', report);

  console.log('=== Background Persistence Summary ===');
  console.log(`Recent users (24h): ${recent}`);
  console.log(`Last heartbeat age: ${ageHours.toFixed(2)} hours`);
  console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
