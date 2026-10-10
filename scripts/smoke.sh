#!/usr/bin/env bash
# Smoke test: quick liveness check against local or deployed API.
# Usage:
#   bash scripts/smoke.sh                        # local (http://127.0.0.1:3000)
#   BASE_URL=https://xxxx.execute-api.../Prod bash scripts/smoke.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
FAIL=0

check() {
  local path="$1" expected="$2"
  local url="${BASE_URL}${path}"
  local code
  code="$(curl -s -o /tmp/smoke-body.json -w "%{http_code}" "$url")"
  if [[ "$code" == "$expected" ]]; then
    echo "PASS $url -> $code"
  else
    echo "FAIL $url -> got $code, want $expected"
    cat /tmp/smoke-body.json 2>/dev/null || true
    echo
    FAIL=1
  fi
}

echo "Smoke-testing $BASE_URL"
check "/health" "200"
check "/hello" "200"
check "/hello?name=smoke" "200"

if [[ "$FAIL" -ne 0 ]]; then
  echo "Smoke test FAILED"
  exit 1
fi
echo "Smoke test PASSED"
