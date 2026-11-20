import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { E2E_API } from "../support/api";
import { watch } from "../support/guard";

/**
 * Postcards (game3d roadmap, D1): one picture of every main place in /game3d, taken on the demo stack, so every 3D pull
 * request carries photos and the person judging looks at pictures instead of trusting "written, tested".
 *
 * The demo portfolio is the same fabricated one on every run, so two postcards of the same place differ only when the
 * code changed. CI draws with software WebGL (no GPU): colours and shadows are close, frame rate says nothing. A postcard
 * proves the place opens and shows what it should; whether it looks good is still a person's look.
 *
 * The files land in frontend/postcards/ (gitignored) and CI uploads that folder as the `postcards` artifact.
 */
const OUT = path.resolve(process.cwd(), "postcards");

/** The places, in the order a visitor meets them. The last one (a holding's own land) is added once the demo holdings are known. */
const PLACES: { file: string; at: string; title: RegExp; stand?: { x: number; z: number; yaw: number } }[] = [
  { file: "01-courtyard", at: "", title: /3D courtyard/ },
  { file: "02-town-hall", at: "townhall", title: /Town Hall/ },
  { file: "03-hall-of-records", at: "records", title: /Hall of Records/ },
  { file: "04-weather-tower", at: "weather", title: /Weather Tower/ },
  // The Siege Field stands on the south-west meadow (#466): the card is the courtyard with the hero placed just south of its entrance,
  // the camera turned to look up the field at the wall line (x, z and yaw are `fieldToWorld` of local (0, 22) and the plot's turn; see siegeFieldLogic.ts).
  { file: "05-siege-field", at: "", title: /3D courtyard/, stand: { x: -41.2, z: 39.8, yaw: 2.34 } },
  { file: "06-market-quarter", at: "quarter", title: /Market Quarter/ },
];

/** Let the models and textures stream in. Software WebGL is slow, so this is a pause, not a frame-rate check. */
async function settle(page: Page) {
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(4_000);
}

async function postcard(page: Page, file: string) {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${file}.png`) });
}

test.describe("postcards", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const { file, at, title, stand } of PLACES) {
    test(`${file}`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(at ? `/game3d?at=${at}` : "/game3d");
      await settle(page);
      await expect(page).toHaveTitle(title);
      if (stand) {
        // Development builds publish this (Scene.tsx). Wait out the short hover after a placement, then let the camp (it wakes within 50 units) stream in.
        await page.evaluate(([x, z, yaw]) => (window as unknown as { __g3dPlace: (a: number, b: number, c: number) => void }).__g3dPlace(x, z, yaw), [stand.x, stand.z, stand.yaw]);
        await page.waitForTimeout(3_500);
        await settle(page);
      }
      await postcard(page, file);
      await problems.assertNone();
    });
  }

  test("07-holding-land", async ({ page, request }) => {
    const problems = watch(page);
    const holdings = await (await request.get(`${E2E_API}/holdings`)).json();
    expect(holdings.length, "the demo fortress has holdings").toBeGreaterThan(0);
    await page.goto(`/game3d?at=holding:${holdings[0].id}`);
    await settle(page);
    await expect(page).toHaveURL(/at=holding/);
    await postcard(page, "07-holding-land");
    await problems.assertNone();
  });
});
