#!/usr/bin/env bash
# Deploy the current app flow (template.yaml: Lambdas + Api + ProductsTable)
# to LocalStack — the local AWS emulator on :4566.
# Needs: Docker running, AWS CLI, SAM CLI. No real AWS credentials.
# Usage:
#   bash scripts/localstack-deploy.sh
#   STACK_NAME=custom LOCALSTACK_URL=http://localhost:4566 bash scripts/localstack-deploy.sh
set -euo pipefail

STACK_NAME="${STACK_NAME:-aws-study-localstack}"
REGION="${AWS_REGION:-us-east-1}"
BUCKET="${ARTIFACT_BUCKET:-aws-study-sam-artifacts}"
LOCALSTACK_URL="${LOCALSTACK_URL:-http://localhost:4566}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_REGION="$REGION"
# `aws cloudformation package` uploads via its own S3 client, which ignores
# `--endpoint-url` in AWS CLI v2 and would hit real AWS (failing with
# InvalidAccessKeyId under the dummy `test` key). The universal endpoint
# env var forces every client — CloudFormation, S3, ApiGateway — to LocalStack.
export AWS_ENDPOINT_URL="$LOCALSTACK_URL"

bash scripts/localstack-wait.sh

echo "Building with SAM ..."
npm run build

echo "Ensuring artifact bucket s3://$BUCKET in LocalStack ..."
aws --endpoint-url "$LOCALSTACK_URL" --region "$REGION" s3 mb "s3://$BUCKET" >/dev/null 2>&1 || true

echo "Packaging template for LocalStack ..."
aws --endpoint-url "$LOCALSTACK_URL" --region "$REGION" cloudformation package \
  --template-file .aws-sam/build/template.yaml \
  --s3-bucket "$BUCKET" \
  --output-template-file .aws-sam/build/packaged-localstack.yaml

echo "Deploying stack $STACK_NAME to LocalStack ..."
aws --endpoint-url "$LOCALSTACK_URL" --region "$REGION" cloudformation deploy \
  --template-file .aws-sam/build/packaged-localstack.yaml \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

# NOTE: we intentionally do NOT dump the raw `describe-stacks` table here:
# SAM's ApiUrl output uses a real-AWS hostname
# (https://<api-id>.execute-api.<region>.amazonaws.com/Prod/) which does not
# resolve locally and is not clickable. Show the LocalStack URLs instead.
BASE_URL="$(bash scripts/localstack-url.sh)"
echo
echo "Deployed stack $STACK_NAME to LocalStack."
echo "Local API endpoints (click to open):"
bash scripts/localstack-endpoints.sh "$BASE_URL"
echo "Try:"
echo "  curl $BASE_URL/health"
echo "  curl $BASE_URL/products"
