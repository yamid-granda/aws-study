#!/usr/bin/env bash
# Playwright E2E entrypoint against LocalStack.
# Boots the emulator + deploys the stack when needed (scripts/localstack-boot.sh),
# then runs Playwright with BASE_URL pointing at the deployed API.
#
# The LocalStack API URL is only known *after* a deploy, which is why this is a
# wrapper instead of a Playwright `webServer` block: config load happens before
# any boot, so the URL cannot be resolved there.
#
# Usage:
#   bash scripts/e2e-stack.sh                 # npm run test:e2e
#   bash scripts/e2e-stack.sh --headed        # extra args go to playwright
#   BASE_URL=https://... bash scripts/e2e-stack.sh   # target a deployed API instead
#
# Env:
#   BASE_URL   (optional) target this API instead of booting LocalStack
#   LOCALSTACK_URL (default http://localhost:4566; forwarded to localstack-*.sh)
set -euo pipefail

if [[ -z "${BASE_URL:-}" ]]; then
  bash scripts/localstack-boot.sh
  BASE_URL="$(bash scripts/localstack-url.sh)"
fi
export BASE_URL

echo
echo "Running Playwright against $BASE_URL ..."
exec npx playwright test "$@"