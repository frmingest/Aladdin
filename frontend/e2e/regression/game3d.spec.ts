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

  /**
   * Puts the hero on an exact spot (development builds only, Scene.tsx). On a slow software-rendered frame one key press moves
   * her several metres, so walking cannot aim at a stand spot. Then waits out the short hover that follows every placement.
   */
  async function placeAt(page: Page, x: number, z: number) {
    await page.evaluate(([px, pz]) => (window as unknown as { __g3dPlace: (a: number, b: number) => void }).__g3dPlace(px, pz), [x, z]);
    trail.push(`placed at x ${x}, z ${z}`);
    await page.waitForTimeout(3_500);
  }

  // #431: the whole Royal Mint round. The hero is placed at each stand spot (a key press moves her several metres on a slow
  // software-rendered frame, so walking cannot aim); the prompts, the solid lever base, STAMP and the door are then real.
  // CI cannot see the picture, so it cannot judge that the result wall is in view or that plates read; it checks that the pull
  // is heard, that STAMP asks the backend with the pulled lever, and that the door leads back out.
  // The prompt shows "Press E to X" as a key cap "E" plus "X" with its first letter capitalised (actionPrompt.ts), so the
  // patterns match that, not the sentence in mintWordsV1.ts.
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
      // Up to the press by walking, with nothing pulled: it says so and promises nothing.
      await walkUntil(page, "w", /Pull a lever first, then STAMP/, 100);
      // At the Toll Gate's stand spot (x -5.6, z -6.4) its prompt shows.
      await placeAt(page, -5.6, -6.4);
      await expect(prompt).toContainText(/^E\s*Pull Toll Gate/);
      // Its base is solid (#431): walking north from here stops at the base, a hero's width short of the wall (z -8.65), not at it.
      await page.keyboard.down("w");
      await page.waitForTimeout(1_000);
      await page.keyboard.up("w");
      await page.waitForTimeout(1_000);
      const stopped = await heroAt(page);
      trail.push(`walked north into the base: x ${stopped.x.toFixed(2)}, z ${stopped.z.toFixed(2)}`);
      expect(stopped.z, "she moved north").toBeLessThan(-6.6);
      expect(stopped.z, "stopped by the lever base, not the wall").toBeGreaterThan(-8.3);
      await placeAt(page, -5.6, -6.4);
      await page.keyboard.press("e");
      // Beside the press: its prompt now offers STAMP, because a lever is pulled.
      await placeAt(page, 1.2, -0.2);
      await expect(prompt).toContainText(/^E\s*STAMP/);

      const asked = page.waitForResponse((r) => /\/game\/printer\?/.test(r.url()) && r.url().includes("pull="));
      await page.keyboard.press("e");
      const answer = await asked;
      expect(answer.status()).toBe(200);
      expect(new URL(answer.url()).searchParams.get("pull")).toMatch(/^toll_gate:/);
      // STAMP turns the camera to face east (#431), and walking keys follow the camera: W is east, S west, A north, D south.
      // Give the turn time to finish (software WebGL is slow) before steering again.
      await page.waitForTimeout(2_000);

      // By the door: E walks back out.
      await placeAt(page, 2, 6.5);
      await expect(prompt).toContainText(/Step back outside/);
      await page.keyboard.press("e");
      await expect(page).toHaveTitle(/3D courtyard/);
      await expect(page).toHaveURL((u) => u.search === "");
    } catch (e) {
      throw new Error(`${(e as Error).message}\nPrompts heard after each step (${trail.length} steps; first 40, then last 10):\n${[...trail.slice(0, 40), "...", ...trail.slice(-10)].join("\n")}`);
    }
    await problems.assertNone();
  });
});

// Draw calls and triangles per place (#448). REPORT-ONLY: the numbers go to the console, the test annotations and a JSON
// attachment in the HTML report, and nothing here can fail on how big they are. The count comes from the same stats label
// the P key shows in the toolbar ("60 fps · 212 draws · 94k tris"), so it is what a person reads on a real GPU. It is a
// count from a headless software-GL run: it says how many draws the scene asks for, not how fast they run. Frame rate and
// the real look stay a person's (.claude/standards/game3d-standard.md, section on performance).
test.describe("draw calls (report only)", () => {
  const COURTYARD = { at: "", label: "courtyard" };
  const WHERE = [COURTYARD, ...PLACES.map(({ at }) => ({ at, label: at }))];

  for (const { at, label } of WHERE) {
    test(`${label}: records draw calls and triangles`, async ({ page }, testInfo) => {
      const problems = watch(page);
      await page.goto(at ? `/game3d?at=${at}` : "/game3d");
      await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
      // P turns the stats label on in the toolbar; the first report arrives about half a second later.
      await page.keyboard.press("p");
      const stats = page.getByRole("button", { name: /\d+ draws/ });
      await expect(stats).toBeVisible({ timeout: 60_000 });
      const text = (await stats.innerText()).replace(/\s+/g, " ");
      const found = /(\d+) draws · (\d+)k tris/.exec(text);
      // Report-only means a missing number is a note, never a failure of the page.
      const result = found
        ? { place: label, drawCalls: Number(found[1]), trianglesThousands: Number(found[2]), source: "headless software GL" }
        : { place: label, drawCalls: null, trianglesThousands: null, source: "headless software GL", unread: text };
      console.log(`[draw-calls] ${JSON.stringify(result)}`);
      testInfo.annotations.push({ type: "draw-calls", description: found ? `${label}: ${found[1]} draws, ${found[2]}k tris (headless software GL, report only)` : `${label}: stats label not readable ("${text}")` });
      await testInfo.attach(`draw-calls-${label}.json`, { body: JSON.stringify(result, null, 2), contentType: "application/json" });
      await problems.assertNone();
    });
  }
});
