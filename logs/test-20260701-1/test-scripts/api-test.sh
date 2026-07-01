#!/usr/bin/env bash
# API Environment Test Suite for opencode-pets
# Base URL: http://192.168.137.197

set -euo pipefail
BASE_URL="http://192.168.137.197"
LOG_DIR="logs/test-20260701-1/test-logs"
PASS=0
FAIL=0

log_test() {
  local id="$1" endpoint="$2" expected="$3"
  local start=$(date +%s%N)
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${BASE_URL}/${endpoint}" -X GET 2>/dev/null || echo "000")
  local end=$(date +%s%N)
  local elapsed=$(( (end - start) / 1000000 ))  # ms

  if [ "$http_code" = "$expected" ]; then
    echo "  ✅ ${id}: GET /${endpoint} → ${http_code} (${elapsed}ms)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ ${id}: GET /${endpoint} → ${http_code} (expected ${expected})"
    FAIL=$((FAIL + 1))
  fi
}

log_post_test() {
  local id="$1" endpoint="$2" expected="$3"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${BASE_URL}/${endpoint}" -X POST 2>/dev/null || echo "000")

  if [ "$http_code" = "$expected" ]; then
    echo "  ✅ ${id}: POST /${endpoint} → ${http_code} (expected ${expected})"
    PASS=$((PASS + 1))
  else
    echo "  ❌ ${id}: POST /${endpoint} → ${http_code} (expected ${expected})"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "  opencode-pets API Environment Tests"
echo "  Base URL: ${BASE_URL}"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# ── Connectivity check ──
echo "── Connectivity ──"
if curl -s --connect-timeout 3 "${BASE_URL}" > /dev/null 2>&1; then
  echo "  ✅ Server reachable"
else
  echo "  ❌ Server unreachable at ${BASE_URL}"
  exit 1
fi
echo ""

# ── All 7 GET endpoints ──
echo "── GET Endpoints ──"
log_test "API-01" "thinking"  "200"
log_test "API-02" "idle"      "200"
log_test "API-03" "working"   "200"
log_test "API-04" "reading"   "200"
log_test "API-05" "writing"   "200"
log_test "API-06" "runing"    "200"
log_test "API-07" "sleeping"  "200"
echo ""

# ── POST returns 405 ──
echo "── POST Endpoints (verify 405) ──"
log_post_test "API-09" "thinking" "405"
echo ""

# ── Response body check ──
echo "── Response Body ──"
body=$(curl -s --connect-timeout 5 "${BASE_URL}/thinking")
if echo "$body" | grep -q '"code"'; then
  echo "  ✅ Response body: ${body}"
else
  echo "  ❌ Unexpected response body: ${body}"
  FAIL=$((FAIL + 1))
fi
echo ""

# ── Concurrent calls ──
echo "── Concurrent Calls (10 parallel) ──"
results=$(for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" --connect-timeout 5 "${BASE_URL}/working" &
done
wait)
all_ok=true
for code in $results; do
  [ "$code" != "200" ] && all_ok=false
done
if $all_ok; then
  echo "  ✅ 10 concurrent calls all returned 200"
  PASS=$((PASS + 1))
else
  echo "  ❌ Some concurrent calls failed"
  FAIL=$((FAIL + 1))
fi
echo ""

# ── Summary ──
echo "========================================"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "  Total: $((PASS + FAIL))"
echo "========================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
