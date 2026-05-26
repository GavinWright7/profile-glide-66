#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORTS_DIR="$ROOT_DIR/tests/reports"
mkdir -p "$REPORTS_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORTS_DIR/load-${TIMESTAMP}.json"

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
echo "Report: ${REPORT_FILE}"

cd "$SCRIPT_DIR"
artillery run "$SCRIPT_DIR/artillery-config.yml" --output "$REPORT_FILE"

echo ""
echo "=== Artillery Load Test Summary ==="

PARSE_EXIT=0
node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('${REPORT_FILE}', 'utf8'));
const p95 = report?.aggregate?.summaries?.['http.response_time']?.p95 || 0;
const errors = report?.aggregate?.counters?.['vusers.failed'] || 0;
const total = report?.aggregate?.counters?.['vusers.created'] || 1;
const errorRate = (errors / total) * 100;
console.log('p95:', p95, 'ms');
console.log('error rate:', errorRate.toFixed(2) + '%');
const passed = p95 <= 500 && errorRate <= 5;
const summary = {
  test: 'Artillery Load Test',
  passed,
  reportPath: '${REPORT_FILE}',
  p95Ms: Math.round(p95),
  errorRatePct: Number(errorRate.toFixed(2)),
  totalVusers: total,
  thresholds: { maxP95Ms: 500, maxErrorRatePct: 5 },
  keyMetric: 'p95: ' + Math.round(p95) + 'ms, errors: ' + errorRate.toFixed(1) + '%',
};
fs.writeFileSync('${REPORT_FILE}', JSON.stringify({ ...report, testSummary: summary }, null, 2));
if (p95 > 500 || errorRate > 5) { process.exit(1); } else { process.exit(0); }
" 2>/dev/null || PARSE_EXIT=$?

if [[ "$PARSE_EXIT" -ne 0 ]]; then
  echo "P95 response time limit: 500ms"
  echo "Error rate limit: 5%"
  echo "RESULT: FAIL"
  exit 1
fi

echo "P95 response time limit: 500ms"
echo "Error rate limit: 5%"
echo "RESULT: PASS"
exit 0
