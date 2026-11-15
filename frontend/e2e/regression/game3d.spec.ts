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
  /** What the prompt said after each step, newest last: when a walk times out, the test failure shows where it was heard. */
  const trail: string[] = [];
  async function walkUntil(page: Page, key: string, text: RegExp, holdMs = 350) {
    const prompt = page.locator(".g3d-prompt");
    await expect(async () => {
      await page.keyboard.down(key);
      await page.waitForTimeout(holdMs);
      await page.keyboard.up(key);
      trail.push(`${key}: ${(await prompt.allInnerTexts()).join("|") || "(no prompt)"}`);
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

  /** Where the hero stands (development builds publish it every frame; see Scene.tsx). */
  async function heroAt(page: Page): Promise<{ x: number; z: number }> {
    const at = await page.evaluate(() => (window as unknown as { __g3dHero?: { x: number; z: number } }).__g3dHero ?? null);
    expect(at, "the dev build publishes the hero's place").not.toBeNull();
    return at!;
  }

  /** Steps with `key` until `done(hero)` is true, reading where the hero is after each step. Returns where she ended. */
  async function walkTo(page: Page, key: string, done: (h: { x: number; z: number }) => boolean, label: string, holdMs = 300) {
    await expect(async () => {
      await page.keyboard.down(key);
      await page.waitForTimeout(holdMs);
      await page.keyboard.up(key);
      const h = await heroAt(page);
      trail.push(`${key} (${label}): x ${h.x.toFixed(1)}, z ${h.z.toFixed(1)}`);
      expect(done(h), label).toBe(true);
    }).toPass({ timeout: 60_000, intervals: [50] });
    return heroAt(page);
  }

  // #431: the whole Royal Mint round, steered only by the prompts (a fixed time of walking is not reliable on software WebGL).
  // The lever wall is Toll Gate, Great Press, Great Melt, Coin Rain, Harbour Guard, west to east (backend printer ledger order).
  // CI cannot see the picture, so it cannot judge that the result wall is in view or that plates read; it checks that the
  // pull is heard, that STAMP asks the backend with the pulled lever, and that the door leads back out.
  // The prompt shows "Press E to X" as a key cap "E" plus "X" with its first letter capitalised (actionPrompt.ts), so the
  // patterns match that, not the sentence in mintWordsV1.ts. CI moves the hero about 3 m in 150 ms, so steps are short (40 ms, under a metre) and checked against where she stands.
  test("Royal Mint: pull a lever, STAMP asks the backend, and the door walks back out", async ({ page }) => {
    test.setTimeout(300_000);
    const problems = watch(page);
    trail.length = 0;
    // The levers on the wall come from the ledger: if it does not load, no lever prompt can ever show. Say so first.
    const ledgerAsked = page.waitForResponse((r) => r.url().includes("/game/printer/ledger"), { timeout: 60_000 });
    await page.goto("/game3d?at=mint");
    await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
    await expect(page).toHaveTitle(/Royal Mint/);
    const prompt = page.locator(".g3d-prompt");
    const ledgerAnswer = await ledgerAsked;
    expect(ledgerAnswer.status(), "the ledger answers").toBe(200);
    expect(((await ledgerAnswer.json()) as { levers: unknown[] }).levers.length, "the ledger lists levers").toBeGreaterThan(0);
    try {
      // Up to the press with nothing pulled: it says so and promises nothing.
      await walkUntil(page, "w", /Pull a lever first, then STAMP/, 300);
      // West, then north, to the stand spot of the Toll Gate (x -5.6, z -6.4): the lever prompt is its own proof.
      await walkTo(page, "a", (h) => h.x <= -5.4, "west to the Toll Gate's column", 40);
      await walkTo(page, "w", (h) => h.z <= -6.2, "north to the lever row", 40);
      await expect(prompt).toContainText(/^E\s*Pull Toll Gate/);
      // Its base is solid (#431): walking on north stops at the base, a hero's width short of the wall, not at the wall.
      let last = Infinity;
      let still = 0;
      const stopped = await walkTo(
        page,
        "w",
        (h) => {
          still = Math.abs(h.z - last) < 0.02 ? still + 1 : 0;
          last = h.z;
          return still >= 2;
        },
        "north until something stops her",
        250,
      );
      expect(stopped.z, "stopped by the lever base, not the wall").toBeGreaterThan(-8.3);
      expect(stopped.z, "she did not walk through the base").toBeLessThan(-7.6);
      await walkTo(page, "s", (h) => h.z >= -6.4, "back to the stand spot", 40);
      await expect(prompt).toContainText(/^E\s*Pull Toll Gate/);
      await page.keyboard.press("e");
      // East along the lever row to the middle lever, then south to the press: its prompt now offers STAMP, because a lever is pulled.
      await walkTo(page, "d", (h) => h.x >= -0.4, "east to the middle lever", 40);
      await walkUntil(page, "s", /^E\s*STAMP/, 100);

      const asked = page.waitForResponse((r) => /\/game\/printer\?/.test(r.url()) && r.url().includes("pull="));
      await page.keyboard.press("e");
      const answer = await asked;
      expect(answer.status()).toBe(200);
      expect(new URL(answer.url()).searchParams.get("pull")).toMatch(/^toll_gate:/);
      // STAMP turns the camera to face east (#431), and walking keys follow the camera: W is east, S west, A north, D south.
      // Give the turn time to finish (software WebGL is slow) before steering again.
      await page.waitForTimeout(5_000);

      // The camera now looks east, so W is east and D is south. East clear of the press's side, then south to the door.
      await walkTo(page, "w", (h) => h.x >= 2, "east, clear of the press", 40);
      await walkTo(page, "d", (h) => h.z >= 6.5, "south to the door", 100);
      await walkUntil(page, "d", /Step back outside/, 40);
      await page.keyboard.press("e");
      await expect(page).toHaveTitle(/3D courtyard/);
      await expect(page).toHaveURL((u) => u.search === "");
    } catch (e) {
      throw new Error(`${(e as Error).message}\nPrompts heard after each step (${trail.length} steps; first 40, then last 10):\n${[...trail.slice(0, 40), "...", ...trail.slice(-10)].join("\n")}`);
    }
    await problems.assertNone();
  });
});
