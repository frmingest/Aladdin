import { expect, test } from "@playwright/test";

/**
 * Failure-path test of the game-mode pages (hardening sprint, 2026-10-13).
 *
 * Unlike game-pages.spec.ts this needs no backend and sends nothing to one: it
 * answers every data request (fetch/XHR) itself with a failure, then checks that
 * each game page says what happened in words, never shows a raw HTML error page
 * or a stack trace, and offers "Try again", which must send the request again.
 * Only SMOKE_FRONTEND_URL is needed (a vite dev server or preview works):
 *
 *   SMOKE_FRONTEND_URL=http://localhost:5173 npx playwright test e2e/game-errors.spec.ts
 */

const PAGES: { path: string; heading: string }[] = [
  { path: "/fortress", heading: "The Fortress" },
  { path: "/fortress/siege", heading: "The Siege Simulator" },
  { path: "/fortress/chronicle", heading: "The Chronicle" },
  { path: "/fortress/council", heading: "Council Chamber" },
  { path: "/fortress/records", heading: "Hall of Records" },
  { path: "/fortress/circle", heading: "Circle of Competence" },
  { path: "/fortress/map", heading: "Cartographer's table" },
  { path: "/fortress/marketplace", heading: "The Marketplace" },
];

const GATEWAY_PAGE = "<html><head><title>502</title></head><body><h1>502 Bad Gateway</h1><p>nginx/1.25</p></body></html>";

type Failure = "gateway" | "unreachable";

async function failAllData(page: import("@playwright/test").Page, how: Failure) {
  let calls = 0;
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type !== "fetch" && type !== "xhr") return route.continue();
    calls += 1;
    if (how === "unreachable") return route.abort("failed");
    return route.fulfill({ status: 502, contentType: "text/html", body: GATEWAY_PAGE });
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("aladdin-game-mode", "on");
    } catch {
      /* storage blocked: game mode just stays off */
    }
  });
  return () => calls;
}

for (const failure of ["gateway", "unreachable"] as const) {
  for (const { path, heading } of PAGES) {
    test(`${path}: ${failure} failure is explained and can be retried`, async ({ page }) => {
      const calls = await failAllData(page, failure);
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      const alert = page.getByRole("alert").first();
      await expect(alert).toBeVisible();

      const text = (await alert.innerText()).trim();
      expect(text).not.toMatch(/<\/?(html|body|h1)|nginx|traceback/i);
      expect(text).toMatch(failure === "gateway" ? /server could not load|error 502/i : /could not reach the server/i);

      const before = calls();
      await page.getByRole("button", { name: "Try again" }).first().click();
      await expect.poll(calls).toBeGreaterThan(before);
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }
}
