import { expect, test, type Page, type Request } from "@playwright/test";
import { watch } from "../support/guard";

/**
 * The starter's practice yard (/game3d?at=practice, #477 build step 1, #493): the test that proves the practice makes no
 * write (spec `docs/game/game3d-starter-level-spec-2026-11-22.md` section 11). Each later build step extends it to its beats.
 *
 * From the moment the yard has settled, it records every request the page sends and every key in the browser's storage,
 * plays the starter as far as it is built (beats 1 to 6, with one wrong pick at each check, #494, #495) by keyboard and then
 * by touch, and checks that:
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

type Run = { beat: string; picks: Record<string, unknown>; second?: true };
const AFTER_PICK: Run = { beat: "walls", picks: { company: "pip" } };

async function assertNoWrite(page: Page, before: Record<string, string>, api: () => { method: string; url: string; body: string }[], run: Run = AFTER_PICK) {
  for (const r of api()) {
    expect(READS.has(r.method), `${r.method} ${r.url}`).toBe(true);
    expect(`${r.url} ${r.body}`, r.url).not.toMatch(/Pip|practice/i);
  }
  const after = await storage(page);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
  expect(changed).toEqual([STARTER_KEY]);
  expect(after["aladdin.game3d.guide.v1"]).toBe(before["aladdin.game3d.guide.v1"]);
  expect(after["aladdin.game3d.round.v1"]).toBe(before["aladdin.game3d.round.v1"]);
  expect(JSON.parse(after[STARTER_KEY]).run).toEqual(run);
}

/**
 * After a miss the card ignores picks for SETTLE_MS (0.4 s, `checkCardLogic.ts`), so a double tap cannot land. A player's
 * next pick comes later than that; the test waits it out too, so each pick below lands, or is ignored, for its own reason.
 */
async function settle(page: Page) {
  await page.waitForTimeout(500);
}

/**
 * The result plate shows for 3.5 s, and on a software-GL runner two separate checks can outlast it. So its result line and
 * its page line are checked in one assertion on the plate itself (a region named after the Book page).
 */
async function expectResult(page: Page, label: string, result: string, pageLine: string, said?: string) {
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const plate = page.getByRole("region", { name: label, exact: true });
  // A line said on the plate (the storm's Marlie line) is matched in the same assertion: a second one after it raced the
  // plate's 3.5 s on a slow runner (#528's CI, twice).
  const middle = said ? `[\\s\\S]*${esc(said)}` : "";
  await expect(plate).toHaveText(new RegExp(`^${esc(result)}${middle}[\\s\\S]*${esc(pageLine)}$`));
}

/**
 * Beats 3 and 4 (#494) by keyboard: each card opens by itself, one wrong pick shows the hint and takes that choice off the
 * card, then the right one (now key 1) gives the result and the new page. The keys are the visible choices' numbers.
 */
