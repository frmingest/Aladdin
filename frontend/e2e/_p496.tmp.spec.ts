import { expect, test, type Page } from "@playwright/test";
const S = "/tmp/claude-1000/-home-faizrm--claude-spares-spare-heUKNl/dcea437a-1ddf-4de3-bc3b-180035f9941c/scratchpad/play496";
let keys = 0;
async function press(page: Page, k: string) { keys++; await page.keyboard.press(k); }
async function key(page: Page, dialog: string, line: string, ks: string[]) {
  const d = page.getByRole("dialog", { name: dialog });
  await expect(d).toBeVisible({ timeout: 60_000 });
  await expect(d.getByText(line)).toBeFocused();
  for (const k of ks) { await press(page, k); await page.waitForTimeout(550); }
  await expect(d).toHaveCount(0);
}
async function checks(page: Page, second: boolean, tag: string) {
  await key(page, "Knock on the walls. Which walls?", "Strong walls: it makes money and owes little.", ["2"]);
  await key(page, "What stops others copying Pip's?", "A moat is what stops others copying it.", ["3"]);
  await key(page, "Worth about 10. Price 7. How much room?", "Worth 10, price 7. That gap is room to be wrong.", ["1"]);
  if (second) {
    await expect(page.getByTestId("starter-note")).toHaveText("The fridge broke. Pip's borrowed 10 coins.", { timeout: 60_000 });
    const storm = page.getByRole("dialog", { name: "Storm! Prices fell 30%. What changed?" });
    await expect(storm).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: `${S}/${tag}-storm2.png` });
    await press(page, "3");
    await expect(storm).toContainText("Owes 15 now. Look again.");
    await page.waitForTimeout(550);
    await press(page, "2");
    await expect(page.getByRole("region", { name: "Storms", exact: true })).toContainText("It owes more now. The walls cracked.");
    await page.screenshot({ path: `${S}/${tag}-storm2-result.png` });
  } else {
    await key(page, "Storm! Prices fell 30%. What changed?", "Look at the cards, then the price.", ["3"]);
    await page.screenshot({ path: `${S}/${tag}-storm1-result.png` });
  }
}
async function why(page: Page, tag: string, second: boolean) {
  const row1 = page.getByRole("dialog", { name: "Why I own it" });
  await expect(row1).toBeVisible({ timeout: 60_000 });
  await expect(row1.getByText("Write why you own it, and what proves you wrong.")).toBeFocused();
  await page.screenshot({ path: `${S}/${tag}-why1.png` });
  keys = 0; // count from the end of the storm
  await press(page, "2");
  const row2 = page.getByRole("dialog", { name: "I'm wrong if" });
  await expect(row2).toBeVisible();
  await page.waitForTimeout(300);
  await press(page, "3");
  await expect(row2).toHaveCount(0);
}

for (const rm of ["no-preference", "reduce"] as const) test("guard+cheer " + rm, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: rm });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const w = window as any; w.__log = [];
    const t = () => Math.round(performance.now());
    document.addEventListener("keydown", (e) => { if (e.key === "Enter") setTimeout(() => w.__log.push(["enter", t(), e.defaultPrevented]), 0); });
    new MutationObserver(() => {
      const end = document.querySelector('[data-testid="starter-end"]');
      if (end && !w.__endAt) { w.__endAt = t(); w.__log.push(["end-shown", w.__endAt]); }
      const pin = document.body.innerText.includes("Pinned on the door");
      if (pin && !w.__pinAt) { w.__pinAt = t(); w.__log.push(["pinned", w.__pinAt]); }
      if (!document.querySelector('[data-testid="starter-end"]') && w.__endAt && !w.__endGone) { w.__endGone = t(); w.__log.push(["end-gone", w.__endGone]); }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
  await page.route("**/api/**", (r) => r.request().url().includes("/settings/demo-mode") ? r.fulfill({ json: { demo_mode: false } }) : r.fulfill({ status: 503, json: { detail: "stub" } }));
  await page.goto("/game3d?at=practice");
  await expect(page.getByRole("dialog", { name: "Sal's counter (practice)" })).toBeVisible({ timeout: 120_000 });
  await press(page, "1");
  await checks(page, false, "g" + rm);
  const row1 = page.getByRole("dialog", { name: "Why I own it" });
  await expect(row1).toBeVisible({ timeout: 60_000 });
  await press(page, "2");
  await expect(page.getByRole("dialog", { name: "I'm wrong if" })).toBeVisible();
  await page.waitForTimeout(300);
  await page.keyboard.press("3");
  // spam Enter every 50ms for 8s
  for (let i = 0; i < 160; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(40); const g = await page.evaluate(() => (window as any).__endGone); if (g) break; }
  console.log(rm, "SUMMARY", JSON.stringify(await page.evaluate(() => { const l = (window as any).__log as any[]; const ev = l.filter((x) => x[0] !== "enter"); const s = ev.find((x) => x[0] === "end-shown")?.[1] ?? 0; return { ev, enters: l.filter((x) => x[0] === "enter" && x[1] - s > -1000 && x[1] - s < 3000).map((x) => [x[1] - s, x[2]]) }; })));
  await ctx.close();
});
