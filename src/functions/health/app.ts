import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { logger } from "../../shared/logger.js";
import { ok } from "../../shared/response.js";

/**
 * GET /health — liveness probe. No business logic, no dependencies.
 * Replace/extend the payload with version, dependency checks, etc.
 */
export async function healthHandler(
  _event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  logger.info("health check");
  return ok({
    status: "ok",
    service: process.env.POWERTOOLS_SERVICE_NAME ?? "aws-study",
    timestamp: new Date().toISOString(),
  });
}

export const handler = middy(healthHandler);
