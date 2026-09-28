# Page load performance investigation (2026-09-28)

Faiz reported that page load times across the app are generally long, on all pages, and asked for
an investigation and fix proposals. Read-only investigation this session — no code changed.

## Method

Walked all 14 frontend routes (`frontend/src/App.tsx`) and their backend endpoints
(`backend/app/api/*.py`, `backend/app/services/*`), plus the build/deploy config
(`vite.config.ts`, `frontend/nginx.conf`, both Dockerfiles, `docker/backend-entrypoint.sh`). No
browser profiling was done this session (would need the live site open in a browser with dev
tools) — findings are from reading the actual request path each page takes, end to end.

## Bottom line

**The backend is the dominant cause, not the frontend.** Several `GET` endpoints that pages call on
every load are designed to transparently refresh from a live external provider (an LLM search call,
Yahoo Finance, a risk-free-rate feed) *inside the request* whenever the cached data has gone stale —
so a "slow page" is usually really "this page's GET happened to land on a stale cache and is now
waiting on an external API call before it can answer." The frontend has real but smaller issues
(one big JS bundle, no client-side cache) that were already flagged in `progress.md` §4 as the
795 kB bundle note.

## Findings, ranked by impact

### 1. Research GETs synchronously call an LLM when stale — Macro, Sector, Company research

`GET /research/macro`, `GET /research/sectors/{sector}`, `GET /research/holdings/{id}` (used by the
Macro page, Sector page, and the company-research panel on Holding Detail) all go through
`get_or_refresh()` in `app/services/research/common.py`: if the latest completed research run is
older than `RESEARCH_STALE_AFTER_HOURS`, the **GET itself** calls the configured `ResearchProvider`
(Gemini grounded search, now with a Tavily fallback per F23) and blocks until it returns, then
persists and serves the fresh result. An LLM-backed grounded search call routinely takes several
seconds to tens of seconds. Any time one of these three pages is opened after the staleness window
has passed, the page appears to hang for that long — this is very likely the single biggest
contributor to "Macro page is slow" / "opening a holding is slow" complaints.

This is intentional per the code's own comment ("no scheduler exists yet this sprint") — it's not a
bug, it's a placeholder architecture that trades page-load latency for not needing a background
job. The matching `POST .../refresh` endpoints already exist and do the same call explicitly.

### 2. Margin-of-Safety board computes a full valuation per holding, in one request, sequentially

`GET /valuation/board` (Margin of Safety page; a similar per-holding valuation path also feeds
Watchlist and Holding Detail) loops over every equity holding in `build_board()`
(`app/services/valuation/board.py`) and calls `compute_holding_valuation()` for each one in turn.
That function alone does, per holding: a multiples-over-time computation, a price fetch/refresh, an
FX fetch/refresh if the filing currency differs from trading currency, a share-count resolution
(manual → SEC → **live Yahoo Finance call** → filing fallback, each a DB round trip), a risk-free-
rate fetch/refresh, and a **live beta lookup** (`market_data_provider.get_beta()`). Even when every
sub-fetch hits its cache, that's still several DB round trips per holding, done one holding at a
time, not batched or parallelized — so wall-clock time scales roughly linearly with portfolio size.
When any of those caches happens to be stale for a holding, that holding's fetch adds a live Yahoo
Finance / FX-provider round trip on top.

Worth noting: the codebase already found and partially fixed one instance of this pattern — a
comment in `providers/yfinance_provider.py` explains that `get_beta()` used to be an uncached live
call on every valuation and was "fine for one holding, slow for the margin-of-safety board," so an
in-process TTL cache was added. That fix is real but incomplete: the cache is **in-memory**, so it's
empty again after every Railway redeploy/restart, and it only covers beta — price, FX, risk-free-
rate and share-count each have their own separate staleness-cache logic in `app/services/market_data/`,
none of them batched across holdings.

### 3. No compression or cache headers on the frontend's static assets

`frontend/nginx.conf` (and the inline copy baked into `frontend/Dockerfile`) is minimal — just an
SPA fallback (`try_files ... /index.html`). Neither the standalone file nor the Dockerfile's inline
`COPY <<EOF` version turns on `gzip`, sets any `Cache-Control`/`expires` header, or does anything
with the hashed, content-addressed filenames Vite already produces under `dist/assets/`. Two
separate costs: (a) the JS/CSS bundle is sent uncompressed on every single visit — typically 3-4x
more bytes than gzip would send for text assets like these; (b) hashed asset files that are safe to
cache forever get no long-lived `Cache-Control`, so a repeat visit gets no benefit from the
browser's disk cache and re-downloads them.

### 4. Frontend ships one large eagerly-loaded bundle (already known)

