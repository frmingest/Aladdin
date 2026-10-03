# Sprint 20: speed (2026-10-03)

Branch `feature/sprint-20-speed`, built in its own worktree off `main` `d7e9f0f` (Sprint 19 / PR #42 already merged).
Backend plus frontend. **No migration.** Written and tested; **not merged, not deployed, not run on your real data.**

## What changed

| # | Item | Result |
|---|---|---|
| 1 | **A page load never makes a first-ever vendor call** | Price, FX, risk-free rate, share count, beta and research used to be fetched live inside the first GET when nothing was stored (the "one-time cold-start cost"). Now a GET serves what is stored, marks it old when stale, and says *"not fetched yet"* when there is nothing. Research says *"no research stored yet, press Refresh or queue an analysis"*, which also means merely opening a page no longer spends Gemini/Tavily quota. The **analysis run is the exception** (its evidence step may fetch what is missing), via one scoped switch, `cold_fetch_allowed()` |
| 2 | **Warm-up: the first fetch happens off the request** | New `POST /holdings/{id}/warm-up` fetches whatever is missing or stale (price, FX to NOK, risk-free rate for the trading and reporting currency, share count, beta). Idempotent: a second press costs nothing. The Watchlist page calls it right after you add a company. The **PC worker** also warms up to 3 holdings per idle pass that have no price at all (owned or watched), and waits an hour before retrying one that failed. Research is deliberately not warmed (quota) |
| 3 | **Beta is stored in the database** | Price, FX and rates already were; beta lived only in Yahoo's in-process cache, so every deploy emptied it. Now stored under `beta:<TICKER>` in the existing `computed_snapshots` table (**no migration**), fresh for 7 days (`BETA_STALE_AFTER_HOURS`). A GET serves it; Refresh and the worker call Yahoo. A failed refresh keeps and returns the stored value |
| 4 | **The worker keeps the stored pages warm** | Besides the nightly rebuild, when the analysis queue is idle the worker rebuilds any of Risk, Performance, Margin of safety and Watchlist whose inputs changed (an import, a finished analysis, a watchlist change, a new price after warm-up). At most once per 5 minutes, never forces a vendor refresh, one failing page does not block the others. The fingerprint is read before building, so a change during a build is not passed off as current. Result: the visit after you queue a night of analyses is a stored read, not a 3-9 s build |
| 5 | **Client cache in the browser** | New `lib/queryCache.ts` (stale-while-revalidate, memory only, **no new dependency**: the plan said react-query, but five rules did not need a library and the production dependency audit stays clean). Data younger than 15 s is not re-fetched; older data shows at once and refreshes in the background; one request per key; **any write clears everything** (`api.ts`), and switching demo mode drops all cached data first. Used by Dashboard (overview, macro strip, thesis monitor), Risk, Performance (per look-back), Margin of safety and Watchlist |

## Behaviour you will notice

| Where | Before | Now |
|---|---|---|
| Add a company on the Watchlist | Price appeared because the page load fetched it | Same result: the add triggers the warm-up. If Yahoo is unreachable the row says *not fetched yet* until the worker or **Refresh prices** gets it |
| Open a holding page never fetched | Waited on Yahoo | Opens at once, multiples say *not fetched yet* |
| Company / sector / macro research, first visit | Fetched silently (spent quota) | Says *press Refresh*; an analysis run still fetches it |
| Leave a page and come back | "Loading…" again | Last data at once, re-checked in the background |
| Analysis run on a brand-new holding | Fetched price etc. | Unchanged (it opts in to cold fetches) |

## Deliberately not in this sprint

| Item | Why |
|---|---|
| Forced Margin-of-safety refresh still revalues holdings one by one | A Refresh press is an explicit "do it now"; parallelising needs care with the shared session and Yahoo rate limits. Backlog |
| Precomputing the board "in the worker" beyond keep-warm | Keep-warm already rebuilds it whenever inputs change plus nightly; a separate precompute would duplicate it |
| Research warm-up | Spends external quota; stays an explicit action |

## Verification

- Backend: **1,407 tests pass** (25 new in `tests/unit/test_sprint20_speed.py`; 6 in `test_valuation_api` / `test_holding_metrics_api` / `test_watchlist_api`; research API tests rewritten to the new contract), Ruff clean.
- 35 existing tests encoded "the first GET fetches". Valuation unit tests now run inside `cold_fetch_allowed()` (they model an analysis run); the integration tests warm up first, and new tests pin the opposite rule (a GET makes zero vendor calls).
- Frontend: tsc clean, ESLint 0 errors, **208 tests** (11 new for the cache), build OK.
- **Not tested:** a real browser, the real worker on your PC, Yahoo, Supabase. The cache hook (`useCachedQuery`) is covered through its store functions, not rendered.

## After deploy: what you need to do

1. `git pull` in `E:\Aladdin`, restart backend **and worker** (the worker now warms holdings and keeps pages warm).
2. Add a company on the Watchlist: the price should be there when the row appears.
3. Press **Refresh** once on Risk, Margin of safety, Watchlist; then leave and come back: the page should appear at once.
4. Optional settings (defaults are fine): `SNAPSHOT_KEEPWARM_ENABLED`, `SNAPSHOT_KEEPWARM_MIN_INTERVAL_SECONDS`, `WARMUP_RETRY_SECONDS`, `BETA_STALE_AFTER_HOURS`.
