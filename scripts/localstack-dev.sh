#!/usr/bin/env bash
# One-command LocalStack dev: start emulator -> deploy template.
# The deploy step prints the clickable endpoint URLs (single copy).
# Usage:
#   npm run dev:stack
#   STACK_NAME=custom STAGE=Prod LOCALSTACK_URL=http://localhost:4566 bash scripts/localstack-dev.sh
# Keeps the console attached (follows logs); Ctrl+C stops LocalStack.
set -euo pipefail

cleanup() {
  echo ""
  echo "Stopping LocalStack ..."
  docker-compose stop localstack
  exit 0
}
trap cleanup INT TERM

echo "Checking for existing LocalStack instance ..."
CONTAINER_NAME="aws-study-localstack"
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo "missing")" = "true" ]; then
  echo "LocalStack already running ($CONTAINER_NAME) — reusing it, skipping start."
elif docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "LocalStack container exists but is stopped — starting it ..."
  docker start "$CONTAINER_NAME" >/dev/null
else
  echo "Starting LocalStack emulator ..."
  # `docker-compose up` fails with a name conflict when the shared
  # `aws-study-localstack` container was created by another checkout but is
  # still running the same image — reuse it instead of failing (fast path).
  if ! docker-compose up -d localstack; then
    echo "Compose up failed, reusing existing aws-study-localstack container ..."
    docker start aws-study-localstack >/dev/null 2>&1 || true
  fi
fi

bash scripts/localstack-wait.sh

bash scripts/localstack-deploy.sh

echo
echo "================================================================"
echo "dev:stack done — API ready (URLs above)."
echo "Following logs — press Ctrl+C to stop LocalStack."
echo "================================================================"
docker-compose logs -f localstack