`App.tsx` statically imports all 14 page components; nothing in the router is lazy-loaded. This was
already flagged in `progress.md` §4 ("Main JS bundle is ~795 kB minified... slower first load") and
§3c backlog ("Code-split the frontend bundle"). Confirmed still true: no `React.lazy`/`Suspense`
anywhere in `frontend/src`. Every page's code (and its dependencies, e.g. `recharts` used by only
some pages) loads and parses before the *first* page paints, even though only one route is visible
at a time.

### 5. No client-side data cache — every page visit refetches from scratch

There's no react-query/SWR/etc. in `package.json` — `lib/api.ts` is a thin `fetch` wrapper called
directly from each page's `useEffect`. That's a reasonable, simple design, but it means navigating
Dashboard → Holdings → Dashboard again re-fetches everything both times with no short-lived cache or
in-flight de-duplication, even for data that plainly hasn't changed in the intervening seconds. Not
a first-load problem, but it compounds the backend latency in #1/#2 on every subsequent visit within
a session.

### 6. What's *not* a problem

- Most pages already parallelize their independent fetches correctly (`Promise.all` in
  `PortfolioPage.tsx`, `PreciousMetalsPage.tsx`). The one clearly sequential pattern found
  (`HoldingDetailPage.tsx`'s `MetricsPanel`: periods must load before metrics can be requested) is a
  genuine data dependency, not an avoidable waterfall.
- `GET /holdings` already got an explicit N+1 fix (2026-09-21, per its own docstring): document and
  position counts are batched into 2 aggregate queries regardless of holding count, not 2 per
  holding. Good precedent to reuse for #2 above.
- The Dashboard (`GET /portfolio/overview`) is genuinely fast by design — database-only, no market
  data, no LLM — and its own code comment says so. If Dashboard itself feels slow, that's worth a
  separate look (browser profiling), since nothing in its request path should be slow.
- `uvicorn app.main:app` runs with no `--workers` flag (single process). Starlette still offloads
  synchronous `def` route handlers to a thread pool, so this isn't a full request-serialization
  bottleneck, but it does mean there's no parallelism for the CPU-bound part of #2's per-holding loop
  and no redundancy. Lower priority than #1/#2/#3.

## Proposed fixes, in priority order

**P0 — cheap, safe, no architecture change:**

1. **Turn on gzip in nginx** (`frontend/nginx.conf` and the Dockerfile's inline copy):
   `gzip on; gzip_types text/plain text/css application/javascript application/json image/svg+xml;
   gzip_min_length 1024;` Add `location /assets/ { expires 1y; add_header Cache-Control "public,
   immutable"; }` since Vite's asset filenames are content-hashed and safe to cache forever. Near-
   zero risk, immediate win on every page's transfer time.
2. **Route-level code-splitting**: wrap each page import in `App.tsx` with `React.lazy()` and add a
   `<Suspense>` boundary with a small loading fallback in `Layout`. Cuts first-paint bundle size
   roughly in proportion to (1 / number of pages actually needed for the first route), and this was
   already on the backlog.

**P1 — the real latency fix, needs a small architecture decision:**

3. **Stop refreshing external providers inside a `GET`.** The matching `POST .../refresh` endpoint
   already exists for every one of these (research, valuation, prices). Cleanest fix: make every
   `GET` always return the cached snapshot immediately (even if stale — already labelled `stale`/
   `reason` in the response), and let staleness be resolved by either (a) an explicit "Refresh" button
   the frontend already mostly has, or (b) a proactive background refresh — a simple in-process
   scheduler (APScheduler, or even a periodic call from the existing worker process) that refreshes
   research/prices before they go stale, so a normal page visit never triggers one. This directly
   removes the multi-second-to-tens-of-seconds stalls on Macro/Sector/company research and on any
   stale valuation.
4. **Batch and/or precompute the Margin-of-Safety board.** Two options, not mutually exclusive:
   parallelize `build_board()`'s per-holding loop (thread pool, since the per-holding work is mostly
   I/O-bound DB/provider calls) so wall-clock time stops scaling linearly with holding count; and/or
   have the overnight worker (which already exists for analysis runs) precompute and store each
   holding's valuation on a schedule, so the board endpoint becomes a read of already-computed rows —
   the same shape as the `GET /holdings` N+1 fix already applied elsewhere in this codebase.

**P2 — worth doing, lower urgency:**

5. Move the beta (and consider price/FX/risk-free-rate) cache from in-process memory to the database,
   matching the pattern `app/services/market_data/` already uses elsewhere, so a Railway redeploy
   doesn't reset every ticker's cache back to cold.
6. Add a small client-side cache (react-query or SWR) so navigating between pages within a session
   doesn't always refetch from zero. Lower priority than P0/P1 — it helps repeat navigation, not
   first load.

## What this doesn't cover

No browser-side profiling (Network/Performance tabs against the live Railway URLs) was done this
session — that would confirm which of #1-#5 actually dominates on Faiz's own connection and would be
the natural next step before starting on P1, since #1 and #2 only show up as slow when their
respective caches are actually stale at the moment of the visit.
