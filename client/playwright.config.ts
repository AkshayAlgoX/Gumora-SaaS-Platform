import { defineConfig, devices } from "@playwright/test";

/**
 * Two kinds of browser test, kept apart:
 *
 * - "mocked" (default, `npm run test:e2e`): runs against a local production
 *   build whose API base URL points at an address where nothing listens.
 *   Every API response comes from e2e/support/api-mock.ts, so results do not
 *   depend on any deployed backend, database or payment provider.
 * - "smoke" (`npm run test:e2e:smoke`): read-only availability checks against
 *   real deployments named by SMOKE_WEB_URL / SMOKE_API_URL. Never run by
 *   default and never part of PR CI.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const E2E_API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:59999";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "mocked",
      testDir: "./e2e/mocked",
      fullyParallel: true,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: "smoke",
      testDir: "./e2e/smoke",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Only the mocked project needs the local app. A production build is used so
  // the tests exercise what is deployed, not the dev server.
  webServer: process.argv.includes("--project=smoke")
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: false,
        timeout: 300_000,
        env: { NEXT_PUBLIC_API_URL: E2E_API_URL },
      },
});
