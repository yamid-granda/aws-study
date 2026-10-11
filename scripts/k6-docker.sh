#!/usr/bin/env bash
# Run k6 via Docker so no global k6 install is needed.
# Usage: bash scripts/k6-docker.sh tests/performance/products/create-products-load-test.ts [extra k6 args...]
# Env: BASE_URL (default http://127.0.0.1:3000 on the host)
#      K6_IMAGE (default grafana/k6:2.3.0)
set -euo pipefail

TEST_FILE="${1:?Usage: bash scripts/k6-docker.sh <test-file> [k6 args...]}"
shift || true

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:2.3.0}"

# Inside the container localhost/127.0.0.1 is the container itself,
# so rewrite host loopback to host.docker.internal (works on Docker
# Desktop Mac/Windows and on Linux with --add-host below).
K6_BASE_URL="${BASE_URL//127.0.0.1/host.docker.internal}"
K6_BASE_URL="${K6_BASE_URL//localhost/host.docker.internal}"

# Mount the performance dir and preserve subdirectories
# (e.g. tests/performance/products/create-load-test.ts).
case "$TEST_FILE" in
  tests/performance/*) REL_PATH="${TEST_FILE#tests/performance/}" ;;
  *)
    echo "ERROR: test must live under tests/performance/ (got: $TEST_FILE)" >&2
    exit 1
    ;;
esac
exec docker run --rm -i \
  --add-host=host.docker.internal:host-gateway \
  -v "$PWD/tests/performance:/scripts" \
  -e "BASE_URL=$K6_BASE_URL" \
  "$K6_IMAGE" run "/scripts/$REL_PATH" "$@"
