#!/usr/bin/env bash
# Full k6 performance suite against LocalStack, with zero manual setup
# (Docker-based k6, no global k6 install needed).
#
# - Ensures the emulator is up and the stack is deployed
#   (scripts/localstack-boot.sh), then resolves BASE_URL from the deployed
#   REST API. An already-deployed stack is reused and left running.
# - Set BASE_URL explicitly to skip the boot and run against that API.
#
# Usage:
#   npm run tests:perf
#   PERF_TESTS="tests/performance/products/create-products-load-test.ts" npm run tests:perf
#   BASE_URL=https://... npm run tests:perf
#
# Env:
#   BASE_URL   (default: resolved from LocalStack after boot)
#   PERF_TESTS (default all tests/performance/*-load-test.ts, sorted)
#   K6_IMAGE   (forwarded to scripts/k6-docker.sh)
set -euo pipefail

if [[ -z "${PERF_TESTS:-}" ]]; then
  PERF_TESTS="$(find tests/performance -name '*-load-test.ts' | sort | tr '\n' ' ')"
fi

if [[ -z "${BASE_URL:-}" ]]; then
  bash scripts/localstack-boot.sh
  BASE_URL="$(bash scripts/localstack-url.sh)"
fi
export BASE_URL

echo "Targeting API at $BASE_URL"

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