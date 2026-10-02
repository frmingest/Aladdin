# Page load: measurements and options (2026-09-30)

Follow-up to [page-load-performance-investigation-2026-09-28.md](page-load-performance-investigation-2026-09-28.md).
The 09-28 P0/P1 fixes are live, but the five pages are still slow. This time measured in the browser against the live app.

## 1. Measured (live, first load, one request each)

| Page | Slow request | Time |
|---|---|---|
| Portfolio risk | `GET /risk/portfolio` | **9.3 s** |
| Watchlist | `GET /watchlist` | **6.9 s** |
| Margin of safety | `GET /valuation/board` | **5.0 s** |
| Analysis queue | `GET /analysis/queue` | **3.3 s** |
| Performance | `GET /performance/portfolio?lookback_days=365` | **3.3 s** |
| (baseline) | `/health` 0.12 s, `/holdings/field-options` 0.22 s | — |

Every page also first waits for `/health` + `/settings/demo-mode` (0.5 s) before its data request. The bundle is not the problem: pages load their JS in well under a second.

## 2. Why (from the code)

1. **Risk and Performance still go live inside the GET.** `get_or_refresh_daily_history` (`services/risk/price_history.py`) calls Yahoo for every ticker, FX pair and benchmark whose stored history is older than 24 h, one after the other. The 09-28 fix covered research and valuation, not price history. Expect the first visit of each morning to be the slow one.
2. **Board and Watchlist do a full valuation per holding on every request.** Even from cache, each holding costs many DB round trips (multiples, price, FX, share count, rf, beta), sequentially. Watchlist items with no financials also fall through to a separate price lookup. Time scales with the number of holdings.
3. **Every DB round trip is expensive.** `create_engine(..., pool_pre_ping=True)` adds a `SELECT 1` per request, and Railway to Supabase is a network hop, so hundreds of small queries turn into seconds.
4. **Analysis queue (3.3 s)** is DB-only; not yet traced. Likely many small queries too.
5. Not yet proven which of 1-3 dominates for Board/Watchlist: no per-request timing exists on the server.

## 3. Options

| # | Option | Fixes | Effort | Trade-off |
|---|---|---|---|---|
| A | **Precomputed snapshots.** The PC worker (already runs overnight) stores each holding's valuation, risk payload and performance series; GETs just read the stored row. Refresh buttons still recompute. | All five; pages become ~0.3 s | Medium (new table + worker job + 4 read endpoints) | Data is as fresh as the last worker run (show "as of" on each page) |
| B | **Never fetch live in GET for price history** (same P1 pattern). Serve stored history, refresh via button or worker. | Risk, Performance | Small | Needs a Refresh button on those two pages |
| C | **Batch and parallelise the per-holding work.** Load all prices/FX/facts for all holdings in a few queries (like the `GET /holdings` N+1 fix), thread pool for the rest. | Board, Watchlist | Medium | Touches valuation code; needs care to keep numbers identical |
| D | **Server-Timing + query-count header** on every response (tiny middleware), shown in the browser Network tab. | Nothing directly; makes the next fix evidence-based | Small | None |
| E | **Client cache (react-query/SWR) + skip the demo-mode preflight** by caching it. | Repeat visits, the 0.5 s preflight | Small | Data can look a few seconds stale |
| F | **Co-locate**: check that Railway backend and Supabase are in the same region; drop `pool_pre_ping` or use pgbouncer. | Every page, a bit | Small (config) | Region move needs a DB migration if they differ |

## 4. Recommendation

Do **D + B + F-check** first (a day of work, low risk, and D tells us exactly what C needs), then **A** as the real fix. A also removes the dependence on Yahoo being reachable from Railway. C only if A is rejected.

Nothing in this document was built; it is a decision for Faiz.
