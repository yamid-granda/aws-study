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
