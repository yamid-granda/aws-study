#!/usr/bin/env bash
# Print clickable LocalStack API endpoint URLs (mirrors template.yaml routes).
# Single source of truth for the endpoint list shown by localstack-deploy.sh
# and localstack-dev.sh.
# Usage:
#   bash scripts/localstack-endpoints.sh <base-url>
#   BASE_URL=<url> bash scripts/localstack-endpoints.sh
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-}}"
if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: no base URL. Usage: bash scripts/localstack-endpoints.sh <base-url>" >&2
  exit 1
fi

echo "  [GET]    ${BASE_URL}/health"
echo "  [GET]    ${BASE_URL}/hello"
echo "  [GET]    ${BASE_URL}/hello?name=dev"
echo "  [GET]    ${BASE_URL}/products"
echo "  [POST]   ${BASE_URL}/products"
echo "  [GET]    ${BASE_URL}/products/{id}"
echo "  [PUT]    ${BASE_URL}/products/{id}"
echo "  [DELETE] ${BASE_URL}/products/{id}"
