import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against LocalStack, booted by `npm run test:e2e`
 * (`scripts/e2e-stack.sh`): it starts the emulator, deploys the stack and
 * exports BASE_URL with the deployed API URL before Playwright starts.
 *
 * There is no `webServer` block on purpose — the LocalStack API URL contains
 * the REST API id, which only exists after a deploy, so it cannot be resolved
 * while this config is being loaded. Specs turn paths into absolute URLs via
 * `tests/e2e/api-url.ts` for the same reason (see the note there).
 */
if (!process.env.BASE_URL) {
  throw new Error(
    "BASE_URL is not set — run `npm run test:e2e` (boots LocalStack and sets it) " +
      "or export BASE_URL=$(npm run -s stack:url).",
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
