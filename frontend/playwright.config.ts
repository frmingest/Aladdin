import { defineConfig, devices } from "@playwright/test";

/**
 * Post-deploy smoke test (Sprint 7, F4). Runs against the deployed Railway
 * site, read-only:
 *
 *   SMOKE_FRONTEND_URL=https://<frontend>.up.railway.app \
 *   SMOKE_API_URL=https://<backend>.up.railway.app \
 *   npm run smoke
 *
 * Also runs from GitHub Actions (.github/workflows/smoke.yml) after a
 * Railway deployment and on demand. First run on a machine:
 * `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.SMOKE_FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.SMOKE_CHROMIUM_PATH ? { executablePath: process.env.SMOKE_CHROMIUM_PATH } : {},
  },
});
