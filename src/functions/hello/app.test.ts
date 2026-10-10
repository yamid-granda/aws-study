import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { buildGreeting, helloHandler } from "./app.js";

function makeEvent(query: Record<string, string> | null): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/hello",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: query,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "/hello",
    body: null,
    isBase64Encoded: false,
  };
}

describe("buildGreeting (pure logic)", () => {
  it("greets the world by default", () => {
    expect(buildGreeting({})).toBe("Hello, world!");
  });

  it("greets a name", () => {
    expect(buildGreeting({ name: "Ada" })).toBe("Hello, Ada!");
  });
});

describe("helloHandler", () => {
  it("returns 200 with greeting when no name given", async () => {
    const res = await helloHandler(makeEvent(null), {} as Context);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe("Hello, world!");
  });

  it("uses the name query param", async () => {
    const res = await helloHandler(makeEvent({ name: "Ada" }), {} as Context);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe("Hello, Ada!");
  });

  it("returns 400 when name is too long", async () => {
    const res = await helloHandler(makeEvent({ name: "x".repeat(51) }), {} as Context);
    expect(res.statusCode).toBe(400);
  });
});
