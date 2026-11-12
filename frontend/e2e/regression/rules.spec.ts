import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { E2E_API } from "../support/api";
import { watch } from "../support/guard";

/**
 * Rules as tests (contract tests). Each one guards a promise written in CLAUDE.md that an ordinary feature test would
 * never notice breaking. Backend rules (deterministic arithmetic, versioned prompts, the blind pass) are held by pytest
 * in backend/tests; this file holds the ones only a running app and a browser can show.
 */

test.describe("demo mode keeps the test stack safe", () => {
  // CLAUDE.md, "Destructive operations": nothing deletes without confirm=true, and nothing writes while demo mode is on.
  // The demo guard runs first in every mutating endpoint, so these answer 403 with or without confirm. The absence of
  // 403 on any of them would mean this suite could change data on a stack that is meant to be read-only.
  const NIL = "00000000-0000-4000-8000-000000000000";
  const WRITES: { method: "DELETE" | "POST"; path: string }[] = [
    { method: "DELETE", path: `/accounts/${NIL}?confirm=true` },
    { method: "DELETE", path: `/holdings/${NIL}?confirm=true` },
    { method: "DELETE", path: `/journal/${NIL}?confirm=true` },
    { method: "DELETE", path: `/thesis/tripwires/${NIL}?confirm=true` },
    { method: "DELETE", path: `/watchlist/${NIL}?confirm=true` },
    { method: "DELETE", path: `/holdings/${NIL}` },
  ];
  for (const { method, path } of WRITES) {
    test(`${method} ${path.split("?")[0].replace(NIL, "{id}")}${path.includes("confirm") ? "" : " (no confirm)"} is refused with 403`, async ({ request }) => {
      const res = await request.fetch(`${E2E_API}${path}`, { method });
      expect(res.status()).toBe(403);
    });
  }

  test("the game state says it is demo data", async ({ request }) => {
    const res = await request.get(`${E2E_API}/game/state`);
    expect(res.status()).toBe(200);
    expect((await res.json()).demo).toBe(true);
  });
});

test.describe("the read-only smoke suite stays read-only", () => {
  // CLAUDE.md, "Guardrail tooling": smoke tests run against the live site with Faiz's real data. They must abort every
  // non-GET request and send none of their own. This reads the source of each file, so a careless edit fails in CI before
  // the next daily run could write to production.
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const SMOKE_FILES = ["smoke.spec.ts", "game-pages.spec.ts", "game3d.spec.ts"];
  for (const file of SMOKE_FILES) {
    test(`${file}: aborts non-GET requests and never writes`, () => {
      const src = readFileSync(join(dir, file), "utf8");
      expect(src, "aborts non-GET requests").toMatch(/method\(\) (!==|===) "GET"/);
      expect(src, "calls route.abort()").toMatch(/route\.abort\(\)/);
      expect(src, "sends no write of its own").not.toMatch(/request\.(post|put|patch|delete)\(|method:\s*"(POST|PUT|PATCH|DELETE)"/i);
    });
  }
  // game-errors.spec.ts answers every data request itself with a failure and never reaches a backend, so it needs no abort.
  test("game-errors.spec.ts answers every data request itself", () => {
    const src = readFileSync(join(dir, "game-errors.spec.ts"), "utf8");
    // Every fetch/XHR is fulfilled or aborted; only page files, scripts and styles may continue to the dev server.
    expect(src).toMatch(/route\.fulfill\(/);
    expect(src).toMatch(/route\.abort\(/);
    expect(src).toMatch(/type !== "fetch" && type !== "xhr"/);
  });
});

test.describe("pages", () => {
  // Pages of the normal app that read real data in production. In demo mode they must load, say so, and stay quiet.
  const PAGES: { path: string; heading: RegExp }[] = [
    { path: "/", heading: /./ },
    { path: "/holdings", heading: /Holdings/ },
    { path: "/margin-of-safety", heading: /Margin of safety/ },
    { path: "/thesis", heading: /Thesis/ },
    { path: "/risk", heading: /risk/i },
    { path: "/performance", heading: /Performance/ },
    { path: "/watchlist", heading: /Watchlist/ },
    { path: "/journal", heading: /journal/i },
    { path: "/status", heading: /System status/ },
    { path: "/analysis-queue", heading: /queue/i },
  ];

  for (const { path, heading } of PAGES) {
    test(`${path} loads in demo mode, says so and logs nothing`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).filter({ hasText: heading }).first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/^Loading…$/)).toHaveCount(0);
      await expect(page.getByText(/DEMO MODE/)).toBeVisible();
      await problems.assertNone();
    });
  }

  test("a holding page never shows evidence IDs (EV-001) to the reader", async ({ page, request }) => {
    // Evidence IDs are for the code and the citations behind the scenes (CLAUDE.md rule 2). The noise audit
    // (docs/features/ux-noise-audit-2026-10-06.md, 2.1) found them printed in the text. They are shown as links or not at all.
    const holdings = await (await request.get(`${E2E_API}/holdings`)).json();
    expect(holdings.length, "the demo fortress has holdings").toBeGreaterThan(0);
    const problems = watch(page);
    await page.goto(`/holdings/${holdings[0].id}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\bEV-\d{3}\b/);
    await problems.assertNone();
  });
});
