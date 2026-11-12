import { expect, type Page } from "@playwright/test";
import { E2E_API } from "./api";

/**
 * What every regression test watches for, on top of what it checks itself:
 * - an uncaught page error (a crashed component);
 * - an API 5xx from the backend (a server fault; 503 "provider not configured" is not a fault here);
 * - a console error that is not on the allow-list below.
 *
 * Call `watch(page)` first, `await problems.assertNone()` last.
 */

/**
 * Console errors that are known and not ours to fix in this suite. Each entry says why. Keep it short: an entry that
 * hides a real problem is worse than a red test.
 */
const KNOWN_CONSOLE_NOISE: { match: RegExp; why: string; url?: RegExp }[] = [
  {
    match: /Failed to load resource: the server responded with a status of 403/,
    url: /\/sources\/holdings\/[0-9a-f-]+$/,
    why: "FINDING F-1: GET /sources/holdings/{id} is a read-only hint endpoint but calls require_not_demo, so in demo mode the Sources panel on every holding page gets a 403. Remove the guard from that GET (backend/app/api/sources.py, get_eligibility), then delete this entry.",
  },
  {
    match: /THREE\.BufferGeometryUtils: \.merge(Attributes|Geometries)\(\) failed/,
    why: "Courtyard asset merge warning, logged on every load of /game3d with the CC0 models. Visible in the console, nothing missing on screen. Tracked in docs/ops/test-strategy-2026-11-12.md (known findings).",
  },
  {
    match: /Failed to load resource: net::ERR_(BLOCKED_BY_CLIENT|NAME_NOT_RESOLVED|CONNECTION_REFUSED|INTERNET_DISCONNECTED)/,
    why: "Outside requests (web fonts) are not reachable from the CI runner or the sandbox. The app falls back to local fonts.",
  },
];

export interface Problems {
  list: string[];
  assertNone(): Promise<void>;
}

export function watch(page: Page): Problems {
  const list: string[] = [];
  page.on("pageerror", (e) => list.push(`uncaught: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const from = m.location().url;
    if (KNOWN_CONSOLE_NOISE.some((k) => k.match.test(text) && (!k.url || k.url.test(from)))) return;
    list.push(`console.error: ${text.slice(0, 200)}`);
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 500 && status !== 503 && res.url().startsWith(E2E_API)) list.push(`${status} ${res.request().method()} ${res.url()}`);
  });
  return {
    list,
    async assertNone() {
      expect(list, "no page errors, console errors or API 5xx").toEqual([]);
    },
  };
}
