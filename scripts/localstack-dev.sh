#!/usr/bin/env bash
# One-command LocalStack dev: start emulator -> deploy template.
# The deploy step prints the clickable endpoint URLs (single copy).
# Usage:
#   npm run local:stack:dev
#   STACK_NAME=custom STAGE=Prod LOCALSTACK_URL=http://localhost:4566 bash scripts/localstack-dev.sh
set -euo pipefail

echo "Starting LocalStack emulator ..."
# `docker-compose up` fails with a name conflict when the shared
# `aws-study-localstack` container was created by another checkout but is
# still running the same image — reuse it instead of failing (fast path).
if ! docker-compose up -d localstack; then
  echo "Compose up failed, reusing existing aws-study-localstack container ..."
  docker start aws-study-localstack >/dev/null 2>&1 || true
fi

bash scripts/localstack-wait.sh

bash scripts/localstack-deploy.sh

echo
echo "================================================================"
echo "local:stack:dev done — API ready (URLs above)."
echo "================================================================"
