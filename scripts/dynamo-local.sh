#!/usr/bin/env bash
# Create the local DynamoDB products table (mirrors template.yaml
# ProductsTable: PAY_PER_REQUEST, HASH key `id (S)`).
# Idempotent: skips creation if the table already exists (data is kept).
# Needs only Node + the repo's AWS SDK (no AWS CLI, no cloud credentials).
# Usage:
#   bash scripts/dynamo-local.sh
#   TABLE_NAME=custom-name DYNAMODB_URL=http://localhost:8000 bash scripts/dynamo-local.sh
set -euo pipefail

TABLE_NAME="${TABLE_NAME:-aws-study-local-products}"
export TABLE_NAME
export DYNAMODB_URL="${DYNAMODB_URL:-http://localhost:8000}"

echo "Waiting for DynamoDB Local at $DYNAMODB_URL ..."
for i in $(seq 1 30); do
  # DynamoDB Local answers 400 to an unsigned root request when ready.
  code="$(curl -s -o /dev/null -m 2 -w "%{http_code}" "$DYNAMODB_URL" || true)"
  if [[ "$code" == "400" ]]; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: DynamoDB Local did not come up at $DYNAMODB_URL." >&2
    echo "Start it first: npm run local:dynamo:up" >&2
    exit 1
  fi
  sleep 1
done

node scripts/dynamo-local-init.mjs
