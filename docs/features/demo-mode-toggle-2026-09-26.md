# Demo mode toggle — 2026-09-26

## Why

Faiz wanted a way to show the app (screen-share, demo, screenshot) without any risk of a real
brokerage holding, real document, real research output, or real account detail becoming visible.
His own framing of the requirement: **"ensure there is no possible way to know ANY information
from real portfolio when we have demo mode on."** This is the resulting feature: a single
Settings-page toggle that, when on, makes every page in the app show a fixed, entirely fabricated
portfolio instead of anything real — structurally, not just cosmetically.

## The safety guarantee, and how it's enforced

**The real DB/provider code path never executes when demo mode is on — it isn't run and then
have its output swapped.** Every protected endpoint checks demo mode as the very first thing in
its function body:

```python
if is_demo_mode(db):
    return demo_something(...)
real_code_that_touches_the_database_or_a_provider()
```

Concretely, three layers:

1. **Reads that can be faked** (10 routers) — the endpoint returns a fabricated response built from
   fixed, hand-written data. The real query/provider call is never reached.
2. **Reads and writes with no safe fake** (`documents.py`, `sources.py`, `research.py`, and — a
   judgment call, see below — `funds.py`) — every endpoint in these routers is blocked outright with
   a 403 while demo mode is on. These deal with real uploaded filings and real live research tied to
   real holdings; fabricating plausible-looking document/research content seemed like it would create
   a worse failure mode (a *fabricated* filing excerpt is more dangerous to mistake for real than an
   empty panel), so the four files are refused instead.
3. **Every mutating endpoint everywhere** (POST/PUT/PATCH/DELETE, all 17 routers) — calls
   `require_not_demo(db)` as its first statement, 403 if demo mode is on. This is exhaustive: no
   write anywhere in `backend/app/api/` is reachable while demo mode is on, except the demo-mode
   settings endpoint itself (it would otherwise be impossible to turn back off).

## Architecture

- **`app/models/app_setting.py`** — new `AppSetting` model (`key`/`value`/`updated_at`), backing a
  generic `app_settings` table. Migration `b2c3d4e5f6a7` (additive, follows the repo's existing
  migration style). No seed row: absence of the `demo_mode` key means OFF.
- **`app/services/settings/demo_mode.py`** — `is_demo_mode(db)` / `set_demo_mode(db, enabled)`. Reads
  fail closed to `False` (reported OFF) on any error — the safe direction for a check that decides
  whether real data gets served; an unreachable DB 500s every endpoint regardless of what this
  returns, so there's no path where this failing closed lets real data leak.
- **`app/services/settings/demo_guard.py`** — `DemoModeWriteBlockedError` +
  `require_not_demo(db)`, registered as a FastAPI exception handler in `app/main.py` → 403
  `{"detail": "This action is disabled while demo mode is on."}`.
- **`app/services/settings/synthetic_data.py`** — the fabricated dataset and one `demo_*()`
  function per faked endpoint, all built as instances of the *actual* Pydantic response schemas
  (imported from `app/schemas/*` and `app/domain/analysis_schema/`) rather than hand-rolled dicts,
  so fabricated output is guaranteed to validate/serialize exactly like a real response and can't
  silently drift from the real schema. Every qualitative field says "Demo data — fabricated for
  demonstration purposes." in-content.
- **`app/api/settings.py`** — `GET/PUT /settings/demo-mode`.

## The fabricated holdings

Ten well-known US large-caps, split across two fabricated accounts:

| Ticker | Name | Sector | Account |
|---|---|---|---|
| AAPL | Apple Inc. | Technology | Demo Nordnet ASK |
| MSFT | Microsoft Corporation | Technology | Demo Nordnet ASK |
| GOOGL | Alphabet Inc. Class A | Technology | Demo Nordnet ASK |
| JNJ | Johnson & Johnson | Health Care | Demo Nordnet ASK |
| PG | Procter & Gamble Co. | Consumer Staples | Demo Nordnet ASK |
| KO | Coca-Cola Co. | Consumer Staples | Demo Nordnet Investment |
| JPM | JPMorgan Chase & Co. | Financials | Demo Nordnet Investment |
| V | Visa Inc. Class A | Financials | Demo Nordnet Investment |
| HD | Home Depot Inc. | Consumer Discretionary | Demo Nordnet Investment |
| XOM | Exxon Mobil Corp. | Energy | Demo Nordnet Investment |

Plus fabricated precious metals (American Gold Eagle / American Silver Eagle coins), 3 fabricated
journal entries (AAPL/MSFT/XOM), 2 fabricated watchlist entries (NVDA, COST), fabricated macro
indicators, and a fabricated correlation/stress/regime read for portfolio risk. All prices,
quantities, valuations, DCF ranges, verdicts, moat ratings and thesis notes are made up — none of
it is read from anywhere, including from Faiz's real data.

## Endpoints touched

**Faked (real code path skipped, fabricated response returned):**
`GET /portfolio/overview`, `GET/GET-by-id /holdings`, `GET /holdings/{id}/periods`,
`GET /holdings/{id}/metrics`, `GET /holdings/{id}/share-count`, `GET/GET-by-id /accounts`,
`GET /valuation/holdings/{id}`, `GET /valuation/board`, `GET /analysis/holdings/{id}`,
`GET /analysis/holdings/{id}/readiness`, `GET /analysis/holdings/{id}/notes`,
`GET /analysis/queue`, `GET /thesis/holdings/{id}`, `GET /thesis/monitor`,
`GET /risk/portfolio`, `GET /performance/portfolio`, `GET /precious-metals/overview`,
`GET /precious-metals/price-history/{metal}`, `GET /journal`, `GET /watchlist`,
`GET /watchlist/holdings/{id}`, `GET /macro/indicators`, `GET /system/status` (fabricated payload,
plus `demo_mode: true`/`false` always set correctly regardless of mode).

