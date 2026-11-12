import { expect, test, type Page } from "@playwright/test";
import { watch } from "../support/guard";

/**
 * 3D courtyard (/game3d), pre-merge regression on the demo stack.
 *
 * What this can and cannot judge: CI has no GPU, so Chromium draws with software WebGL. These tests check that the world
 * loads, that the panels, places and links work and that nothing throws. They do NOT judge frame rate, how it looks or how
 * it feels. Those stay a person's look (docs/ops/test-strategy-2026-11-12.md, "What automation does not cover").
 */

/** Every place that can be opened by its link, with the tab title it must set. All of them walk back to the courtyard. */
const PLACES: { at: string; title: RegExp }[] = [
  { at: "townhall", title: /Town Hall/ },
  { at: "records", title: /Hall of Records/ },
  { at: "weather", title: /Weather Tower/ },
  { at: "siege", title: /Siege/ },
  { at: "quarter", title: /Market Quarter/ },
];

/** The side panels, the key that toggles each, and the name the panel carries. */
const PANELS: { key: string; name: string }[] = [
  { key: "q", name: "Quest log" },
  { key: "t", name: "Your towers in words" },
  { key: "g", name: "Where to?" },
];

async function openCourtyard(page: Page) {
  await page.goto("/game3d");
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
  await expect(page).toHaveTitle(/3D courtyard/);
}

test.describe("courtyard", () => {
  test("loads with the world, the demo banner and the three HUD buttons", async ({ page }) => {
    const problems = watch(page);
    await openCourtyard(page);
    await expect(page.getByText(/DEMO MODE/)).toBeVisible();
    for (const name of [/Quests/, /Towers/, /Where to\?/]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await problems.assertNone();
  });

  for (const { key, name } of PANELS) {
    test(`key ${key.toUpperCase()} opens "${name}" and its close button closes it`, async ({ page }) => {
      const problems = watch(page);
      await openCourtyard(page);
      const panel = page.getByRole("complementary", { name });
      await expect(panel).toHaveCount(0);
      await page.keyboard.press(key);
      await expect(panel).toBeVisible();
      await panel.getByRole("button", { name: /close/i }).click();
      await expect(panel).toHaveCount(0);
      await problems.assertNone();
    });
  }

  test("Plain view leaves for the flat Fortress and game mode stays on", async ({ page }) => {
    const problems = watch(page);
    await openCourtyard(page);
    await page.getByText(/Plain view/).first().click();
    await expect(page).not.toHaveURL(/game3d/);
    await expect(page.getByRole("heading", { level: 1, name: "The Fortress" })).toBeVisible();
    await problems.assertNone();
  });
});

test.describe("places opened by their link", () => {
  for (const { at, title } of PLACES) {
    test(`${at}: opens, sets the tab title and B walks back to the courtyard`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/game3d?at=${at}`);
      await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
      await expect(page).toHaveTitle(title);
      await expect(page).toHaveURL(new RegExp(`at=${at}`));
      await page.keyboard.press("b");
      await expect(page).toHaveURL((u) => u.search === "");
      await expect(page).toHaveTitle(/3D courtyard/);
      await problems.assertNone();
    });
  }

  // The Town stood outside the gate until 2026-11-10, when the Town Hall took its place. An old link must still land
  // somewhere sensible: the courtyard, never an error (placeLink.ts: "A broken link means the courtyard").
  for (const at of ["town", "nowhere", "holding", "library"]) {
    test(`a retired or broken link (?at=${at}) opens the courtyard`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/game3d?at=${at}`);
      await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
      await expect(page).toHaveTitle(/3D courtyard/);
      await problems.assertNone();
    });
  }
});
