#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { requireEnv, formatDuration, reportsDir } = require('./lib/common.cjs');

const ROOT = path.join(__dirname, '..');
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const TESTS = [
  {
    name: 'Heartbeat Stress (single user)',
    script: 'tests/stress/heartbeat-stress.cjs',
    type: 'node',
    reportPrefix: 'heartbeat-stress',
    defaultMetric: 'p95 + error rate',
  },
  {
    name: 'Rate Limit Protection',
    script: 'tests/stress/rate-limit-test.cjs',
    type: 'node',
    reportPrefix: 'rate-limit',
    defaultMetric: 'All 429s correct',
  },
  {
    name: 'DB Connection Pool',
    script: 'tests/stress/db-connection-test.cjs',
    type: 'node',
    reportPrefix: 'db-connection',
    defaultMetric: '200/200 succeeded',
  },
  {
    name: 'Background Persistence',
    script: 'tests/stress/background-persistence-test.cjs',
    type: 'node',
    reportPrefix: 'background-persistence',
    defaultMetric: 'Still discoverable ✓',
  },
  {
    name: 'Token Expiry Handling',
    script: 'tests/stress/token-expiry-test.cjs',
    type: 'node',
    reportPrefix: 'token-expiry',
    defaultMetric: 'All 401s clean',
  },
  {
    name: 'Concurrent Toggle',
    script: 'tests/stress/concurrent-toggle-test.cjs',
    type: 'node',
    reportPrefix: 'concurrent-toggle',
    defaultMetric: 'No 500s, DB consistent',
  },
  {
    name: 'Artillery Load Test',
    script: 'tests/load/run-load-test.sh',
    type: 'shell',
    reportPrefix: 'load',
    defaultMetric: 'p95 <= 500ms, errors <= 1%',
  },
];

function findLatestReport(prefix) {
  const dir = reportsDir();
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.json'))
    .map((f) => ({
      file: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.file || null;
}

function readReportMetric(reportPath, fallback) {
  if (!reportPath || !fs.existsSync(reportPath)) return fallback;
  try {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    return data.keyMetric || data.testSummary?.keyMetric || fallback;
  } catch {
    return fallback;
  }
}

function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function runTest(test) {
  const started = Date.now();
  const env = { ...process.env, LOADTEST_RUN_ID: RUN_ID };
  const scriptPath = path.join(ROOT, test.script);

  console.log(`\n${C.bold}${C.cyan}▶ ${test.name}${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);

  let result;
  if (test.type === 'shell') {
    result = spawnSync('bash', [scriptPath], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });
  } else {
    result = spawnSync(process.execPath, [scriptPath], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });
  }

  const durationMs = Date.now() - started;
  const passed = result.status === 0;
  const reportPath = findLatestReport(test.reportPrefix);
  const keyMetric = readReportMetric(reportPath, test.defaultMetric);

  return {
    name: test.name,
    passed,
    durationMs,
    keyMetric,
    reportPath,
  };
}

function printTable(rows) {
  const cols = [
    { key: 'name', width: 29 },
    { key: 'status', width: 8 },
    { key: 'duration', width: 10 },
    { key: 'keyMetric', width: 25 },
  ];

  const header = cols.map((c) => pad(c.key === 'name' ? 'Test' : c.key === 'status' ? 'Status' : c.key === 'duration' ? 'Duration' : 'Key Metric', c.width)).join(' │ ');
  const rule = '─'.repeat(header.length + 2);

  console.log(`\n${C.bold}Test Run Summary${C.reset}`);
  console.log(`┌${rule}┐`);
  console.log(`│ ${header} │`);
  console.log(`├${rule}┤`);

  for (const row of rows) {
    const statusText = row.passed ? 'PASS' : 'FAIL';
    const line = [
      pad(row.name, 29),
      pad(statusText, 8),
      pad(formatDuration(row.durationMs), 10),
      pad(row.keyMetric, 25),
    ].join(' │ ');
    const coloredStatus = row.passed ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;
    const coloredLine = line.replace(statusText, coloredStatus);
    console.log(`│ ${coloredLine} │`);
  }

  console.log(`└${rule}┘`);
}

function main() {
  requireEnv();
  fs.mkdirSync(reportsDir(), { recursive: true });

  console.log(`${C.bold}AirLinks Infrastructure Test Suite${C.reset}`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log(`Base URL: ${process.env.LOADTEST_BASE_URL}`);
  console.log(`Reports: ${reportsDir()}`);

  const results = [];
  for (const test of TESTS) {
    results.push(runTest(test));
  }

  printTable(results);

  const allPassed = results.every((r) => r.passed);
  console.log('');
  if (allPassed) {
    console.log(`${C.green}${C.bold}All tests passed.${C.reset}`);
    process.exit(0);
  }
  console.log(`${C.red}${C.bold}Some tests failed.${C.reset}`);
  process.exit(1);
}

main();
