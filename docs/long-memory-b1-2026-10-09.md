# B1 Long Memory — 2026-10-09

Branch `feature/long-memory-b1`. Written and tested, **not merged, not deployed, never seen in a browser.** First slice of the next game-design phase, taken from the [team review](game-mode-team-review-2026-10-09.md) recommended order (items 1, 2 and 5 shipped in #84; B1 is step 2).

## Why

Stored Fortress frames cannot be rebuilt: yesterday's walls, moats and weather are gone once overwritten. The worker kept every daily frame for 540 days and then deleted them, and the Chronicle silently showed nothing for days the worker was off. Every time-based feature (Chronicle, Ravens, Night Watch, Then and Now) is only as good as this record.

## What changed

- **`retention_v1`** (`backend/app/domain/game_mapping/retention_v1.py`, versioned file, Rule 3): every daily frame for 90 days; then the latest frame of each ISO week up to 2 years; then the latest frame of each calendar month for ever. Pure and idempotent: pruning twice keeps what pruning once kept. The newest frame and any future-dated frame always survive.
- **`history.prune`** now thins by that rule instead of deleting everything past 540 days. `run_if_due` drops its `keep_days` argument; `GAME_STATE_HISTORY_KEEP_DAYS` is accepted but no longer used.
- **Gaps are named.** `ChronicleOut.gaps` lists runs of recent days (inside the 90-day window, after the first stored frame, never today) with no stored frame: *"Nothing was recorded on … the worker was off. Nothing is known about those days, not even that they were calm."* Thinned old days are not reported as gaps; a note says old frames are kept one per week then one per month, so a change between two of them is dated at the later frame.
- **Chronicle page** lists gaps first under "What the record cannot show" (`recordLimits` in `lib/chronicle.ts`).
- No migration: frames still live in `computed_snapshots`. `time_and_filings_v1` is untouched.

## Effect on existing data

None today. The database was wiped on 2026-09-21 and the first stored frame is from 2026-10-07, so nothing is older than 90 days; the first thinning would happen in January 2027. The new rule keeps strictly more history than the old one for anything older than 540 days, and thins only the 90–540 day band.

## Verified

Backend: `ruff check`, full pytest (1,787 passed, 2 skipped; new `tests/unit/test_game_retention.py`, rewritten prune test with fixed dates). Frontend: `tsc --noEmit`, `npm run lint` (0 errors, 2 existing warnings), `npm test` (405), `npm run build`.

## For Faiz after deploy

Open Fortress → Chronicle. If the worker was off on any day since 2026-10-07 you should see it under "What the record cannot show". Nothing else changes visually.

## Next in the recommended order

A1 Knife-edge (distance to the next wall tier), C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now.
