#!/usr/bin/env node
'use strict';

const {
  requireEnv,
  saveReport,
  request,
  percentile,
  randomCoordsNear,
  DEFAULT_CENTER,
  formatDuration,
  printFailure,
} = require('../lib/common.cjs');

/** Default 1 — simulates one real user (~20 heartbeats/min). Use >1 only to stress server with multiple tokens. */
const USER_COUNT = Number(process.env.LOADTEST_HEARTBEAT_USERS || 1);
const INTERVAL_MS = Number(process.env.LOADTEST_HEARTBEAT_INTERVAL_MS || 3000);
const DURATION_MS = Number(process.env.LOADTEST_HEARTBEAT_DURATION_MS || 120000);
const RADIUS_METERS = Number(process.env.LOADTEST_HEARTBEAT_RADIUS_M || 152.4);
const SINGLE_TOKEN_SHARED_BUCKET = USER_COUNT > 1;

async function main() {
  requireEnv();
  const token = process.env.LOADTEST_JWT_TOKEN;
  const startedAt = Date.now();
  const endAt = startedAt + DURATION_MS;

  const latencies = [];
  let totalRequests = 0;
  let successCount = 0;
  let error429 = 0;
  let error500 = 0;
  const failures = [];

  console.log(
    `Heartbeat stress: ${USER_COUNT} virtual client(s), every ${INTERVAL_MS / 1000}s for ${formatDuration(DURATION_MS)}`
  );
  console.log(`Target: ${process.env.LOADTEST_BASE_URL}`);

  if (SINGLE_TOKEN_SHARED_BUCKET) {
    console.log('');
    console.warn(
      'NOTE: All virtual clients share one LOADTEST_JWT_TOKEN (one rate-limit bucket).'
    );
    console.warn(
      '429 responses are expected with USER_COUNT > 1. This run only FAILs on 500 errors.'
    );
  } else {
    console.log('Mode: single-user simulation (~20 heartbeats/min, limit 60/min).');
  }
  console.log('');

  const loops = Array.from({ length: USER_COUNT }, (_, userIndex) => {
    const coords = randomCoordsNear(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, RADIUS_METERS);
    const startJitterMs = SINGLE_TOKEN_SHARED_BUCKET
      ? Math.floor((INTERVAL_MS / USER_COUNT) * userIndex)
      : userIndex * 250;

    return (async () => {
      if (startJitterMs > 0) {
        await new Promise((r) => setTimeout(r, startJitterMs));
      }

      while (Date.now() < endAt) {
        const jittered = randomCoordsNear(coords.lat, coords.lng, 20);
        const result = await request('POST', '/sharing/heartbeat', {
          token,
          body: { latitude: jittered.lat, longitude: jittered.lng },
        });
        totalRequests += 1;
        latencies.push(result.durationMs);

        if (result.status === 200) successCount += 1;
        else if (result.status === 429) error429 += 1;
        else if (result.status >= 500) {
          error500 += 1;
          failures.push({
            userIndex,
            status: result.status,
            body: result.text?.slice(0, 200),
          });
        } else if (result.status === 0) {
          failures.push({
            userIndex,
            status: 0,
            error: result.error?.message,
          });
        }

        if (totalRequests % 10 === 0) {
          const elapsed = formatDuration(Date.now() - startedAt);
          const rate = totalRequests
            ? ((successCount / totalRequests) * 100).toFixed(1)
            : '0.0';
          process.stdout.write(
            `\r[${elapsed}] sent=${totalRequests} ok=${successCount} (${rate}%) 429=${error429} 500=${error500}   `
          );
        }

        const intervalJitter = SINGLE_TOKEN_SHARED_BUCKET
          ? INTERVAL_MS * USER_COUNT
          : INTERVAL_MS + Math.floor(Math.random() * 400);
        await new Promise((r) => setTimeout(r, intervalJitter));
      }
    })();
  });

  await Promise.all(loops);
  console.log('\n');

  const durationMs = Date.now() - startedAt;
  const avgMs = latencies.length
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;
  const p95Ms = percentile(latencies, 95);
  const successRate = totalRequests ? (successCount / totalRequests) * 100 : 0;

  let passed;
  if (SINGLE_TOKEN_SHARED_BUCKET) {
    passed = error500 === 0;
  } else {
    passed = error500 === 0 && successRate >= 50;
    if (!passed && successRate < 50) {
      printFailure(
        'single-user heartbeat success rate',
        { status: 200, text: `${successRate.toFixed(1)}% success` },
        '>= 50% success with ~20 heartbeats/min under 60/min limit'
      );
    }
  }

  const report = {
    test: 'Heartbeat Stress',
    passed,
    durationMs,
    config: {
      USER_COUNT,
      INTERVAL_MS,
      DURATION_MS,
      RADIUS_METERS,
      singleTokenSharedBucket: SINGLE_TOKEN_SHARED_BUCKET,
    },
    metrics: {
      totalRequests,
      successCount,
      successRatePct: Number(successRate.toFixed(2)),
      averageResponseMs: Number(avgMs.toFixed(2)),
      p95ResponseMs: Number(p95Ms.toFixed(2)),
      error429,
      error500,
    },
    failures: failures.slice(0, 20),
    keyMetric: SINGLE_TOKEN_SHARED_BUCKET
      ? `p95: ${Math.round(p95Ms)}ms, 500s: ${error500} (429s expected)`
      : `p95: ${Math.round(p95Ms)}ms, success: ${successRate.toFixed(0)}%`,
  };

  saveReport('heartbeat-stress', report);

  console.log('=== Heartbeat Stress Summary ===');
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Success rate: ${successRate.toFixed(2)}%`);
  console.log(`Average response: ${avgMs.toFixed(0)}ms`);
  console.log(`P95 response: ${p95Ms.toFixed(0)}ms`);
  console.log(`429 responses: ${error429}${SINGLE_TOKEN_SHARED_BUCKET ? ' (expected with shared token)' : ''}`);
  console.log(`500 errors: ${error500}`);
  console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
  if (!passed && failures.length) {
    console.error('Sample failures:');
    failures.slice(0, 5).forEach((f) => console.error(`  ${JSON.stringify(f)}`));
  }
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
