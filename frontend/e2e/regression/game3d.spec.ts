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
  { at: "mint", title: /Royal Mint/ },
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
      // The demo fortress opens the Quest log once on a cold load, so the made-up round is on screen with 0 taps
      // (Morning Round step 4, #423). Every other panel starts shut. The key toggles, so a shut panel opens on one press.
      if (key === "q") {
        await expect(panel).toBeVisible();
        await page.keyboard.press(key);
        await expect(panel).toHaveCount(0);
      } else {
        await expect(panel).toHaveCount(0);
      }
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
    // The exact toolbar link. A looser match also finds the Quest log's "Old entries in Plain view" link (to /journal),
    // which comes first in the page now that the demo opens the Quest log on a cold load.
    await page.getByRole("link", { name: /^← Plain view$/ }).click();
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

// One list drives every "am I near it?", the prompt and the E key (#411). This walks the hero up to a thing, reads the
// prompt, presses E and checks that what the prompt promised is what happened; then it does the same at the door.
test.describe("things you can walk up to", () => {
  /**
   * Walks with `key` until the prompt says `text`. It waits on the prompt, not on a clock (software WebGL is slow), and it
   * walks in short steps: a key pressed before the world has finished loading is not heard, so one long press could be lost.
   */
  async function walkUntil(page: Page, key: string, text: RegExp) {
    const prompt = page.locator(".g3d-prompt");
    await expect(async () => {
      await page.keyboard.down(key);
      await page.waitForTimeout(350);
      await page.keyboard.up(key);
      await expect(prompt).toContainText(text, { timeout: 400 });
    }).toPass({ timeout: 60_000, intervals: [50] });
  }

  test("Hall of Records: the shelves open their page with E, and E at the door walks back out", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/game3d?at=records");
    await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
    await expect(page).toHaveTitle(/Hall of Records/);
    // Nothing is in reach where you arrive.
    await expect(page.locator(".g3d-prompt")).toHaveCount(0);

    await walkUntil(page, "w", /read the Hall of Records/i);
    await page.keyboard.press("e");
    await expect(page.getByRole("complementary", { name: "Hall of Records" })).toBeVisible();
    // The prompt steps aside while its page is open, and E does nothing more.
    await expect(page.locator(".g3d-prompt")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: "Hall of Records" })).toHaveCount(0);

    await walkUntil(page, "s", /Step back outside/);
    await page.keyboard.press("e");
    await expect(page).toHaveTitle(/3D courtyard/);
    await expect(page).toHaveURL((u) => u.search === "");
    await problems.assertNone();
  });

  test("Town Hall: a board lights its prompt and opens with E", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/game3d?at=townhall");
    await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
    await walkUntil(page, "w", /^E\s*Read /);
    const title = ((await page.locator(".g3d-prompt").innerText()).replace(/^E\s*Read\s*/, "")).trim();
    await page.keyboard.press("e");
    await expect(page.getByRole("complementary", { name: title })).toBeVisible();
    await problems.assertNone();
  });
});
