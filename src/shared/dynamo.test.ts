import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetDocClientForTests, getTableName, resolveEndpoint } from "./dynamo.js";

afterEach(() => {
  vi.unstubAllEnvs();
  __resetDocClientForTests();
});

describe("resolveEndpoint", () => {
  it("prefers DYNAMODB_ENDPOINT when set", () => {
    vi.stubEnv("DYNAMODB_ENDPOINT", "http://custom:8000");
    vi.stubEnv("AWS_SAM_LOCAL", "true");
    expect(resolveEndpoint()).toBe("http://custom:8000");
  });

  it("falls back to the host's DynamoDB Local under sam local", () => {
    vi.stubEnv("AWS_SAM_LOCAL", "true");
    expect(resolveEndpoint()).toBe("http://host.docker.internal:8000");
  });

  it("honors AWS_ENDPOINT_URL_DYNAMODB (LocalStack Lambda injection)", () => {
    vi.stubEnv("AWS_ENDPOINT_URL_DYNAMODB", "http://localstack:4566");
    expect(resolveEndpoint()).toBe("http://localstack:4566");
  });

  it("honors AWS_ENDPOINT_URL when the service-specific var is absent", () => {
    vi.stubEnv("AWS_ENDPOINT_URL", "http://localstack:4566");
    expect(resolveEndpoint()).toBe("http://localstack:4566");
  });

  it("still prefers DYNAMODB_ENDPOINT over LocalStack vars", () => {
    vi.stubEnv("DYNAMODB_ENDPOINT", "http://custom:8000");
    vi.stubEnv("AWS_ENDPOINT_URL_DYNAMODB", "http://localstack:4566");
    vi.stubEnv("AWS_ENDPOINT_URL", "http://localstack:4566");
    expect(resolveEndpoint()).toBe("http://custom:8000");
  });

  it("returns undefined in real AWS (real DynamoDB)", () => {
    expect(resolveEndpoint()).toBeUndefined();
  });
});

describe("getTableName", () => {
  it("returns TABLE_NAME", () => {
    vi.stubEnv("TABLE_NAME", "my-table");
    expect(getTableName()).toBe("my-table");
  });

  it("throws when TABLE_NAME is missing", () => {
    expect(() => getTableName()).toThrow("TABLE_NAME");
  });
});
