# C2 Hit rate (calibration ledger): sprint plan and art brief (2026-10-14)

Status: **written on `feature/c2-hit-rate`, PR open; not merged, not deployed.** See Result at the end. Source decision: `progress.md` Blockers, "Hit rate (C2), decided 2026-10-14: yes, with limits". This amends the Sprint 25 "no hit rate" rule for this view only.

## 1. What it is

A quiet ledger on the Hall of Records page, below the records. It answers two questions, with counts, never a score:

1. **Your calls:** of the decisions where you wrote a confidence (1 to 5) and a 6- or 12-month outcome exists, how many went the way you expected.
2. **The Oracle's range:** of the analyst runs old enough to judge, how many later prices landed below, inside or above its bear-to-bull range.

Visual verb + scene: **weigh, on a level scale beside a locked ledger.** Nothing tilts, lights up or fills.

## 2. Limits (from the decision, restated as acceptance tests)

- Shown only when **N >= 8** decisions have a 6- or 12-month outcome (threshold in versioned `calibration_v1.py`, not inline).
- The count is always printed beside any ratio: "5 of 8", never a bare percentage.
- Below 8: "Too few so far: 3 decisions have an outcome. This view opens at 8." No ratio, no per-band split.
- Per-confidence-band rows only for a band with >= 3 decisions; otherwise "too few".
- No score, streak, badge, reward, colour for good or bad, or "improving" arrow.
- Never changes a verdict, a tower, a temperament value or any other page.
- Deterministic application code does the counting; the LLM sees none of it (CLAUDE.md rule 1).
- Read-only API; demo mode uses demo data and never touches real rows.

## 3. Data

