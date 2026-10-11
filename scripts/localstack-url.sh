#!/usr/bin/env bash
# Print the base URL of the API Gateway deployed to LocalStack.
# SAM's ApiUrl output uses a real-AWS hostname, which does not resolve
# locally — instead discover the RestApiId via apigateway and build the
# LocalStack path-style URL:
#   http://localhost:4566/restapis/<apiId>/Prod/_user_request_
# Usage:
#   bash scripts/localstack-url.sh
#   LOCALSTACK_URL=... STACK_NAME=... STAGE=... bash scripts/localstack-url.sh
set -euo pipefail

LOCALSTACK_URL="${LOCALSTACK_URL:-http://localhost:4566}"
STACK_NAME="${STACK_NAME:-aws-study-localstack}"
REGION="${AWS_REGION:-us-east-1}"
STAGE="${STAGE:-Prod}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_ENDPOINT_URL="$LOCALSTACK_URL"

# Prefer the RestApi created by the CloudFormation stack (filters out
# LocalStack internal APIs). Fall back to the first available API.
API_ID="$(aws --endpoint-url "$LOCALSTACK_URL" --region "$REGION" \
  apigateway get-rest-apis --query "items[?name=='${STACK_NAME}'].id | [0]" \
  --output text 2>/dev/null || true)"
if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  API_ID="$(aws --endpoint-url "$LOCALSTACK_URL" --region "$REGION" \
    apigateway get-rest-apis --query "items[0].id" \
    --output text 2>/dev/null || true)"
fi
if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  echo "ERROR: no REST API found in LocalStack. Deploy first: npm run stack:deploy" >&2
  exit 1
fi

echo "${LOCALSTACK_URL}/restapis/${API_ID}/${STAGE}/_user_request_"
