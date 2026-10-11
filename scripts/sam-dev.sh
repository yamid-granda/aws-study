#!/usr/bin/env bash
# One-command SAM Local dev: DynamoDB Local up -> init table -> SAM API.
# The table init is idempotent (data is kept); the API runs in the
# foreground at http://127.0.0.1:3000 — Ctrl+C stops the API, DynamoDB
# Local keeps running with your data (persistent named volume).
# Usage:
#   npm run dev
set -euo pipefail

echo "Checking for existing DynamoDB Local instance ..."
CONTAINER_NAME="aws-study-dynamodb-local"
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo "missing")" = "true" ]; then
  echo "DynamoDB Local already running ($CONTAINER_NAME) — reusing it, skipping start."
elif docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "DynamoDB Local container exists but is stopped — starting it ..."
  docker start "$CONTAINER_NAME" >/dev/null
else
  echo "Starting DynamoDB Local ..."
  docker-compose up -d dynamodb-local
fi

bash scripts/dynamo-local.sh

echo
echo "================================================================"
echo "dev done — table ready, starting SAM Local API ..."
echo "API at http://127.0.0.1:3000 (Ctrl+C stops the API;"
echo "DynamoDB Local keeps running with your data)."
echo "================================================================"
exec npm run local:start
