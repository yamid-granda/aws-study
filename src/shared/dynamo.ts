import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logger } from "./logger.js";

/**
 * Shared DynamoDB client factory — same code path for local + cloud.
 *
 * LocalStack: leave DYNAMODB_ENDPOINT unset — LocalStack injects
 * AWS_ENDPOINT_URL_DYNAMODB / AWS_ENDPOINT_URL into the Lambdas it runs,
 * which resolveEndpoint() honors. Setting DYNAMODB_ENDPOINT explicitly
 * also works.
 * Cloud: leave DYNAMODB_ENDPOINT unset → talks to real DynamoDB.
 */

let cachedDocClient: DynamoDBDocumentClient | null = null;

export function getTableName(): string {
  const table = process.env.TABLE_NAME;
  if (!table) {
    throw new Error("TABLE_NAME env var is required");
  }
  return table;
}

/**
 * Resolve the DynamoDB endpoint:
 * - DYNAMODB_ENDPOINT set → use it (explicit override).
 * - AWS_ENDPOINT_URL_DYNAMODB / AWS_ENDPOINT_URL set → use it (LocalStack
 *   injects these into the Lambdas it runs, and the AWS SDK v3 also honors
 *   them — checking explicitly keeps local + cloud behavior obvious).
 * - otherwise (real Lambda) → undefined = real DynamoDB.
 */
export function resolveEndpoint(): string | undefined {
  if (process.env.DYNAMODB_ENDPOINT) {
    return process.env.DYNAMODB_ENDPOINT;
  }
  if (process.env.AWS_ENDPOINT_URL_DYNAMODB) {
    return process.env.AWS_ENDPOINT_URL_DYNAMODB;
  }
  if (process.env.AWS_ENDPOINT_URL) {
    return process.env.AWS_ENDPOINT_URL;
  }
  return undefined;
}

export function getDocClient(): DynamoDBDocumentClient {
  if (cachedDocClient) {
    return cachedDocClient;
  }
  const endpoint = resolveEndpoint();
  if (endpoint) {
    logger.info("using custom DynamoDB endpoint", { endpoint });
  }
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint
      ? {
          endpoint,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
          },
        }
      : {}),
  });
  cachedDocClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return cachedDocClient;
}

/** Test-only: reset the cached client between unit tests. */
export function __resetDocClientForTests(): void {
  cachedDocClient = null;
}
