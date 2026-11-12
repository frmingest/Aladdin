import { defineConfig, devices } from "@playwright/test";

/**
 * Two Playwright projects (test framework, 2026-11-12). See docs/ops/test-strategy-2026-11-12.md.
 *
 * smoke       Post-deploy check against the deployed Railway site. Read-only: it must never write or spend LLM quota
 *             (CLAUDE.md, "Guardrail tooling"). Runs from smoke.yml daily and after each deploy:
 *
 *               SMOKE_FRONTEND_URL=https://<frontend>.up.railway.app \
 *               SMOKE_API_URL=https://<backend>.up.railway.app \
 *               npm run smoke
 *
 *             Optional: SMOKE_API_KEY, once APP_AUTH_TOKEN is set in Railway (see backend/app/security.py).
 *
 * regression  Pre-merge check against a throw-away stack (Postgres + backend + Vite dev server) that runs in CI on every
 *             pull request (ci.yml, job "E2E"). The stack is switched to demo mode first, so every page shows the same
 *             fabricated data and every write is refused (403). Locally, start the stack as described in
 *             docs/ops/test-strategy-2026-11-12.md, then:
 *
 *               npm run e2e
 *
 *             E2E_FRONTEND_URL (default http://127.0.0.1:5173) and E2E_API_URL (default http://127.0.0.1:8000).
 *
 * First run on a machine: `npx playwright install chromium`.
 */
const SMOKE_FILES = ["smoke.spec.ts", "game-pages.spec.ts", "game-errors.spec.ts", "game3d.spec.ts"];

const chromiumPath = process.env.SMOKE_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions,
  },
  projects: [
    {
      name: "smoke",
      testMatch: SMOKE_FILES,
      use: { baseURL: process.env.SMOKE_FRONTEND_URL },
    },
    {
      // Waits for the stack and turns demo mode on. The regression project depends on it, so one failed
      // health check stops the run with a clear message instead of forty confusing page failures.
      name: "stack",
      testMatch: "regression/stack.setup.ts",
      use: { baseURL: process.env.E2E_FRONTEND_URL ?? "http://127.0.0.1:5173" },
    },
    {
      name: "regression",
      testMatch: "regression/**/*.spec.ts",
      dependencies: ["stack"],
      // Software WebGL in CI is slow: give the 3D pages room. Frame rate is never asserted.
      timeout: 90_000,
      use: { baseURL: process.env.E2E_FRONTEND_URL ?? "http://127.0.0.1:5173" },
    },
  ],
});
