import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logger } from "./logger.js";

/**
 * Shared DynamoDB client factory — same code path for local + cloud.
 *
 * Local: set DYNAMODB_ENDPOINT (e.g. http://host.docker.internal:8000 from
 * inside `sam local` containers, http://localhost:8000 from the host).
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
 * - DYNAMODB_ENDPOINT set → use it (local dev via env.json).
 * - otherwise, running under `sam local` (AWS_SAM_LOCAL=true) → the
 *   DynamoDB Local companion on the host. SAM only guarantees *some*
 *   env.json keys reach the container (observed: custom keys like
 *   TABLE_NAME arrive, AWS_* keys are overridden with host credentials,
 *   and keys can occasionally go missing), so this fallback keeps local
 *   development working regardless.
 * - otherwise (real Lambda) → undefined = real DynamoDB.
 */
export function resolveEndpoint(): string | undefined {
  if (process.env.DYNAMODB_ENDPOINT) {
    return process.env.DYNAMODB_ENDPOINT;
  }
  if (process.env.AWS_SAM_LOCAL) {
    return "http://host.docker.internal:8000";
  }
  return undefined;
}

export function getDocClient(): DynamoDBDocumentClient {
  if (cachedDocClient) {
    return cachedDocClient;
  }
  const endpoint = resolveEndpoint();
  if (endpoint) {
    logger.info("using DynamoDB Local", { endpoint });
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
