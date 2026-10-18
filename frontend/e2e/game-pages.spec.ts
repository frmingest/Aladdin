import { expect, test, type Page } from "@playwright/test";

/**
 * Read-only smoke test of the game-mode pages (hardening sprint, step 3/5).
 *
 * The default-mode smoke test (smoke.spec.ts) never opens the Fortress or its
 * rooms. This one turns game mode on in the browser (a view preference kept in
 * localStorage, see src/lib/gameMode.tsx), visits every game page at phone and
 * desktop width, and at 2560 and 3840 wide (resolution scaling). Pictures are on whenever game
 * mode is on (no separate art switch). It fails on
 * an uncaught page error, an API 5xx (503 "provider not configured" is
 * reported, not failed), a missing heading, a stuck "Loading…", or a page
 * that scrolls sideways. Like smoke.spec.ts it aborts every non-GET request.
 */

const API = (process.env.SMOKE_API_URL ?? "").replace(/\/$/, "");

const GAME_PAGES: { path: string; heading: string }[] = [
  { path: "/fortress", heading: "The Fortress" },
  { path: "/fortress/siege", heading: "The Siege Simulator" },
  { path: "/fortress/records", heading: "Hall of Records" },
  { path: "/fortress/circle", heading: "Circle of Competence" },
  { path: "/fortress/map", heading: "Cartographer's table" },
  { path: "/fortress/marketplace", heading: "The Marketplace" },
];

const VIEWPORTS = [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "1440p", width: 2560, height: 1440 },
  { name: "4K", width: 3840, height: 2160 },
];

test.beforeAll(() => {
  if (!API || !process.env.SMOKE_FRONTEND_URL) {
    throw new Error("Set SMOKE_FRONTEND_URL and SMOKE_API_URL (see playwright.config.ts).");
  }
});

async function guard(page: Page, gameModeOn = true) {
  const problems: string[] = [];
  if (gameModeOn) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("aladdin-game-mode", "on");
      } catch {
        /* storage blocked: game mode just stays off */
      }
    });
  }
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

async function checkPage(page: Page, path: string, heading: string) {
  const problems = await guard(page);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/^Loading…$/)).toHaveCount(0);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sideways, "page scrolls sideways").toBeLessThanOrEqual(1);
  expect(problems, problems.join("\n")).toEqual([]);
}

test.describe("game pages", () => {
  for (const vp of VIEWPORTS) {
    for (const { path, heading } of GAME_PAGES) {
      test(`${path} renders (${vp.name})`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await checkPage(page, path, heading);
      });
    }
  }

});

test("game mode survives a reload and switches off cleanly", async ({ page }) => {
  await guard(page, false);
  await page.goto("/fortress");
  await page.evaluate(() => localStorage.setItem("aladdin-game-mode", "on"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "study");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "study");
  await page.evaluate(() => localStorage.setItem("aladdin-game-mode", "off"));
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-skin", /.+/);
});
