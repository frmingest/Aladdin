# Page-load fix: timing header, stored snapshots, no live price fetch in GET (2026-09-30)

Built from the recommendation in the 2026-09-30 page-load options write-up (removed 2026-10-04, in git history; its diagnosis was superseded by [the root cause](page-load-root-cause-2026-10-03.md))
(options D + B + A, plus the F region check as a checklist below).

## What changed

| Layer | Change | Effect |
|---|---|---|
| D — timing | `app/timing.py` middleware adds `Server-Timing: total;dur=…, db;dur=…;desc="N queries"` and `X-DB-Queries` to every response | In the browser Network tab, click a request → Timing: you see total ms, DB ms and query count. Answers "why is this slow" from evidence |
| B — no live fetch | `get_or_refresh_daily_history(serve_stale=True)`; Risk and Performance GETs pass it. A ticker with stored history is never fetched live in a GET; a never-fetched ticker still is (once) | Removes the Yahoo round trips that made Risk 9.3 s / Performance 3.3 s |
| A — snapshots | New table `computed_snapshots` (migration `o1a6b7c8d9e0`). Risk, Performance, Margin of safety and Watchlist GETs serve the stored JSON of the last build | One primary-key read instead of dozens of queries/provider calls |
| A — refresh | Each page's Refresh button rebuilds live and stores; new `POST /watchlist/refresh` + Refresh button on Watchlist; the PC worker rebuilds all four once per UTC day after 04:00 UTC | Snapshots stay current without anyone clicking |
| UI | "Updated 3 h ago" beside the Refresh button on the four pages | You can see how old the data is |

## When is a snapshot served vs rebuilt

Served while **both** hold: younger than `SNAPSHOT_MAX_AGE_HOURS` (36) **and** the inputs' *fingerprint* is unchanged. The fingerprint is one aggregate query over: portfolio snapshots (new import), holdings, watchlist entries (including buy-below prices), documents, finished analysis runs. Any change there rebuilds on the next visit.

**Not** in the fingerprint, on purpose: market prices. They move between refreshes; the nightly worker pass and the Refresh buttons re-price. So a page can show yesterday's price until you press Refresh (the "Updated … ago" label says so).

Any snapshot read/write problem falls back to building live, as before. Demo mode bypasses snapshots.

## Settings (all optional)

`SNAPSHOT_MAX_AGE_HOURS` (36), `SNAPSHOT_REFRESH_ENABLED` (true), `SNAPSHOT_REFRESH_HOUR_UTC` (4).

## Tests

12 new (`tests/unit/test_snapshots.py`): served from snapshot, refresh replaces, changed inputs / buy-below edit / expiry / unreadable payload rebuild, stale history served without a live call, never-fetched ticker still fetched, nightly job stores each page and survives one failing, once-per-day due logic, Server-Timing header counts queries. Existing risk / performance / watchlist / valuation API and unit suites pass; frontend tsc / eslint / vitest 19/19 clean; `alembic heads` = one head. `test_demo_mode_api` system-status tests hang in the cloud sandbox with or without this change (they probe the network) — not run.

## What is NOT done / caveats

- **Migration not run on Postgres** (additive table only). It runs on the next Railway deploy.
- **First visit after deploy is still slow once** (no snapshot yet), then fast. Press Refresh on each page, or wait for the worker's 04:00 UTC pass.
- **Analysis queue (3.3 s) is not snapshotted** — it is live state. Use the new `Server-Timing` header on `/analysis/queue` to see whether it is query count or DB latency, then fix that specifically.
- The 0.5 s `/health` + `/settings/demo-mode` pre-flight before every page's data request (option E) is untouched.
- Worker must be restarted to pick up the nightly rebuild; if it is offline, snapshots still refresh on the Refresh buttons and after 36 h on the next visit.

## Option F — region checklist (for Faiz, 2 minutes)

Every DB query is a network round trip; if Railway and Supabase are far apart, everything is slow.
1. Supabase → Project Settings → Infrastructure: note the region (e.g. `eu-north-1`, `eu-central-1`).
2. Railway → backend service → Settings → Region: should be the same continent, ideally the same region (Railway EU West = Amsterdam).
3. After deploy, open any page, Network tab → click the request → Timing. `db;dur` divided by the query count is your per-query latency. Under ~5 ms per query is healthy; 30–100 ms means a region/pooler problem.
4. If per-query latency is high: switch `DATABASE_URL` to Supabase's pooled (Supavisor, port 6543) connection string, and tell me — `pool_pre_ping=True` in `app/config/database.py` adds one extra round trip per request and can be turned off once the pooler is in place.
