# Page load: root cause found and options (2026-10-03)

Third look at slow pages (the 09-28 investigation and 09-30 options write-ups, both removed 2026-10-04 and in git history, [09-30 snapshots](page-load-snapshots-2026-09-30.md), [Sprint 20](sprint20-speed-2026-10-03.md)). Read-only: no code changed. This time measured on the live app in the browser pane, using the `Server-Timing` header built on 09-30.

## 1. Root cause

**Every database query from the backend costs about 113 ms. A healthy setup is under 5 ms.** Page time is therefore roughly *(number of queries) × 113 ms*, whatever the page does.

| Live request (2026-10-03) | Queries | DB time | ms per query |
|---|---|---|---|
| `/performance/portfolio` (stored snapshot) | 3 | 545 ms | 182 |
| `/valuation/board` (stored snapshot) | 3 | 454 ms | 151 |
| `/holdings` | 4 | 455 ms | 114 |
| `/portfolio/overview` (Dashboard) | 7 | 1,421 ms | 203 |
| `/macro/indicators` (Macro page and Dashboard) | 27 | 2,834 ms | 105 |
| `/analysis/queue` | 29 | 3,270 ms | 113 |
| `/thesis/monitor` (Dashboard) | 48 | 5,429 ms | 113 |
| `/health` (no DB) | 0 | 0 | wall 150 ms from your PC |

Fit: DB time grows linearly with query count at ~113 ms per query, almost no fixed part. The Python code is not the cost: `total` minus `db` is under 250 ms on every request.

**Where the 15-20 s comes from.** 15-20 s equals ~130-180 queries. That is what a stored page costs when it has to be *rebuilt* (Risk was 9.3 s, Board 5 s, Watchlist 6.9 s on 09-30 before snapshots), and what the heaviest live pages cost. Today every stored page I opened was fresh and took 0.5-0.7 s, so the snapshots work; the rebuilds were not reproduced in this session.

**Why 113 ms.** Supabase is in AWS `eu-west-1` (Ireland), from the host name in `backend/.env`. A round trip that slow means the Railway backend is not in Europe (Railway's default region is US West; the Railway region setting was not visible from here, so this is an inference to confirm). Frankfurt/Amsterdam to Dublin would be 15-25 ms.

## 2. Why three rounds of fixes did not remove it

| Round | What it fixed | What it left |
|---|---|---|
| 09-28 | gzip, code-splitting, no live LLM in GETs | cost per query |
| 09-30 | snapshots, no live price fetch | cost per query; a stored read is still 3 queries = 0.5 s; rebuilds still do 100+ queries |
| Sprint 20 | no first-ever vendor calls, warm-up, stored beta, client cache | cost per query; Macro, Analysis queue, Thesis monitor are not snapshotted |

All three reduced *how many* queries or provider calls a page makes. None reduced the price of one query, which is the multiplier on everything. The Option F region check from 09-30 sat in a checklist for you and was never confirmed.

## 3. Options

| # | Option | Effect (estimate) | Effort | Trade-off |
|---|---|---|---|---|
| **A** | **Put the Railway backend in the same region as Supabase.** Railway → backend service → Settings → Region → EU West (Amsterdam), or the nearest to Ireland. Redeploy | Per query 113 → ~15-25 ms: **~5x on every page** (Thesis monitor 5.4 s → ~1 s; a 15 s rebuild → ~3 s) | Minutes, a setting, no code | Brief redeploy. If the backend already is in EU, this is not the cause and A does nothing: check first |
| **A2** | Move Supabase instead (new project in Railway's region) | Same as A | Large: DB migration, new keys | Only if A is impossible |
| **B** | **Drop `pool_pre_ping=True`** (`app/config/database.py`) once A is done, or set `pool_recycle` instead | Saves one round trip per connection checkout (~110 ms now, ~20 ms after A) | Tiny | A dead pooled connection can surface as one failed request before it is retried; `pool_recycle=300` covers it |
| **C** | **Cut round trips in the worst endpoints**: `/thesis/monitor` (48), `/analysis/queue` (29), `/macro/indicators` (27), Dashboard (7); batch with `IN (...)` / joined loads, as done for `GET /holdings` | Fewer queries → proportional gain, on top of A | Medium, per endpoint; needs identical output tests | Touches working code |
| **D** | **Snapshot those three as well** (same `computed_snapshots` pattern): Macro, Thesis monitor, Analysis queue summary | Each becomes ~3 queries | Medium | Analysis queue is live state; needs a short max age (e.g. 30 s) |
| **E** | **Fewer round trips from the browser**: drop the `/health` + `/settings/demo-mode` preflight (0.15 + 0.58 s before every page's first data call) by caching demo mode in the client and returning it with the first data response | ~0.7 s on every first page view | Small, frontend | Demo toggle must still invalidate it |
| **F** | **Rebuild snapshots as one batch**: load all prices/FX/facts for all holdings in a few queries, then compute in memory | A rebuild goes from 100+ queries to ~10 | Medium-large; valuation code, numbers must stay identical | Highest risk of the list; only worth it if rebuilds remain slow after A |

## 4. Recommendation

1. **A now (5 minutes, by you):** open Railway → backend service → Settings → Region. If it is not an EU region, change it to EU West and redeploy. Then reload the Dashboard and open the Network tab on `/thesis/monitor`: `Server-Timing` `db` should drop from ~5,400 ms to about 1,000 ms. If it does not move, the region is not the cause and I look at the Supabase pooler next.
2. **B + E** (small, safe) the same day.
3. **C + D** for Thesis monitor, Analysis queue and Macro only if they still feel slow after A.
4. **F** only if rebuilds still hurt after A.

If you change the region, tell me the old and new values and the new `Server-Timing` numbers, and I will record them here.

## 5. Not covered

- The 15-20 s pages themselves were not reproduced; today's stored pages were all fresh. Holding detail and a forced Risk/Board refresh were not measured.
- Railway's region could not be read from outside; the diagnosis rests on the 113 ms per-query figure and Supabase being in Ireland.

## 6. Outcome (2026-10-03, later the same day)

Faiz applied **option A** (Railway backend moved to the same region as Supabase). Result reported by Faiz: pages load a lot faster. **Decision: keep only this change for now.** Options B–F are parked, not planned; revisit only if a page still feels slow. New `Server-Timing` numbers were not recorded here; the per-query cost can be re-read from any request's Timing tab (healthy: under ~25 ms per query).
