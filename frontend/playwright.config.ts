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
// The 3D check is its own project so a slow software-WebGL page cannot eat the budget of the fast checks, and the
// workflow can give each its own step timeout (a hang then fails one named step instead of cancelling the whole job).
const SMOKE_FAST_FILES = ["smoke.spec.ts", "game-pages.spec.ts", "game-errors.spec.ts"];
const SMOKE_3D_FILES = ["game3d.spec.ts"];
// A bare file name in testMatch also matches the same name in a sub-folder. Until 2026-11-13 the "smoke" project
// therefore picked up e2e/regression/game3d.spec.ts too (14 extra 3D page loads against the live site, written for the
// demo stack with a 90 s timeout), which pushed the daily run past its 15-minute limit. Keep the regression folder out.
const SMOKE_IGNORE = ["**/regression/**"];

const chromiumPath = process.env.SMOKE_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  // "github" writes each failure as an annotation on the run, which the REST API can read; log and artifact
  // downloads are blocked from cloud sessions, so without it a red smoke run could not be diagnosed there.
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions,
  },
  projects: [
    {
      name: "smoke",
      testMatch: SMOKE_FAST_FILES,
      testIgnore: SMOKE_IGNORE,
      use: { baseURL: process.env.SMOKE_FRONTEND_URL },
    },
    {
      // Same live-site, read-only rules as "smoke". Software WebGL on a CI runner is slow, so: longer test timeout,
      // no retry (a retry only doubles the wait), one at a time.
      name: "smoke-3d",
      testMatch: SMOKE_3D_FILES,
      testIgnore: SMOKE_IGNORE,
      timeout: 90_000,
      retries: 0,
      fullyParallel: false,
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
