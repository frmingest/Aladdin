import { expect, test, type Page, type Request } from "@playwright/test";
import { watch } from "../support/guard";

/**
 * The starter's practice yard (/game3d?at=practice, #477 build step 1, #493): the test that proves the practice makes no
 * write (spec `docs/game/game3d-starter-level-spec-2026-11-22.md` section 11). Each later build step extends it to its beats.
 *
 * From the moment the yard has settled, it records every request the page sends and every key in the browser's storage,
 * plays the starter as far as it is built (beats 1 and 2) by keyboard and then by touch, and checks that:
 * - every request to the backend is a read (GET, HEAD or OPTIONS), and none carries the practice company's name;
 * - the only storage key added or changed is the starter's own (`aladdin.game3d.starter.v1`); the Guide and the round keys
 *   are untouched;
 * - no real panel opens in the yard, the courtyard's Towers panel never lists the made-up company, and the practice tag is
 *   on screen throughout the yard.
 *
 * Like the other 3D checks this runs on software WebGL in CI: it proves behaviour, not how the yard looks or feels.
 */

const STARTER_KEY = "aladdin.game3d.starter.v1";
const READS = new Set(["GET", "HEAD", "OPTIONS"]);

async function storage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) out[k] = localStorage.getItem(k) ?? "";
    }
    return out;
  });
}

/** Opens the yard and waits until the page has stopped loading, so what happens next is the starter's doing alone. */
async function openYard(page: Page) {
  await page.goto("/game3d?at=practice");
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
  await expect(page).toHaveTitle(/Practice yard/);
  await expect(page.getByTestId("practice-tag")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** Starts recording backend requests and returns what it recorded so far, whenever asked. */
function recordApi(page: Page): () => { method: string; url: string; body: string }[] {
  const seen: { method: string; url: string; body: string }[] = [];
  page.on("request", (r: Request) => {
    if (!r.url().includes("/api/")) return;
    seen.push({ method: r.method(), url: r.url(), body: r.postData() ?? "" });
  });
  return () => seen;
}

async function assertNoWrite(page: Page, before: Record<string, string>, api: () => { method: string; url: string; body: string }[]) {
  for (const r of api()) {
    expect(READS.has(r.method), `${r.method} ${r.url}`).toBe(true);
    expect(`${r.url} ${r.body}`, r.url).not.toMatch(/Pip|practice/i);
  }
  const after = await storage(page);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
  expect(changed).toEqual([STARTER_KEY]);
  expect(after["aladdin.game3d.guide.v1"]).toBe(before["aladdin.game3d.guide.v1"]);
  expect(after["aladdin.game3d.round.v1"]).toBe(before["aladdin.game3d.round.v1"]);
  expect(JSON.parse(after[STARTER_KEY]).run).toEqual({ beat: "walls", picks: { company: "pip" } });
}

test.describe("practice yard: beats 1 and 2 make no write", () => {
  test("keyboard: arrive, Sal's card opens by itself, 1 picks, the tower stands", async ({ page }) => {
    const problems = watch(page);
    await openYard(page);
    const before = await storage(page);
    const api = recordApi(page);

    // Beat 1: no tap. The arrival plate goes and Sal's card opens by itself, with focus on the one company.
    const card = page.getByRole("dialog", { name: "Sal's counter (practice)" });
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card.getByRole("button", { name: /Pip's Lemonade/ })).toBeFocused();
    // While the card is open the page's own hotkeys stay quiet.
    await page.keyboard.press("t");
    await expect(page.getByRole("complementary", { name: "Your towers in words" })).toHaveCount(0);

    // Beat 2: one key.
    await page.keyboard.press("1");
    await expect(card).toHaveCount(0);
    await expect(page.getByText("Knock on the walls", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("A share is a small piece of a business. This piece is yours.").first()).toBeVisible();

    // The yard's own Plain view, not the flat Fortress: the company is looked at, the rest is not yet.
    await page.getByRole("button", { name: /Plain view/ }).click();
    const plain = page.getByRole("complementary", { name: "Practice yard, plain" });
    await expect(plain).toContainText("Pip's Lemonade: a lemonade stand by the park");
    await expect(plain).toContainText("Not looked at yet");
    await plain.getByRole("button", { name: "Close" }).click();

    // No real panel opens in the yard: T does nothing there, and the toolbar has no Towers or Quests tool.
    await page.keyboard.press("t");
    await expect(page.getByRole("complementary", { name: "Your towers in words" })).toHaveCount(0);
    await page.keyboard.press("q");
    await expect(page.getByRole("complementary", { name: "Quest log" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Towers/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Quests/ })).toHaveCount(0);
    await expect(page.getByTestId("practice-tag")).toBeVisible();

    await assertNoWrite(page, before, api);

    // The made-up company never reaches a real list: walk out and read the courtyard's Towers panel.
    await page.keyboard.press("b");
    await expect(page).toHaveTitle(/3D courtyard/);
    await page.keyboard.press("t");
    const towers = page.getByRole("complementary", { name: "Your towers in words" });
    await expect(towers).toBeVisible();
    await expect(towers).not.toContainText("Pip");
    await problems.assertNone();
  });

  test.describe("touch", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("taps only: close and reopen Sal's card, then one tap on the company card raises the tower", async ({ page }) => {
      const problems = watch(page);
      await openYard(page);
      const before = await storage(page);
      const api = recordApi(page);

      const card = page.getByRole("dialog", { name: "Sal's counter (practice)" });
      await expect(card).toBeVisible({ timeout: 60_000 });
      // A phone cannot walk back to the counter yet (#485): after closing the card, the goal strip brings it back.
      await card.getByRole("button", { name: "Close" }).tap();
      await expect(card).toHaveCount(0);
      await page.getByRole("button", { name: "Open Sal's counter" }).tap();
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: /Pip's Lemonade/ }).tap();
      await expect(card).toHaveCount(0);
      await expect(page.getByText("Knock on the walls", { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId("practice-tag")).toBeVisible();

      await assertNoWrite(page, before, api);
      await problems.assertNone();
    });
  });

  test("a reload keeps the tower and does not open Sal's card again", async ({ page }) => {
    const problems = watch(page);
    await openYard(page);
    await expect(page.getByRole("dialog", { name: "Sal's counter (practice)" })).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("1");
    await expect(page.getByText("Knock on the walls", { exact: true }).first()).toBeVisible();
    await openYard(page);
    await expect(page.getByText("Knock on the walls", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Sal's counter (practice)" })).toHaveCount(0);
    // B walks back out to the courtyard, like every other place.
    await page.keyboard.press("b");
    await expect(page).toHaveURL((u) => u.search === "");
    await expect(page).toHaveTitle(/3D courtyard/);
    await problems.assertNone();
  });
});
