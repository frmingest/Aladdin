# Ravens: newest first, and Sprint 29 first slice (feel) — 2026-10-08

Branch `feature/ravens-recent-and-game-feel`, off `main` `7c27bfa`. **Written and tested, not merged, not deployed, never seen in a browser.** Frontend only: no schema, migration, rule-version or backend change.

## Why

The walkthrough found 177–183 unseen ravens: every Newsweb report captured in the last 45 days with no figures raises a text-only raven, so the overnight bulk fetch (302 reports) flooded the tab ([walkthrough, polish item 1](game-mode-walkthrough-g1-g20-2026-10-08.md)). Faiz asked for the newest items only, past 48 hours or so.

## Ravens (what changed)

- **The tab leads with the last 48 hours.** The cut-off uses the server's own `as_of` clock against each raven's `captured_at`, not the browser clock. The tab reads `Ravens · N new` (N = unseen ravens from the last 48 hours); with none it reads just `Ravens`.
- **Everything older is folded** under one line, *Earlier: N reports from M companies*. Inside, one fold per company (newest company first) with its reports; each report keeps *Read the report* and *Mark as seen*. Per-company *Mark as seen* and *Mark all earlier as seen*.
- **Filter:** All / Portfolio / Watchlist. Default is All, so nothing is hidden by default; it is per visit, not stored.
- **Buttons:** *Mark new as seen* acts on the recent ones only, so a bulk press never silently clears the folded ones.
- **Unchanged:** the 45-day window and raven rules in `time_and_filings_v1`, the stored ids and the per-browser "seen" list, the tower marks in the scene (still every unseen raven), and the Read-the-report button.
- Pure helpers `splitRavens`, `ravensTabLabel`, `groupSummary` in `lib/ravens.ts`; tests for the cut-off (exactly 48 h counts as recent), grouping, ordering, scope, seen, bad dates and a bad clock.

## Sprint 29, first slice (feel)

- **G41, pause when not watched.** The scene sets `data-paused` while the browser tab is hidden or the scene is scrolled out of view (`visibilitychange` plus `IntersectionObserver`); one CSS rule pauses every looping animation inside it. No effect on layout or data. Reduced-motion handling is unchanged. **Not measured:** no frame-rate or CPU figure was taken, so this is a mechanism, not a proven saving. Fewer filters on small screens and a phone frame budget are still open.
- **G42, arrow keys between towers.** With a tower focused: Left/Right step through reading order (row by row), Up/Down go to the nearest tower in the next row, Home/End jump to the first/last. Enter and Space still open the tower. Pure rule `nextTower` in `lib/sceneNav.ts`, tested. The tower's spoken label now ends with "Arrow keys move to the next tower." The screen-reader outline of the whole realm is **not built**.

## Verified

tsc clean; ESLint 0 errors (the 2 existing warnings); production build; new tests in `ravens.test.ts` and `sceneNav.test.ts`. Backend untouched, so its suite was not re-run. Not run in a browser.

## Look and judge (Faiz, after deploy)

1. Fortress → Ravens: does the tab count match what you expect, and is "Earlier" enough out of the way?
2. Is 48 hours the right cut-off? It is one constant (`RECENT_HOURS` in `lib/ravens.ts`).
3. Tab to a tower and use the arrow keys; check the focus ring follows.
4. Open the Fortress, switch to another browser tab and back: nothing should jump.

## Not built (next in Sprint 29)

G40 first-run tour, G38 sound set, phone filter budget, screen-reader realm outline; and from Sprint 26a, game pages in the post-deploy smoke test and word budgets.
