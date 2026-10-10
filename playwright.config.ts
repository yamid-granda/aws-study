import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against SAM Local (`http://127.0.0.1:3000`).
 * The webServer block auto-builds + auto-starts the API if it is not
 * already running, so `npm run test:e2e` works with zero setup
 * (Docker must be running). To manage the API manually, start
 * `npm run local:start` in another terminal — the existing server
 * will be reused (`reuseExistingServer: true`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bash scripts/e2e-server.sh",
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: !process.env.CI,
    timeout: 240 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
