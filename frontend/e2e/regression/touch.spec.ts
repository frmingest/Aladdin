import { expect, test, type Page } from "@playwright/test";
import { watch } from "../support/guard";

/**
 * 3D touch controls (#485), on the demo stack with a phone's touch screen emulated (Chromium: `hasTouch` + `isMobile`, so
 * `(pointer: coarse)` matches). Plan: `docs/game/game3d-touch-controls-plan-2026-11-22.md`.
 *
 * It checks behaviour only, on CI's software WebGL: the stick is there (and not on a desktop), a real touch drag on it
 * walks the hero, the seal appears at an advisor with the prompt's own word, opens the talk, and goes when the prompt does,
 * and the swap puts the stick on the other side. How it looks and feels on a real phone stays a person's look.
 */

type Spot = { x: number; z: number };

/** Where the hero stands (development builds publish it every frame; see Scene.tsx). */
async function heroAt(page: Page): Promise<Spot> {
  const at = await page.evaluate(() => (window as unknown as { __g3dHero?: Spot }).__g3dHero ?? null);
  expect(at, "the dev build publishes the hero's place").not.toBeNull();
  return at!;
}

/** Puts the hero on an exact spot (development builds only, Scene.tsx), then waits out the short hover after it. */
async function placeAt(page: Page, x: number, z: number) {
  await page.waitForFunction(() => typeof (window as unknown as { __g3dPlace?: unknown }).__g3dPlace === "function", null, { timeout: 60_000 });
  await page.evaluate(([px, pz]) => (window as unknown as { __g3dPlace: (a: number, b: number) => void }).__g3dPlace(px, pz), [x, z]);
  await page.waitForTimeout(3_500);
}

async function openCourtyard(page: Page) {
  await page.goto("/game3d");
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
  await expect(page).toHaveTitle(/3D courtyard/);
}

test.describe("on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the stick walks; the seal shows the prompt's word at Barren, opens the talk and goes with the prompt; swap hands", async ({ page }) => {
    test.setTimeout(180_000);
    const problems = watch(page);
    await openCourtyard(page);
    const stick = page.getByRole("group", { name: "Walk" });
    const seal = page.getByTestId("touch-seal");

    // The demo opens the Quest log on a cold load. The controls step aside for any panel: shut it (a tap on its chip).
    const quests = page.getByRole("complementary", { name: "Quest log" });
    if (await quests.isVisible()) {
      await expect(stick).toHaveCount(0);
      await page.getByRole("button", { name: /^Quests/ }).tap();
      await expect(quests).toHaveCount(0);
    }
    await expect(stick).toBeVisible();
    // The hint teaches touch, not keys (a cold context is a first visit, so it shows).
    await expect(page.getByTestId("controls-hint")).toHaveText(/Push the rose to walk/);
    await expect(page.getByTestId("controls-hint")).not.toContainText("W A S D");
    // Toolbar chips are 44 px tap targets on a touch screen.
    for (const box of await page.locator(".g3d-tool").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(44);
    }

    // A real touch drag on the rose (pointer events from the browser's own touch input) walks the hero north.
    await placeAt(page, 0, 36);
    const from = await heroAt(page);
    const rose = (await stick.locator(".g3d-stick-rose").boundingBox())!;
    const cx = rose.x + rose.width / 2;
    const cy = rose.y + rose.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx, y: cy - 30, id: 1 }] });
    await expect.poll(async () => from.z - (await heroAt(page)).z, { timeout: 30_000, message: "the hero walks north while the stick is pushed up" }).toBeGreaterThan(1);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // Let go: the hero stops (two reads a moment apart agree).
    await page.waitForTimeout(1_000);
    const stopped = await heroAt(page);
    await page.waitForTimeout(1_000);
    const later = await heroAt(page);
    expect(Math.hypot(later.x - stopped.x, later.z - stopped.z), "the hero stands once the thumb lifts").toBeLessThan(0.2);

    // Nothing in reach at the gate: no seal.
    await placeAt(page, 0, 36);
    await expect(seal).toHaveCount(0);

    // At Barren: the seal reads the prompt's own word and is named by the whole action; the prompt is words only.
    await placeAt(page, -7.4, 28.6);
    await expect(seal).toBeVisible();
    await expect(seal).toHaveText("Talk");
    await expect(seal).toHaveAccessibleName("Talk to Barren Wuffet");
    const prompt = page.locator(".g3d-prompt");
    await expect(prompt).toHaveText("Talk to Barren Wuffet");
    await expect(prompt.locator("kbd")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^E: / })).toHaveCount(0);
    const sealBox = (await seal.boundingBox())!;
    expect(Math.min(sealBox.width, sealBox.height)).toBeGreaterThanOrEqual(44);

    // A tap on the seal does what E does: the talk opens, and the seal steps aside while it is open.
    await seal.tap();
    const talk = page.getByRole("dialog", { name: "Talking to Barren Wuffet" });
    await expect(talk).toBeVisible();
    await expect(seal).toHaveCount(0);
    await talk.getByRole("button").last().tap();
    await expect(talk).toHaveCount(0);
    await expect(seal).toHaveText("Talk");

    // Out of reach again: the prompt goes, and the seal with it.
    await placeAt(page, 0, 36);
    await expect(page.locator(".g3d-prompt")).toHaveCount(0);
    await expect(seal).toHaveCount(0);

    // Swap hands: the stick goes to the right, the seal to the left.
    await page.getByRole("button", { name: /^Swap hands/ }).tap();
    await expect(page.getByTestId("touch-stick")).toHaveClass(/\bright\b/);
    await placeAt(page, -7.4, 28.6);
    await expect(seal).toHaveClass(/\bleft\b/);
    await problems.assertNone();
  });
});

test.describe("on a desktop with a mouse", () => {
  test("no stick, no seal: the keyboard hint and the E key cap stay", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watch(page);
    await openCourtyard(page);
    await placeAt(page, -7.4, 28.6);
    await expect(page.locator(".g3d-prompt")).toContainText("Talk to Barren Wuffet");
    await expect(page.locator(".g3d-prompt kbd")).toHaveText("E");
    await expect(page.getByTestId("touch-stick")).toHaveCount(0);
    await expect(page.getByTestId("touch-seal")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Swap hands/ })).toHaveCount(0);
    await problems.assertNone();
  });
});
