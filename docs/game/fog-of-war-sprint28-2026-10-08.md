# Game mode Sprint 28: fog of war (G34–G37) — 2026-10-08

Branch `feature/fog-of-war-sprint28`. **Written and tested, not merged, not deployed, never seen in a browser.** Frontend only: no
backend, schema, migration or prompt change. Decision D1 (reward knowing, never trading) is the rule behind all four pieces.

## What was built

- **G34 Survey level (`lib/survey.ts`, rules `survey-v1`).** Five plain facts per tower, each clear, in fog, or not judged:
  1. *Latest report opened* — the newest annual, quarterly or half-year report on file has been opened on this browser
     ("opened, not understood", the Scrolls library's per-browser flag, D4). Demo data: not judged. A document list that could not be read is fog, never clear.
  2. *Analysis fresh* — freshness is `fresh`. Weathered, old or missing is fog, so **fog comes back when an analysis ages**. Funds/gold: not judged.
  3. *Invalidation written* — a journal decision for this holding says what would prove it wrong.
  4. *Circle marked* — the sector is marked inside / edge / outside. Unmarked or no sector set is fog; funds and gold are not judged.
  5. *Valuation available* — the land is not fog. Funds/gold: not judged.
  It is a checklist ("3 of 5 surveyed"), not a score, and never reads a verdict, so a clear tower is understood, not good.
- **G35 Cartographer's table (`/fortress/map`, new "Map" tab).** One card of towers with a fog bar and the five facts each, then
  **Commissions**: the same fog grouped by what would clear it (open the report, refresh the analysis, write an invalidation, mark the
  sector, find the valuation, enter cash), the one covering the most portfolio weight first. Each ends at an existing page. No streak, no reward for finishing.
- **G36 Codex (Glossary page, game mode only).** Nine glossary terms (margin of safety, bear/base/bull, DCF, verdict, tripwire,
  correlation, concentration cluster, stress scenario, macro regime) show as plates once they appear on your own realm; the rest show
  when they will appear. Text is the glossary's own. Remembered per browser (guarded `localStorage`).
- **G37 Time capsules (Hall of Records).** The 6- and 12-month reviews read as seals: *sealed until it is due*, *unsealed, review owed*,
  *opened, review written*. Presentation over the review state the backend already decides; nothing graded.

## Rules kept

Read-only; nothing stored; no points, streaks, timers or rewards; no buy/sell wording (tests on all new text); unknown stays unknown;
per-browser state says so on the page. Thresholds: none new.

## Verified (2026-10-08)

tsc clean; ESLint 0 errors (the 2 existing warnings); **384 frontend tests** (19 new: survey 11, codex 6, capsules 2); production build. No backend change, so the backend suite was not re-run.
**Not seen in a browser**, not tried with real documents. The Map page makes one `GET /documents` call per tower on load.

## Look-and-judge checklist for Faiz

1. Fortress → **Map**: do the fog bars and five lines per tower read at a glance? Is the commission order (heaviest weight first) useful?
2. Open a latest report from a holding's Scrolls tab, return to Map: does that tower's first fact clear?
3. Glossary in game mode: do the plates match what is on your realm?
4. Records: do the seals read clearly, with nothing that sounds like a grade?

## Not done / open

- Fog only counts "opened" per browser, so it differs between devices (D4).
- The report check ignores which reporting period is newest *relevant*; it uses Newsweb's publish date, else upload time.
- No game page is in the read-only smoke test yet (Sprint 26a leftover); the new Map page should join it.
- Ravens cleanup (scope to confirm) is still open.

## After deploy

Nothing to run. Reload the frontend and open Fortress → Map.
