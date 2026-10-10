#!/usr/bin/env bash
# Wait until LocalStack is ready to serve requests.
# Usage:
#   bash scripts/localstack-wait.sh
#   LOCALSTACK_URL=http://localhost:4566 bash scripts/localstack-wait.sh
set -euo pipefail

LOCALSTACK_URL="${LOCALSTACK_URL:-http://localhost:4566}"

echo "Waiting for LocalStack at $LOCALSTACK_URL ..."
for i in $(seq 1 60); do
  # /_localstack/health returns {"services": {...}} once the gateway is up.
  # It answers 200 (ready) or 503 (starting) — either means the process listens.
  code="$(curl -s -o /dev/null -m 2 -w "%{http_code}" "$LOCALSTACK_URL/_localstack/health" || true)"
  if [[ "$code" == "200" || "$code" == "503" ]]; then
    echo "LocalStack gateway is up (HTTP $code)."
    exit 0
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "ERROR: LocalStack did not come up at $LOCALSTACK_URL." >&2
    echo "Start it first: npm run local:stack:up" >&2
    exit 1
  fi
  sleep 2
done
