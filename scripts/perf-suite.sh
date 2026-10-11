#!/usr/bin/env bash
# Full k6 performance suite with zero manual setup (Docker-based k6,
# no global k6 install needed).
#
# - Default target is SAM Local at http://127.0.0.1:3000: ensures
#   DynamoDB Local is up + the table exists, then starts the API via
#   `npm run local:start` (which builds first) if /health is not
#   already OK. An already-healthy API is reused and left running —
#   same contract as Playwright's reuseExistingServer.
# - If BASE_URL points elsewhere (LocalStack, deployed API), local
#   orchestration is skipped and the suite runs straight against it.
# - Only the API this script started is stopped on exit.
#
# Usage:
#   npm run tests:perf
#   BASE_URL=$(npm run -s stack:url) npm run tests:perf
#   PERF_TESTS="tests/performance/products/create-products-load-test.ts" npm run tests:perf
#
# Env:
#   BASE_URL   (default http://127.0.0.1:3000)
#   PERF_TESTS (default all tests/performance/*-load-test.ts, sorted)
#   K6_IMAGE   (forwarded to scripts/k6-docker.sh)
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
export BASE_URL

if [[ -z "${PERF_TESTS:-}" ]]; then
  PERF_TESTS="$(find tests/performance -name '*-load-test.ts' | sort | tr '\n' ' ')"
fi

api_healthy() {
  [[ "$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$BASE_URL/health" || true)" == "200" ]]
}

is_local_target() {
  case "$BASE_URL" in
    http://127.0.0.1* | http://localhost*) return 0 ;;
    *) return 1 ;;
  esac
}

STARTED_API=0
API_PID=""
API_LOG=""

cleanup() {
  if [[ "$STARTED_API" -eq 1 && -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    echo "Stopping suite-owned API (pid $API_PID) ..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if is_local_target; then
  if api_healthy; then
    echo "API already healthy at $BASE_URL — reusing it."
  else
    echo "Booting local dependencies ..."
    # Same reuse contract as scripts/sam-dev.sh: the container may have
    # been started from another checkout (compose project), in which case
    # `docker-compose up` would fail with a container-name Conflict —
    # so reuse it when running, restart it when stopped, and only let
    # compose create it when it is truly missing.
    CONTAINER_NAME="aws-study-dynamodb-local"
    if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo "missing")" = "true" ]; then
      echo "DynamoDB Local already running ($CONTAINER_NAME) — reusing it."
    elif docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
      echo "DynamoDB Local container exists but is stopped — starting it ..."
      docker start "$CONTAINER_NAME" >/dev/null
    else
      echo "Starting DynamoDB Local ..."
      docker-compose up -d dynamodb-local
    fi
    bash scripts/dynamo-local.sh
    API_LOG="$(mktemp /tmp/perf-suite-api.XXXXXX)"
    echo "Starting SAM Local API (log: $API_LOG) ..."
    npm run local:start >"$API_LOG" 2>&1 &
    API_PID="$!"
    STARTED_API=1
    echo "Waiting for $BASE_URL/health (up to 240s) ..."
    for i in $(seq 1 120); do
      if api_healthy; then
        break
      fi
      if ! kill -0 "$API_PID" 2>/dev/null; then
        echo "ERROR: API exited before becoming healthy. Last 30 log lines:" >&2
        tail -30 "$API_LOG" >&2 || true
        exit 1
      fi
      if [[ "$i" -eq 120 ]]; then
        echo "ERROR: API did not become healthy in 240s. Last 30 log lines:" >&2
        tail -30 "$API_LOG" >&2 || true
        exit 1
      fi
      sleep 2
    done
    echo "API healthy at $BASE_URL."
  fi
else
  echo "BASE_URL=$BASE_URL is not local — skipping local boot."
fi

pass=0
fail=0
failed_tests=""
# Word-splitting PERF_TESTS on purpose: space-separated test list.
# shellcheck disable=SC2086
for t in $PERF_TESTS; do
  if [[ ! -f "$t" ]]; then
    echo "ERROR: performance test not found: $t" >&2
    exit 1
  fi
  echo
  echo "=== k6: $t ==="
  if bash scripts/k6-docker.sh "$t"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    failed_tests="$failed_tests $t"
  fi
done

echo
echo "perf suite: $pass passed, $fail failed."
if [[ "$fail" -gt 0 ]]; then
  echo "failed:$failed_tests" >&2
  exit 1
fi
