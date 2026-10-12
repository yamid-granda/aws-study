import { expect, test } from "@playwright/test";
import { apiUrl } from "./api-url.js";

test.describe("GET /hello (E2E, LocalStack)", () => {
  test("greets the world by default", async ({ request }) => {
    const res = await request.get(apiUrl("/hello"));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Hello, world!");
  });

  test("greets the name query param", async ({ request }) => {
    const res = await request.get(apiUrl("/hello?name=Ada"));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Hello, Ada!");
  });

  test("rejects an overlong name with 400", async ({ request }) => {
    const res = await request.get(apiUrl(`/hello?name=${"x".repeat(51)}`));
    expect(res.status()).toBe(400);
  });
});
