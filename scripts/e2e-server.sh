#!/usr/bin/env bash
# E2E server entrypoint for Playwright webServer: ensures DynamoDB Local is
# up + the products table exists, then starts the SAM local API.
# Usage: bash scripts/e2e-server.sh   (Playwright calls this via playwright.config.ts)
set -euo pipefail

docker-compose up -d dynamodb-local >/dev/null
bash scripts/dynamo-local.sh >/dev/null
exec npm run local:start