async function playChecksByKeyboard(page: Page) {
  const walls = page.getByRole("dialog", { name: "Knock on the walls. Which walls?" });
  await expect(walls).toBeVisible({ timeout: 30_000 });
  // Focus lands on the speaker's line, not on a choice (#495): Enter alone picks nothing.
  await expect(walls.getByText("Strong walls: it makes money and owes little.")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(walls).toBeVisible();
  await expect(walls.getByRole("button")).toHaveCount(4); // Close and the three choices: nothing was picked
  // Timber (key 1) is wrong. Marlie's hint replaces the taught line and Timber's slot goes blank; the others keep their keys.
  await page.keyboard.press("1");
  await expect(walls).toContainText("Look again. It owes 5. Last year it made 10.");
  await expect(walls.getByRole("button", { name: /Timber/ })).toHaveCount(0);
  await expect(walls.getByRole("button")).toHaveCount(3); // Close, Granite, Rotted: Timber's slot stays, blank
  // The slots do not move: once the card has settled, pressing 1 again picks nothing (the blank slot), so "1, 1" cannot win.
  await settle(page);
  await page.keyboard.press("1");
  await expect(walls).toBeVisible();
  await expect(walls).toContainText("Look again.");
  // While the card is open the page's own hotkeys stay quiet.
  await page.keyboard.press("t");
  await expect(page.getByRole("complementary", { name: "Your towers in words" })).toHaveCount(0);
  await page.keyboard.press("2"); // Granite, still in slot 2
  await expect(walls).toHaveCount(0);
  await expectResult(page, "Walls", "Granite walls. One year's money pays its debt.", "New page: Walls");

  const moat = page.getByRole("dialog", { name: "What stops others copying Pip's?" });
  await expect(moat).toBeVisible({ timeout: 30_000 });
  await expect(moat.getByText("A moat is what stops others copying it.")).toBeFocused();
  await page.keyboard.press("2"); // Cheapest lemonade this week: wrong
  await expect(moat).toContainText("Anyone can cut prices tomorrow.");
  await settle(page);
  await page.keyboard.press("3"); // Gran's secret recipe, still in slot 3
  await expect(moat).toHaveCount(0);
  await expectResult(page, "Moat", "Narrow moat. A recipe is hard to copy.", "New page: Moat");
}

/**
 * Beats 5 and 6 (#495) by keyboard. The price card opens by itself after the moat's result; one wrong pick, then the right one
 * (slot 2). Then the storm comes on its own: "Storm coming", then the card. One wrong pick, then the right one (slot 3).
 */
async function playPriceAndStormByKeyboard(page: Page) {
  const price = page.getByRole("dialog", { name: "Worth about 10. Price 7. How much room?" });
  await expect(price).toBeVisible({ timeout: 30_000 });
  // The card is ready once its speaker's line has focus (set with its keys, so a key pressed before then could be lost).
  await expect(price.getByText("Worth 10, price 7. That gap is room to be wrong.")).toBeFocused();
  // The right answer is in slot 1 here (the gauge's own order), so no fixed key pattern wins every card.
  await page.keyboard.press("2"); // Some room: wrong
  await expect(price).toContainText("Weigh it again. Even the low guess is 8.");
  await settle(page);
  await page.keyboard.press("1"); // Lots of room, still in slot 1
  await expect(price).toHaveCount(0);
  await expectResult(page, "Room to be wrong", "Lots of room. Even a low guess beats the price.", "New page: Room to be wrong");

  // The storm is not on top of beat 5: its plate first, then the card, with no tap.
  await expect(page.getByTestId("starter-note")).toHaveText("Storm coming", { timeout: 30_000 });
  const storm = page.getByRole("dialog", { name: "Storm! Prices fell 30%. What changed?" });
  await expect(storm).toBeVisible({ timeout: 30_000 });
  await expect(storm.getByText("Look at the cards, then the price.")).toBeFocused();
  await page.keyboard.press("2"); // It owes more now: wrong
  await expect(storm).toContainText("Still owes 5. Look again.");
  await settle(page);
  await page.keyboard.press("3"); // Only the price
  await expect(storm).toHaveCount(0);
  await expectResult(page, "Storms", "Only the price. Walls and moat held.", "New page: Storms", "If it owed more, that would be news.");
}

const AFTER_CHECKS: Run = {
  beat: "why",
  picks: { company: "pip", walls: ["timber", "granite"], moat: ["cheap", "recipe"], price: ["some", "lots"], storm: ["owes", "price"] },
};

/**
 * Beat 7 (#496) by keyboard: the why card opens by itself after the storm's result, one row of chips at a time, focus on
 * Barren's line (row 2: the half-written sheet). One chip per row; the second pins the sheet. Then the result plate with its page line.
 */
async function pinWhyByKeyboard(page: Page, chips: [string, string], pageLine: string) {
  const row1 = page.getByRole("dialog", { name: "Why I own it" });
  await expect(row1).toBeVisible({ timeout: 30_000 });
  await expect(row1.getByText("Write why you own it, and what proves you wrong.")).toBeFocused();
  await page.keyboard.press(chips[0]);
  const row2 = page.getByRole("dialog", { name: "I'm wrong if" });
  await expect(row2).toBeVisible();
  // Row 2's header is the half-written sheet: the why just picked, so the "wrong if" is chosen beside it.
  await expect(row2.getByText(/^Your why: .+\.$/)).toBeFocused();
  await page.keyboard.press(chips[1]);
  await expect(row2).toHaveCount(0);
  await expectResult(page, "Write it down", "Pinned on the door. The flag is up.", pageLine);
}

/** Beats 3 to 5 with the right answer at once (a second run: the lesson is the storm). */
async function playToStormByKeyboard(page: Page) {
  for (const [name, line, key] of [
    ["Knock on the walls. Which walls?", "Strong walls: it makes money and owes little.", "2"],
    ["What stops others copying Pip's?", "A moat is what stops others copying it.", "3"],
    ["Worth about 10. Price 7. How much room?", "Worth 10, price 7. That gap is room to be wrong.", "1"],
  ] as const) {
    const card = page.getByRole("dialog", { name });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText(line)).toBeFocused();
    await page.keyboard.press(key);
    await expect(card).toHaveCount(0);
  }
}

