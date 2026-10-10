import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocClient } from "../../shared/dynamo.js";
import { productsHandler } from "./app.js";
import { buildProduct } from "./validation.js";

vi.mock("../../shared/dynamo.js", () => ({
  getTableName: () => "test-products",
  getDocClient: vi.fn(),
}));

function makeEvent(
  method: string,
  resource: string,
  opts: {
    pathParams?: Record<string, string> | null;
    query?: Record<string, string> | null;
    body?: unknown;
  } = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path: resource,
    resource,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: opts.query ?? null,
    multiValueQueryStringParameters: null,
    pathParameters: opts.pathParams ?? null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    body: opts.body === undefined ? null : JSON.stringify(opts.body),
    isBase64Encoded: false,
  };
}

function mockDocClient(
  impl: (command: { constructor: { name: string } } & Record<string, unknown>) => unknown,
) {
  const send = vi.fn(async (command: { constructor: { name: string } }) =>
    impl(command as { constructor: { name: string } } & Record<string, unknown>),
  );
  vi.mocked(getDocClient).mockReturnValue({ send } as never);
  return send;
}

const sampleInput = { name: "Keyboard", price: 79.9, stock: 10 };

describe("buildProduct (pure logic)", () => {
  it("assigns an id and timestamps", () => {
    const p = buildProduct(sampleInput);
    expect(p.id).toBeTypeOf("string");
    expect(p.name).toBe("Keyboard");
    expect(p.createdAt).toBe(p.updatedAt);
  });
});

describe("productsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a product (201)", async () => {
    mockDocClient(() => ({}));
    const res = await productsHandler(
      makeEvent("POST", "/products", { body: sampleInput }),
      {} as Context,
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.product.name).toBe("Keyboard");
    expect(body.product.id).toBeTypeOf("string");
  });

  it("rejects an invalid create body (400)", async () => {
    const send = mockDocClient(() => ({}));
    const res = await productsHandler(
      makeEvent("POST", "/products", { body: { name: "", price: -5, stock: -1 } }),
      {} as Context,
    );
    expect(res.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("lists products (200)", async () => {
    const product = buildProduct(sampleInput);
    mockDocClient(() => ({ Items: [product] }));
    const res = await productsHandler(makeEvent("GET", "/products"), {} as Context);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).products).toHaveLength(1);
  });

  it("gets one product (200) and 404s when missing", async () => {
    const product = buildProduct(sampleInput);
    mockDocClient(() => ({ Item: product }));
    const hit = await productsHandler(
      makeEvent("GET", "/products/{id}", { pathParams: { id: product.id } }),
      {} as Context,
    );
    expect(hit.statusCode).toBe(200);

    mockDocClient(() => ({}));
    const miss = await productsHandler(
      makeEvent("GET", "/products/{id}", { pathParams: { id: "nope" } }),
      {} as Context,
    );
    expect(miss.statusCode).toBe(404);
  });

  it("updates a product (200) and 404s when missing", async () => {
    const product = { ...buildProduct(sampleInput), price: 99.9 };
    mockDocClient(() => ({ Attributes: product }));
    const res = await productsHandler(
      makeEvent("PUT", "/products/{id}", {
        pathParams: { id: product.id },
        body: { price: 99.9 },
      }),
      {} as Context,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).product.price).toBe(99.9);

    const err = Object.assign(new Error("missing"), {
      name: "ConditionalCheckFailedException",
    });
    mockDocClient(() => {
      throw err;
    });
    const miss = await productsHandler(
      makeEvent("PUT", "/products/{id}", {
        pathParams: { id: "nope" },
        body: { price: 1 },
      }),
      {} as Context,
    );
    expect(miss.statusCode).toBe(404);
  });

  it("rejects an empty update body (400)", async () => {
    const send = mockDocClient(() => ({}));
    const res = await productsHandler(
      makeEvent("PUT", "/products/{id}", { pathParams: { id: "abc" }, body: {} }),
      {} as Context,
    );
    expect(res.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("deletes a product (200) and 404s when missing", async () => {
    mockDocClient(() => ({}));
    const res = await productsHandler(
      makeEvent("DELETE", "/products/{id}", { pathParams: { id: "abc" } }),
      {} as Context,
    );
    expect(res.statusCode).toBe(200);

    const err = Object.assign(new Error("missing"), {
      name: "ConditionalCheckFailedException",
    });
    mockDocClient(() => {
      throw err;
    });
    const miss = await productsHandler(
      makeEvent("DELETE", "/products/{id}", { pathParams: { id: "nope" } }),
      {} as Context,
    );
    expect(miss.statusCode).toBe(404);
  });
});
