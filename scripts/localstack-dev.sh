#!/usr/bin/env bash
# One-command LocalStack dev: start emulator -> deploy template -> follow logs.
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

bash scripts/localstack-boot.sh

echo
echo "================================================================"
echo "dev:stack done — API ready (URLs above)."
echo "Following logs — press Ctrl+C to stop LocalStack."
echo "================================================================"
docker-compose logs -f localstack