/** The end of a full run, then "Play again" with the second storm (beat 6b), then the end again: no banner the second time. */
const AFTER_PLAY_AGAIN: Run = {
  beat: "end",
  picks: { company: "pip", walls: ["granite"], moat: ["recipe"], price: ["lots"], storm: ["price", "owes"], why: ["price", "owing"] },
  second: true,
} as Run;

test.describe("practice yard: the whole starter and Play again make no write", () => {
  test("keyboard: every beat with one miss at each check, the end, Play again with the second storm; the Book is full outside", async ({ page }) => {
    // Two runs, a walk out and the courtyard's load on CI's software WebGL take about three minutes.
    test.setTimeout(420_000);
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
    await expect(plain).not.toContainText("Half of one year: granite.");
    await plain.getByRole("button", { name: "Close" }).click();

    // Beats 3 to 6, each with one wrong pick.
    await playChecksByKeyboard(page);
    await playPriceAndStormByKeyboard(page);
    await expect(page.getByText("Pin your why", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Plain view/ }).click();
    await expect(plain).toContainText("Owes 5. Made 10 last year. Half of one year: granite.");
    await expect(plain).toContainText("Narrow. Gran's secret recipe is hard to copy, not impossible.");
    await expect(plain).toContainText("3 coins on 10 (30%). Lots of room.");
    await expect(plain).toContainText("Every price fell 30%: 4.9 coins. Still made 10, still owes 5.");
    await plain.getByRole("button", { name: "Close" }).click();
    await assertNoWrite(page, before, api, AFTER_CHECKS);

    // Beat 7 (#496): pin the why, two keys. All five pages: the banner and the cheer, then Barren and the two buttons.
    await pinWhyByKeyboard(page, ["1", "1"], "New page: Write it down");
    const end = page.getByTestId("starter-end");
    await expect(end).toBeVisible({ timeout: 30_000 });
    await expect(end).toContainText("You can read a tower now. Next, real ones.");
    await expect(end.getByRole("button", { name: "Bring your real fortress" })).toBeFocused();
    let saved = JSON.parse((await storage(page))[STARTER_KEY]);
    expect(saved.finished).toBe(true);
    expect(saved.banner).toBe("now");
    expect([...saved.pages].sort()).toEqual(["moat", "room", "storms", "walls", "why"]);

    // Play again: back at Sal's counter, the Book kept. The second storm: the fridge broke, owes 15, brick walls.
    await end.getByRole("button", { name: "Play again" }).click();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("1");
    await playToStormByKeyboard(page);
    await expect(page.getByTestId("starter-note")).toHaveText("The fridge broke. Pip's borrowed 10 coins.", { timeout: 30_000 });
    const storm2 = page.getByRole("dialog", { name: "Storm! Prices fell 30%. What changed?" });
    await expect(storm2).toBeVisible({ timeout: 30_000 });
    await expect(storm2.getByText("Look at the cards, then the price.")).toBeFocused();
    await page.keyboard.press("3"); // Only the price: wrong this time
    await expect(storm2).toContainText("Owes 15 now. Look again.");
    await settle(page);
    await page.keyboard.press("2"); // It owes more now
    await expect(storm2).toHaveCount(0);
    await expectResult(page, "Storms", "It owes more now. The walls cracked.", "Already in your book.");
    await pinWhyByKeyboard(page, ["3", "2"], "Already in your book.");
    await expect(end).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Plain view/ }).click();
    await expect(plain).toContainText("Brick. Owes 15. Made 10 last year.");
    await expect(plain).toContainText("Every price fell 30%: 4.9 coins. Borrowed 10, so it owes 15.");
    await expect(plain).toContainText("Low 7, middle 9, high 11 coins.");
    await plain.getByRole("button", { name: "Close" }).click();
    saved = JSON.parse((await storage(page))[STARTER_KEY]);
    expect(saved.banner).toBe("done");

    // No real panel opens in the yard: T does nothing there, and the toolbar has no Towers or Quests tool.
    await page.keyboard.press("t");
    await expect(page.getByRole("complementary", { name: "Your towers in words" })).toHaveCount(0);
    await page.keyboard.press("q");
    await expect(page.getByRole("complementary", { name: "Quest log" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Towers/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Quests/ })).toHaveCount(0);
    await expect(page.getByTestId("practice-tag")).toBeVisible();

    await assertNoWrite(page, before, api, AFTER_PLAY_AGAIN);
    expect(JSON.parse((await storage(page))[STARTER_KEY]).pages).toEqual(["walls", "moat", "room", "storms", "why"]);

    // The made-up company never reaches a real list: walk out and read the courtyard's Towers panel.
    await page.keyboard.press("b");
    await expect(page).toHaveTitle(/3D courtyard/);
    await page.keyboard.press("t");
    const towers = page.getByRole("complementary", { name: "Your towers in words" });
    await expect(towers).toBeVisible();
    await expect(towers).not.toContainText("Pip");
    await page.keyboard.press("t");

    // Outside the yard the Book is the first Quests card: all five pages learned, and no count anywhere.
    const quests = page.getByRole("complementary", { name: "Quest log" });
    // The sample fortress may already have opened the Quests panel by itself; Q would then shut it.
    if (!(await quests.isVisible())) await page.keyboard.press("q");
    await quests.getByRole("button", { name: "Read the Book" }).click();
    const book = page.getByRole("dialog", { name: "Book of Wisdom" });
    await expect(book).toBeVisible();
    const page_ = (title: string) => book.getByRole("listitem").filter({ has: page.getByRole("heading", { name: new RegExp(`^${title}`) }) });
    await expect(page_("Walls")).toContainText("Strong walls: it makes money and owes little.");
    await expect(page_("Moat")).toContainText("A moat is what stops others copying it.");
    await expect(page_("Room to be wrong")).toContainText("That gap is room to be wrong.");
    await expect(page_("Storms")).toContainText("The price fell. The business did not.");
    await expect(page_("Write it down")).toContainText("Write why you own it, and what proves you wrong.");
    await expect(book).not.toContainText(/\d+\s*of\s*\d+/);
    await page.keyboard.press("Escape");
    await expect(book).toHaveCount(0);
    // Opening the Book put the Quests panel away, so two panels never stack; Escape leaves the courtyard clear.
    await expect(quests).toHaveCount(0);
    await problems.assertNone();
  });

  test.describe("touch", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("taps only: reopen each card from the goal strip; two misses at the moat keep its page locked", async ({ page }) => {
      // Six beats by touch on CI's software WebGL take about 100 s.
      test.setTimeout(240_000);
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

      // Beat 3 by taps: put the card away, the goal strip brings it back (a phone cannot walk to the tower yet, #485).
      const walls = page.getByRole("dialog", { name: "Knock on the walls. Which walls?" });
      await expect(walls).toBeVisible({ timeout: 30_000 });
      await walls.getByRole("button", { name: "Close" }).tap();
      await expect(walls).toHaveCount(0);
      await page.getByRole("button", { name: "Knock on the walls" }).tap();
      await walls.getByRole("button", { name: /Rotted/ }).tap();
      await expect(walls).toContainText("Look again.");
      await settle(page);
      await walls.getByRole("button", { name: /Granite/ }).tap();
      await expectResult(page, "Walls", "Granite walls. One year's money pays its debt.", "New page: Walls");

      // Beat 4 by taps: two misses show the answer, fill the moat anyway, and keep the page locked.
      const moat = page.getByRole("dialog", { name: "What stops others copying Pip's?" });
      await expect(moat).toBeVisible({ timeout: 30_000 });
      await moat.getByRole("button", { name: /shiny new sign/ }).tap();
      await expect(moat).toContainText("Anyone can paint a sign.");
      await settle(page);
      await moat.getByRole("button", { name: /Cheapest lemonade/ }).tap();
      await expect(moat).toHaveCount(0);
      await expectResult(page, "Moat", "Narrow moat. A recipe is hard to copy.", "Play again to earn this page.");

      // Beat 5 by taps (#495): put the card away, the goal strip brings it back; one miss, then the right one.
      const price = page.getByRole("dialog", { name: "Worth about 10. Price 7. How much room?" });
      await expect(price).toBeVisible({ timeout: 30_000 });
      await price.getByRole("button", { name: "Close" }).tap();
      await expect(price).toHaveCount(0);
      await page.getByRole("button", { name: "Weigh the price" }).tap();
      await price.getByRole("button", { name: /No room/ }).tap();
      await expect(price).toContainText("Weigh it again.");
      await settle(page);
      await price.getByRole("button", { name: /Lots of room/ }).tap();
      await expectResult(page, "Room to be wrong", "Lots of room. Even a low guess beats the price.", "New page: Room to be wrong");

      // Beat 6 by one tap: 0 to start (it comes on its own), 1 to answer.
      const storm = page.getByRole("dialog", { name: "Storm! Prices fell 30%. What changed?" });
      await expect(storm).toBeVisible({ timeout: 30_000 });
      await storm.getByRole("button", { name: /Only the price/ }).tap();
      await expectResult(page, "Storms", "Only the price. Walls and moat held.", "New page: Storms");
      await expect(page.getByTestId("practice-tag")).toBeVisible();

      // Beat 7 by two taps (#496). Beat 8 by sight: the Moat page is still locked, so no banner and no cheer; Barren says to
      // play again to fill the book.
      const why1 = page.getByRole("dialog", { name: "Why I own it" });
      await expect(why1).toBeVisible({ timeout: 30_000 });
      await why1.getByRole("button", { name: /Price below worth/ }).tap();
      await page.getByRole("dialog", { name: "I'm wrong if" }).getByRole("button", { name: /Customers stop coming/ }).tap();
      await expectResult(page, "Write it down", "Pinned on the door. The flag is up.", "New page: Write it down");
      const end = page.getByTestId("starter-end");
      await expect(end).toContainText("Play again to fill your book.", { timeout: 30_000 });
      await expect(end.getByRole("button", { name: "Play again" })).toBeVisible();

      await assertNoWrite(page, before, api, {
        beat: "end",
        picks: { company: "pip", walls: ["rotted", "granite"], moat: ["sign", "cheap"], price: ["none", "lots"], storm: ["price"], why: ["price", "customers"] },
      });
      const saved = JSON.parse((await storage(page))[STARTER_KEY]);
      expect(saved.pages).toEqual(["walls", "room", "storms", "why"]);
      expect(saved.finished).toBe(true);
      expect(saved.banner).toBeUndefined();
      await problems.assertNone();
    });
  });

  test("a reload keeps the tower, opens the walls card, not Sal's", async ({ page }) => {
    const problems = watch(page);
    await openYard(page);
    await expect(page.getByRole("dialog", { name: "Sal's counter (practice)" })).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("1");
    await expect(page.getByText("Knock on the walls", { exact: true }).first()).toBeVisible();
    await openYard(page);
    // The tower still stands and the walls card opens by itself (its title carries the goal, so the strip steps aside).
    await expect(page.getByRole("dialog", { name: "Knock on the walls. Which walls?" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("dialog", { name: "Sal's counter (practice)" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    // B walks back out to the courtyard, like every other place.
    await page.keyboard.press("b");
    await expect(page).toHaveURL((u) => u.search === "");
    await expect(page).toHaveTitle(/3D courtyard/);
    await problems.assertNone();
  });

  // #495: under reduced motion the tower does not shake; a plate says what the storm did instead. A reload into the storm
  // skips "Storm coming" (the price has already fallen) and opens the card straight away.
  test("storm under reduced motion says 'Prices fell 30%'; a reload into the storm opens its card at once", async ({ page }) => {
    test.setTimeout(180_000);
    const problems = watch(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Start at the price card: the earlier beats are played above. Seeded once, so the reload below keeps what was played.
    await page.addInitScript((key) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(key, JSON.stringify({ pages: [], finished: false, skipped: false, run: { beat: "price", picks: { company: "pip", walls: ["granite"], moat: ["recipe"] } } }));
    }, STARTER_KEY);
    await openYard(page);
    const price = page.getByRole("dialog", { name: "Worth about 10. Price 7. How much room?" });
    await expect(price).toBeVisible({ timeout: 30_000 });
    await expect(price.getByText("Worth 10, price 7. That gap is room to be wrong.")).toBeFocused();
    await page.keyboard.press("1"); // Lots of room
    await expect(page.getByTestId("starter-note")).toHaveText("Storm coming", { timeout: 30_000 });
    await expect(page.getByTestId("starter-note")).toHaveText("Prices fell 30%", { timeout: 10_000 });
    const storm = page.getByRole("dialog", { name: "Storm! Prices fell 30%. What changed?" });
    await expect(storm).toBeVisible({ timeout: 30_000 });

    await openYard(page);
    await expect(storm).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("starter-note")).toHaveCount(0);
    await problems.assertNone();
  });
});
