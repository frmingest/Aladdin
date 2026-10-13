# C1 Siege back-test and the "not modelled" headline — 2026-10-13

Status: **written on branch `feature/c1-siege-backtest`, PR to review, not merged, not deployed, not seen on Faiz's real data.**

## What it is for, in plain words

The Siege Simulator tells you what a market fall would do to your book. Until now nobody had checked whether that kind of answer was ever right. This sprint does two things:

1. **Looks back.** It takes the worst fall of OSEBX inside the two years of prices the app has stored, asks "what would the page have said for each of your holdings?", and puts that beside what each holding really did. Then it replays today's weights through the same two years to show the book's own worst fall and how long it stayed below an earlier high.
2. **Stops the headline hiding a gap.** The review (finding 3) found the page could say "the walls hold" about a book it had only half measured. The headline now says how much of the book's value was left out.

Nothing here predicts anything and nothing says what to do with money.

## What changed

- **`siege_scenarios_v3.py`** (new, active by default): v2 unchanged except the result now carries `unmodelled_share`, `unmodelled_count` and a sentence ("40.0% of the book's value (1 holding) is not modelled and is left out of this result; it could fall more or less."). The page headline appends it. Set `active_siege_scenarios_version` to `v2` to get the old behaviour. No migration.
- **`backtest_v1.py`** (new): the tolerances. A benchmark fall under 10% is marked small; within 5 percentage points counts as "close"; the book replay needs at least 2 testable holdings.
- **`GET /game/siege/backtest`** (new, read-only, database only; demo mode answers "no stored history"). Code: `services/game/backtest.py` (pure maths), `backtest_view.py` (reads stored prices, converts to NOK, no provider call).
- **Siege page:** a new card "Looking back: would the page have been right?" under the towers: a bar per tower (what it really lost) with a tick (what the page would have said), the gap in words, the not-tested list with reasons, and the replayed book.

## How the check is kept honest

- **The beta is measured without the fall being checked** (`estimate_downside_beta(..., exclude=...)`). If there are too few other falling days, it falls back to all days and the row says the check is easier to pass than it should be.
- **Not tested, never guessed:** no stored prices, prices that start after the fall began, or too little history. Each row says why. Vendor-beta-only holdings cannot be tested (they have no prices to compare).
- **The book replay is a backcast:** today's weights held constant, no buying, selling or costs, only the testable holdings (the card says how much of the value they carry).
- **One episode is a small sample.** The card says so; a fall under 10% is marked as mostly noise.

## Verified

Backend: ruff clean (apart from a file-permission rule that only fires on the Windows-mounted checkout), full `pytest`, new unit tests `test_game_backtest.py` and v3 cases in `test_game_siege.py`, API tests `test_game_siege_backtest_api.py`. Frontend: `tsc`, ESLint, vitest (new `siegeBacktest.test.ts`, v3 headline cases in `siege.test.ts`). **Not run in a browser, not run against the real database.**

## For Faiz after merge and deploy

1. Open Fortress → Siege Simulator. The headline should now name any share of the book that is not modelled.
2. Scroll to "Looking back". Check the fall it found (dates and size) looks like the real worst OSEBX fall in the last two years. If a holding is listed "not tested" that you expected to see, the reason is on its row (usually no stored prices yet: the worker fetches them).
3. Tell me which rows "fell more than the page said" and whether that surprises you. That is the whole point of the check.

## Not built

The range headline and the offsets-as-fog from the contest's L2 idea; a global benchmark option (open question in PROGRESS); several falls instead of one.