**Blocked outright with 403 (reads and writes, no safe fake attempted):** every endpoint in
`documents.py`, `sources.py`, `research.py`, and `funds.py` (judgment call — see below).

**Every mutating endpoint everywhere** (all `POST`/`PUT`/`PATCH`/`DELETE` across all 17 routers) is
guarded with `require_not_demo(db)` — including ones not otherwise touched above:
`portfolio.py`'s snapshot/position/CSV-import endpoints and its `GET /snapshots*`/`GET
.../concentration` reads (blocked outright, same reasoning as documents/sources — real brokerage
snapshot detail isn't in the fake list), `accounts.py`, `holdings.py`, `valuation.py`'s refresh,
`analysis.py`'s run/queue/cancel/notes-write, `thesis.py`'s tripwire CRUD, `risk.py`'s refresh,
`performance.py`'s refresh, `precious_metals.py`'s writes, `journal.py`, `watchlist.py`,
`macro.py`'s refresh. The one exception: `PUT /settings/demo-mode` itself.

## Frontend

- `frontend/src/lib/demoMode.tsx` — a small context (`DemoModeProvider`/`useDemoMode`), fetched
  once at the app root (`main.tsx`) and shared by the banner and the Settings page.
- `frontend/src/pages/SettingsPage.tsx` — the toggle, with the safety guarantee spelled out in copy.
- New `/settings` route (`App.tsx`) and nav entry (`Layout.tsx`).
- A persistent amber "DEMO MODE" banner at the top of every page whenever it's on
  (`Layout.tsx`'s `DemoModeBanner`), with a link to Settings to turn it off.
- 403s from a mutating action surface through the existing `ApiError` message plumbing already used
  across the app (its `message` is the backend's own `detail` string, e.g. "This action is disabled
  while demo mode is on."), so pages that already show `e.message` on failure show this clearly
  without further page-by-page rework.

## Judgment calls Faiz should know about

- **`funds.py` is blocked outright**, not faked, even though the spec's "cover" list didn't name it
  and its "block" list only named documents/sources/research. Fund facts are tied to real uploaded
  documents the same way holdings' filing facts are, and nothing in the spec asked for a fabricated
  fund dataset, so blocking (same treatment as documents/sources/research) seemed safer than leaving
  it reachable or inventing fund data unasked.
- **`portfolio.py`'s snapshot/position/concentration reads are blocked outright**, not faked. The
  spec's fake list covers the *overview* (`GET /portfolio/overview`) but not per-snapshot detail —
  those expose the same real brokerage-account-level data a snapshot fake would need to invent from
  scratch, so they're blocked like documents/sources rather than given a parallel fake snapshot model.
- **`risk.py`'s and `performance.py`'s `POST .../refresh`** are blocked (mutating-endpoint rule)
  rather than also faked — their `GET` counterparts are faked, but a "refresh" is a POST that would
  otherwise touch a live market-data provider, so it follows the blanket mutating-endpoint guard.
- **`GET /precious-metals/coin-series`** and **`GET /thesis/metrics`** are left unguarded — both are
  static domain reference data (valid coin series, the metric registry), not anything about Faiz's
  real portfolio, so demo mode doesn't need to touch them.
- **`GET /holdings/field-options`** is likewise left unguarded (sector/instrument-type dropdown
  options, static domain data).

## Tests

New `backend/tests/integration/test_demo_mode_api.py`, 18 tests:
- Settings endpoint round-trips (off by default, PUT toggles, GET reflects it).
- `PUT /settings/demo-mode` itself still works while demo mode is on.
- Each faked GET (holdings, portfolio overview, accounts, valuation board, watchlist, journal,
  precious metals, macro, thesis monitor, risk, performance, system status) asserts on the actual
  fabricated tickers/names — a real seeded holding (`REAL1`) is confirmed absent from every one, and
  fetching it by id 404s while demo mode is on.
- `documents.py`/`sources.py`/`research.py`/`funds.py` are confirmed blocked outright.
- One exhaustive test drives every mutating endpoint across every router (accounts, holdings,
  portfolio, valuation, analysis, thesis, risk, performance, precious metals, journal, watchlist,
  macro, documents, sources, research, funds) with a schema-valid minimal payload and asserts every
  single one returns 403 — plus a separate test for the three multipart upload endpoints.

Backend suite: **881 passed** (863 baseline + 18 new), same 2 pre-existing unrelated failures in
`tests/unit/test_factory.py` (`test_default_primary_provider_is_google_ai_studio`,
`test_llm_provider_shares_the_primary_budget_guard_instance` — both about the LLM-provider factory
defaulting to Ollama instead of Google AI Studio, unrelated to this change). `ruff check` clean
(aside from a pre-existing, repo-wide `EXE002` "file executable, no shebang" warning that predates
this change and isn't specific to any file touched here).

Frontend: `tsc --noEmit` clean, `eslint` clean (one pre-existing-pattern `react-refresh` warning on
the new context file, not an error), `vitest run` clean (19 tests, all pre-existing — no
component-test harness exists yet, per Sprint 11's note, so no new frontend tests were added),
`vite build` succeeds (verified against a scratch `--outDir` — this machine's own `frontend/dist/`
has a pre-existing OS-level file-permission quirk unrelated to this change; noted in the commit).

## Git

Committed locally (`b2778f3`, on top of `a37b5e6`) — **not pushed**, per this repo's practice of
leaving non-trivial features for Faiz to review via GitHub Desktop before he pushes.
