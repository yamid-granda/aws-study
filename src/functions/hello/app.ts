import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { z } from "zod";
import { logger } from "../../shared/logger.js";
import { badRequest, ok } from "../../shared/response.js";

const querySchema = z.object({
  name: z.string().min(1).max(50).optional(),
});

export type HelloQuery = z.infer<typeof querySchema>;

/** Pure business-logic placeholder — keep handlers thin, put logic here for easy unit testing. */
export function buildGreeting(query: HelloQuery): string {
  const name = query.name?.trim() || "world";
  return `Hello, ${name}!`;
}

/**
 * GET /hello?name=foo — example endpoint showing query validation with Zod.
 * Copy this folder to scaffold a new Lambda: duplicate, rename, add to template.yaml.
 */
export async function helloHandler(
  event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const parsed = querySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) {
    logger.warn("invalid query", { issues: parsed.error.issues });
    return badRequest("Invalid query parameters");
  }
  const message = buildGreeting(parsed.data);
  logger.info("hello request", { message });
  return ok({ message, timestamp: new Date().toISOString() });
}

export const handler = middy(helloHandler);
