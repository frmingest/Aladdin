# B2 Then and Now (2026-10-14)

Status: **written on `feature/b2-then-and-now` (stacked on `feature/game-mode-default-on`, PR #140), not merged, not deployed.** From the design-team review ([game-mode-team-review](game-mode-team-review-2026-10-09.md), item B2), the last item of its recommended order. Visual verb + scene: **turn back the page of the archive and read what the analyst said that day.**

## What it does

Open a record in the Hall of Records and press **Then and now**. It shows what the analyst believed on the day you wrote the decision next to what it believes now. Only lines that changed are shown; the rest are counted ("3 other lines say the same as then"). It works in the painted Hall (on the open desk) and in the Plain view (under each record card).

Compared lines: verdict, moat, the price range from the stored valuation, thesis points, top risks, and what would prove it wrong.

## Rules it keeps

- **Blind pass only, on both sides.** The reconciliation pass saw your notes, so comparing it would let your own thesis colour "what the analyst thought". The screen says so ("before it saw your notes"). Nothing about the blind pass changed (CLAUDE.md Rule 4).
- **No hindsight.** "Then" is the analysis in force on the decision date (`run_in_force`, the same rule that sets `verdict_at_decision`), never a later one.
- **No judgement.** No arrows, colours or words such as better, worse or improved. A change is only a change.
- **Wording is not meaning.** Risk and trigger lists are free text that the model words differently every run. They are compared as sets of lines (case and spacing ignored); when they differ, both lists are shown side by side with a note, and the app never claims two differently worded lines mean the same or different things.
- **Unknown stays unknown.** Five statuses instead of an empty comparison: no analysis on the day, no analysis yet, the same run on both sides (not re-run since), holding removed, demo data.
- **Read-only.** No new table, no migration, no LLM or provider call. The comparison is computed from `equity_analysis_runs` when you press the button.

## Files

Backend: `app/services/then_and_now.py`, `GET /journal/{entry_id}/then-and-now` in `app/api/journal.py`, schemas in `app/schemas/journal.py`. Tests: `tests/unit/test_then_and_now.py` (9) and one integration test in `tests/integration/test_journal_api.py`.
Frontend: `components/ThenAndNow.tsx` (+ test), wired into `pages/RecordsPage.tsx` and `components/fortress/kit/HallOfRecords.tsx`; types and `api.getThenAndNow`.

## How to check it (Faiz, after deploy)

1. Hall of Records, open a record that has a holding, press **Then and now**.
2. A record with only one analysis since the decision says the analysis has not been re-run.
3. After you re-run an analysis for that holding, the same record lists what changed (verdict, price range, risks, and so on).
4. Plain view shows the same under each card; demo data shows nothing.

## Not verified

Checked with ruff, pytest, tsc, lint, vitest and the build only. The screen was not rendered in a browser, so the look on the painted desk and on a phone is unseen. Your data is young (one journal decision, analyses mostly under a few weeks old), so most records will say "same run" or "nothing has changed" for now; that is the honest reading.

## Not built

A wording-aware diff of risk lists, a comparison of any two runs (only decision date versus latest), a timeline of every run for one record (the holding page already has the verdict timeline).
