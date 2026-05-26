#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORTS_DIR="$ROOT_DIR/tests/reports"
mkdir -p "$REPORTS_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$REPORTS_DIR/load-${TIMESTAMP}.json"

export LOADTEST_BASE_URL="${LOADTEST_BASE_URL:-https://reliable-connection-production.up.railway.app}"

if [[ -z "${LOADTEST_JWT_TOKEN:-}" ]]; then
  echo "ERROR: LOADTEST_JWT_TOKEN is required"
  echo "  export LOADTEST_JWT_TOKEN=your_jwt_token_here"
  exit 1
fi

if ! command -v artillery >/dev/null 2>&1; then
  echo "Artillery not found — installing globally..."
  npm install -g artillery
fi

echo "Running Artillery load test against ${LOADTEST_BASE_URL}"
echo "Report: ${REPORT}"

cd "$SCRIPT_DIR"
artillery run "$SCRIPT_DIR/artillery-config.yml" --output "$REPORT"

node <<'NODE' "$REPORT"
const fs = require('fs');
const reportPath = process.argv[1];
const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const aggregate = raw.aggregate || {};
const latency = aggregate.latency || aggregate.summaries?.http?.response_time || {};
const p95 = latency.p95 ?? latency.p95_1000 ?? latency.max ?? 0;
const counters = aggregate.counters || {};
const total = counters['http.requests'] || counters['http.responses'] || 0;
const failed =
  counters['vusers.failed'] ||
  counters['errors.ETIMEDOUT'] ||
  counters['errors.ECONNREFUSED'] ||
  0;
const codes = aggregate.codes || {};
const errorResponses = Object.entries(codes).reduce((sum, [code, count]) => {
  const n = Number(code);
  if (Number.isFinite(n) && n >= 400) return sum + count;
  return sum;
}, 0);
const errorRate = total > 0 ? (errorResponses / total) * 100 : failed > 0 ? 100 : 0;
const passed = p95 <= 500 && errorRate <= 1;

const summary = {
  test: 'Artillery Load Test',
  passed,
  reportPath,
  p95Ms: Math.round(p95),
  errorRatePct: Number(errorRate.toFixed(2)),
  totalRequests: total,
  thresholds: { maxP95Ms: 500, maxErrorRatePct: 1 },
};
fs.writeFileSync(reportPath, JSON.stringify({ ...raw, testSummary: summary }, null, 2));

console.log('');
console.log('=== Artillery Load Test Summary ===');
console.log(`P95 response time: ${Math.round(p95)}ms (limit: 500ms)`);
console.log(`Error rate: ${errorRate.toFixed(2)}% (limit: 1%)`);
console.log(`Total requests: ${total}`);
if (passed) {
  console.log('RESULT: PASS');
  process.exit(0);
}
console.log('RESULT: FAIL');
process.exit(1);
NODE
