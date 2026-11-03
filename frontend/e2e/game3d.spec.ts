import { expect, test } from "@playwright/test";

/**
 * Read-only browser check of the places in /game3d (S22). It opens each place by its link, and checks the title,
 * the Back button, that B walks back out, and that nothing logs a page error. It aborts every non-GET request, like
 * the other smoke tests, so it never writes and never spends LLM quota. Needs SMOKE_FRONTEND_URL (see playwright.config.ts).
 *
 * Software-only graphics can be very slow, so this checks the page chrome (title, buttons, address), not frame rates.
 */
const PLACES: { at: string; title: RegExp; back: string; after: string }[] = [
  { at: "town", title: /The Town/, back: "← Back to the courtyard", after: "" },
  { at: "townhall", title: /Town Hall/, back: "← Back to the Town", after: "?at=town" },
  { at: "records", title: /Hall of Records/, back: "← Back to the Town", after: "?at=town" },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));
});

for (const p of PLACES) {
  test(`opens ${p.at} from its link and goes back with B`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/game3d?at=${p.at}`);
    await expect(page).toHaveTitle(p.title);
    await expect(page.getByRole("button", { name: p.back })).toBeVisible();
    await page.keyboard.press("b");
    await expect(page).toHaveURL((u) => u.search === p.after);
    expect(errors).toEqual([]);
  });
}

test("a broken place link opens the courtyard", async ({ page }) => {
  await page.goto("/game3d?at=nowhere");
  await expect(page).toHaveTitle(/3D courtyard/);
  await expect(page.getByRole("button", { name: /^← Back/ })).toHaveCount(0);
});
