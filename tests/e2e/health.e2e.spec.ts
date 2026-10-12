import { expect, test } from "@playwright/test";
import { apiUrl } from "./api-url.js";

test.describe("GET /health (E2E, LocalStack)", () => {
  test("returns 200 with status ok", async ({ request }) => {
    const res = await request.get(apiUrl("/health"));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
