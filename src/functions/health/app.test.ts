import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { healthHandler } from "./app.js";

function makeEvent(): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/health",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "/health",
    body: null,
    isBase64Encoded: false,
  };
}

describe("healthHandler", () => {
  it("returns 200 with status ok", async () => {
    const res = await healthHandler(makeEvent(), {} as Context);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: "ok" });
  });

  it("returns JSON content type", async () => {
    const res = await healthHandler(makeEvent(), {} as Context);
    expect(res.headers?.["Content-Type"]).toBe("application/json");
  });
});
