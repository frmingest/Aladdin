import { expect, test, type Page } from "@playwright/test";

/**
 * Read-only smoke test of a deployed Aladdin (Sprint 7, F4).
 *
 * Guarantees it can't change or spend anything:
 * - every non-GET request from the pages is aborted;
 * - /research/* is answered locally, because a stale GET there would
 *   start a Gemini call and spend quota;
 * - the API checks are GETs against endpoints that only read the database.
 *
 * It fails on: the API being down, the database unreachable, a migration
 * not applied, a page crashing (uncaught error), or an API 5xx on a page
 * (503 "provider not configured" is reported, not failed). Configuration
 * gaps from System status are attached to the report as warnings.
 */

const API = (process.env.SMOKE_API_URL ?? "").replace(/\/$/, "");

test.beforeAll(() => {
  if (!API || !process.env.SMOKE_FRONTEND_URL) {
    throw new Error("Set SMOKE_FRONTEND_URL and SMOKE_API_URL (see playwright.config.ts).");
  }
});

test.describe("API", () => {
  test("health", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  test("system status: database up and migrations applied", async ({ request }) => {
    const res = await request.get(`${API}/system/status`);
    expect(res.status()).toBe(200);
    const status = await res.json();
    expect(status.database_ok, "database reachable").toBe(true);
    expect(status.migration_current, "database migration matches the deployed code").toBe(status.migration_head);
    for (const issue of status.issues as string[]) {
      test.info().annotations.push({ type: "warning", description: issue });
    }
    test.info().annotations.push({
      type: "deployed",
      description: `version ${status.version}, commit ${status.commit ?? "unknown"}, migration ${status.migration_current}`,
    });
  });

  for (const path of ["/portfolio/overview", "/holdings", "/macro/indicators", "/analysis/queue", "/journal"]) {
    test(`GET ${path}`, async ({ request }) => {
      const res = await request.get(`${API}${path}`);
      expect(res.status(), await res.text()).toBe(200);
    });
  }

  test("macro data has been captured", async ({ request }) => {
    const body = await (await request.get(`${API}/macro/indicators`)).json();
    const have = (body.indicators as { value: string | null }[]).filter((i) => i.value !== null).length;
    if (have === 0) {
      test.info().annotations.push({ type: "warning", description: "No macro series captured yet" });
    }
    expect(body.indicators.length).toBeGreaterThan(0);
  });
});

async function guard(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (err) => problems.push(`uncaught: ${err.message}`));
  await page.route("**/*", (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.abort();
    if (/\/research\//.test(new URL(req.url()).pathname)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: false, as_of: null, items: [], reason: "skipped by smoke test", sector: "", holding_id: "", ticker: "" }),
      });
    }
    return route.continue();
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 500 && res.status() !== 503 && (url.startsWith(API) || url.includes("/api/"))) {
      problems.push(`${res.status()} ${url}`);
    }
    if (res.status() === 503) {
      test.info().annotations.push({ type: "warning", description: `503 (provider not configured) ${url}` });
    }
  });
  return problems;
}

const PAGES: { path: string; heading: string }[] = [
  { path: "/", heading: "Dashboard" },
  { path: "/holdings", heading: "Holdings" },
  { path: "/portfolio", heading: "Portfolio" },
  { path: "/macro", heading: "Macro" },
  { path: "/watchlist", heading: "Watchlist" },
  { path: "/journal", heading: "Decision journal" },
  { path: "/analysis-queue", heading: "Analysis queue" },
  { path: "/status", heading: "System status" },
];

test.describe("pages", () => {
  for (const { path, heading } of PAGES) {
    test(`${path} renders`, async ({ page }) => {
      const problems = await guard(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/^Loading…$/)).toHaveCount(0);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});