- **Your calls:** `DecisionJournalEntry.confidence` (int 1 to 5), `compute_outcome()` (`services/journal.py:83`, returns `return_6m_pct`, `return_12m_pct`, `in_favour`). VERIFY how `in_favour` treats a hold or a flat result before counting it.
- **Oracle range:** bear and bull targets on `EquityAnalysisRun` versus the first stored price on or after run date + 6 or 12 months. VERIFY the field names; most runs are under 3 weeks old, so this half stays "too few" for months.
- **Forecasts table (needs Faiz's approval, see section 7):** additive, append-only `forecasts` row written when a decision or an analysis run is saved, so the clock and the frozen range start now and a later edit cannot rewrite the past. Columns: `id`, `holding_id`, `source` (`user` or `oracle`), `made_on`, `confidence` null, `low` null, `high` null, `currency`, `horizon_months` (6 or 12), `entry_id` null, `run_id` null, `created_at`. Alembic migration in the same change. Legacy tables untouched.
- Backfill: existing journal entries and runs are counted from their own stored fields (no forecast row needed); the table only freezes future ones.

## 4. Art: the four pictures that arrived

Found in `frontend/public/art/` (git-ignored, **not** the shipped location). All four are single props on white, teal-and-brass Stitch style, the same family as the room objects.

| Picture (folder prefix) | Packed id (proposed) | Where it sits | Notes |
|---|---|---|---|
| Closed record book with brass clasp on a trestle lectern | `ledger-book` | Centrepiece of the ledger panel and the empty ("opens at 8") state | The locked clasp reads as "not open yet". It is decoration only: the words carry the state. No open-book picture is needed or wanted |
| Plain brass balance scale, level | `ledger-scale` | Header of the Oracle-range half | **Always level.** A tilt would encode a result; if a tilt is ever wanted it must be SVG |
| Small brass lantern, unlit, candle white | `ledger-lantern` | Beside the "too few so far" line | Unlit is the only variant. A lit lantern would be a reward, so none is requested |
| Surveyor's staff with cord reel and brass plumb bob | `ledger-staff` | Header of "your calls" half (measuring against what you expected) | Reads as a measuring tool, not a trophy |

Pack rules (`docs/GRAPHICS_GUIDELINES.md`): copy each master into `art-masters/Design_master/` (git-ignored), add four entries to `scripts/art/manifest.json` (key mode `white`, `max_side` 384 is enough, about 20 to 30 KB each), run `python scripts/art/pack.py --only ...`, commit the WebPs and regenerated `artManifest.ts`. The set stood at about 2,000 KB of 2,800 KB before this; four pictures fit. **Never commit anything under `public/art/`.** Alt text empty; only drawn when the Settings "Object art" switch is on; SVG or plain panel is the fallback.

**No new Stitch pictures are needed for C2.** No new room crest or backdrop either: the ledger lives on the Records page, and backdrops are at the budget maximum of five.

## 5. Page identity (game-visual-identity checklist)

- Page touched: Hall of Records (`RecordsPage.tsx`, new `kit/LedgerPanel.tsx`).
- Identity before / after: Records is already a game page; the ledger panel must score >= 2: scene header (book and scale on the lectern), shared kit (parchment panel, seal marks), one real fact encoded visually, Plain view.
- Fact encoded: for each of your calls, one seal on a row per confidence band (shape: filled = went as expected, hollow = went against, dashed = no outcome yet), plus the printed count. Shape and word, never colour alone.
- Plain view: the same rows as a labelled table.
- Phone: 360 px, no sideways scroll; seals are not the only carrier (counts are text).
- Reduced motion: nothing animates.
- Word budget: the panel adds at most about 60 words; check `lib/wordBudget.ts`.

## 6. Build order

1. Clean branch `feature/c2-hit-rate` off current `origin/main` (see section 7, first item).
2. Pack the four pictures and run `artAssets.test.ts`.
3. Backend: `calibration_v1.py`, `services/calibration.py` (pure counting), `GET /game/calibration`, schema, tests (gate at 7 versus 8, band under 3, flat result, currency mismatch, demo).
4. Migration for `forecasts` plus the writer hooks (only after approval).
5. Frontend: `lib/calibration.ts` (+ test), `LedgerPanel.tsx` (+ render test, art on and off), Records page wiring, e2e row.
6. Run what CI runs, open the PR, update `docs/PROGRESS.md` and the Claude project copy in the same PR.

## 7. Open before building

1. **Repo state:** `E:\Aladdin` is on a detached HEAD at `28db340`, behind `origin/main` (`072a4f4`), with 13 uncommitted files that are *older* versions of work already merged (B2 Then and Now, the prompt-log changes). Building on it would silently revert them. Needs a `git pull`/clean by Faiz, or a fresh clone.
2. **Approve the additive `forecasts` migration** (CLAUDE.md: no schema change without the migration in the same change; this adds only, drops nothing).
3. Confirm the Oracle half may ship as "too few so far" until enough runs age past 6 months.

## 8. Result (2026-10-14, written, not deployed)

- **Approved:** the additive `forecasts` migration (Faiz, 2026-10-14).
- **Built:** `domain/game_mapping/calibration_v1.py` (versioned limits), `services/game/calibration.py` (pure counting plus row gathering), `GET /game/calibration`, `models/forecast.py` and migration `w1e2f3a4b5c6`; journal create and confidence edits append a frozen row. Frontend: `lib/calibration.ts`, `kit/LedgerPanel.tsx`, shown on the Records page in both painted and plain views.
- **Deviation from section 3:** the `forecasts` table holds only the frozen user confidence (`entry_id`, `holding_id`, `source`, `confidence`, `made_at`). Analyst runs already store `price_target_low/high` and are never edited, so no Oracle rows are written. `source = "oracle"` is reserved.
- **Choices to know:** a hold has no direction and is left out; "flat" is exactly 0%; the longest horizon with a price is used once per decision; an analyst run takes the first stored price on or after its 6- or 12-month date, within 45 days, in the run's currency, otherwise it is still waiting. The analyst half counts every run, so repeated runs on one holding weigh more (not deduplicated).
- **Art:** the four pictures were packed as `ledger-book`, `ledger-scale`, `ledger-lantern`, `ledger-staff` (about 77 KB in all; set now 2,378 KB of 2,800). They were moved out of `frontend/public/art/` into the git-ignored `art-masters/_c2-drop-2026-10-14/` because `artAssets.test.ts` rightly rejects images over 150 KB in `public/`. Pictures show only with Settings "Object art" on.
- **Checks run:** backend `pytest` 1,923 passed (one unrelated CSV NUL-byte test fails on this machine's Python 3.10 and was deselected), `ruff` clean (EXE002 ignored: a mount artifact); frontend `tsc`, ESLint (0 errors), all vitest files, `vite build`. **Not run:** the migration up/down on Postgres (CI does it), the live page, `e2e/game-pages.spec.ts`, a phone check.
- **Not in this change:** an e2e row for the ledger, a Plain-view toggle of its own (the panel is already text first), a lit or tilted variant of any picture (by design).
