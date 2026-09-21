# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | ✅ **Sprint 0, 1, 2 closed — Sprint 3 backend done (frontend next)** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md), which also has a **Backlog** section for candidate phases beyond Sprint 7 |

## Sprint 0 — ✅ closed

| Item | Status |
|---|---|
| Guardrail doc (`CLAUDE.md`) | ✅ Done, committed |
| Map real Supabase schema | ✅ Done (13 Alembic migration files → 21 tables) |
| DB strategy decision | ✅ Decided — leave schema/data as-is |
| LLM provider decision | ✅ Decided — Gemini (`google_ai_studio`) primary, Mistral fallback |
| Legacy frontend cleanup | ✅ Done |
| Skeleton FastAPI backend (`/health`) | ✅ Built. **Not deployed to Railway.** |
| Skeleton React frontend (health badge) | ✅ Built. **Not deployed to Railway.** |
| Wire Gemini + Mistral (budget guard, retry/backoff, RPM pacing) | ✅ Done |

## Sprint 1 — ✅ closed 2026-09-21 (equity data model & deterministic calculations)

| Deliverable | Status |
|---|---|
| SQLAlchemy models | ✅ Done — `app/models/`, built directly against the real (already-migrated) schema |
| Deterministic calculations module | ✅ Done — `app/services/calculations.py` |
| Document ingestion | ✅ Done — `app/services/documents/`, `POST /documents/upload` |
| Minimal API (holdings/accounts/portfolio CRUD, computed-metrics endpoints) | ✅ Done — `app/api/holdings.py`, `accounts.py`, `portfolio.py`, `app/services/metrics.py` |
| First real frontend pages (holding list + holding detail) | ✅ Done — `HoldingsListPage.tsx`, `HoldingDetailPage.tsx` |

See the "Changes / history" table below for the session-by-session breakdown.

## Sprint 2 — ✅ closed 2026-09-21 (live, evidence-first research)

| Deliverable | Status |
|---|---|
| Research data model (`ResearchRun`, `ResearchItem`) | ✅ Done — `app/models/research.py`, maps onto `research_runs`/`research_items`, which already existed in the real Supabase DB pre-reset (no new migration needed) |
| `GeminiResearchProvider` (Gemini + Google Search grounding) | ✅ Done — `app/providers/gemini_research_provider.py`, reuses the existing Google AI Studio key + `gemini_retry` pacing |
| Versioned research prompts | ✅ Done — `backend/prompts/research/{macro,sector,company}_v1.md` |
| Research services (staleness-checked caching, macro/sector/company) | ✅ Done — `app/services/research/` |
| `/research` API (macro, sector, per-holding company, + manual refresh) | ✅ Done — `app/api/research.py` |
| Frontend research UI | ✅ Done — `ResearchPanel` shared component, Macro page (+ sector picker), Sector page, company-research panel on `HoldingDetailPage`. "Macro" nav item live. |
| Numeric macro data (FRED / Norges Bank, `macro_observations`) | ⏳ **Deliberately deferred** — moved to the sprint plan's Backlog section |
| Background scheduler (periodic auto-refresh) | ⏳ **Deliberately deferred** — GET-triggers-refresh-if-stale covers "live" for now; moved to Backlog |

## Sprint 3 — ✅ backend closed 2026-09-21 (valuation engine) — frontend still to do

| Deliverable | Status |
|---|---|
| Live market-data providers (`yfinance`) — price, price history, FX, beta | ✅ Done — `app/providers/yfinance_provider.py` |
| Live risk-free-rate provider (FRED, all currencies via OECD long-term govt bond series) | ✅ Done — `app/providers/fred_risk_free_rate_provider.py`, new `risk_free_rate_observations` table + migration |
| Staleness-cached market-data services (price/FX/risk-free rate) | ✅ Done — `app/services/market_data/` |
| Versioned valuation assumptions (equity risk premium, terminal growth, scenario offsets, default beta) | ✅ Done — `app/domain/valuation_assumptions/v1.py` |
| Deterministic DCF engine (base/bull/bear scenarios, Gordon Growth terminal value, CAPM discount rate) | ✅ Done — `app/services/valuation/{dcf,discount_rate,growth}.py` |
| Reverse DCF (implied growth from current price, via bisection) | ✅ Done — `app/services/valuation/dcf.py` |
| Multiples-over-time (P/E, P/B, P/S, EV/EBITDA) | ✅ Done — `app/services/valuation/multiples.py` |
| Orchestration tying it together for one holding, with currency-consistency FX handling | ✅ Done — `app/services/valuation/holding_valuation.py` |
| `/valuation` API (`GET`/`POST .../refresh` per holding) | ✅ Done — `app/api/valuation.py` |
| **Frontend valuation UI** | ⏳ **Not started — next step**, scoped out of this session by Faiz's own choice (backend-only this session) |

**Design choices Faiz made this session** (all "Recommended" options, chosen via clarifying
questions before building): live market/FX/beta data from **yfinance**; discount rate from a
**live risk-free rate + a versioned equity-risk-premium assumption** (CAPM), not a single hardcoded
number; and this session scoped to **backend only**, frontend left for a follow-up session.

**Not yet done:** frontend valuation UI (DCF scenarios, reverse DCF, multiples charts on
`HoldingDetailPage`); deployed to Railway; run against Faiz's real holdings/documents.

## Out-of-sequence: Portfolio CSV import + delete UI — ✅ done 2026-09-21

Faiz asked for this ahead of the sprint order (the sprint plan had slotted "real broker-export
parsing" into Sprint 4, alongside the analysis engine). Pulled forward on its own, independent of
Sprint 4's other deliverables.

| Deliverable | Status |
|---|---|
| Broker-CSV parser (Nordnet-style "Beholdningstabell" exports: UTF-16LE, tab-delimited, Norwegian decimal comma) | ✅ Done — `app/services/portfolio_import/csv_parser.py` |
| Instrument-type classifier (stock / equity ETF / bond fund / money-market fund / commodity ETC) | ✅ Done — `app/domain/instrument_types.py`, tags `Holding.asset_class_raw` (existing legacy column, no migration) |
| CSV → Account + Document + PortfolioSnapshot + PortfolioPositions ingestion | ✅ Done — `app/services/portfolio_import/ingestion.py`, dedups holdings by name across accounts, auto-creates the Account from the filename's embedded account number |
| `POST /portfolio/import-csv` API | ✅ Done — `app/api/portfolio.py` |
| Frontend Portfolio page: multi-file CSV upload + accounts list + snapshots list, each with a delete button | ✅ Done — `frontend/src/pages/PortfolioPage.tsx`, wired into the nav for the first time |

**Decisions Faiz made this session** (all real-money/scope-affecting, asked before building):

- These exports mix real equities with bond/money-market funds and a physical gold ETC
  (Xetra-Gold). Faiz chose to **import every row and tag its real instrument type**, rather than
  silently skip the non-equity rows — portfolio value/composition stays accurate; the
  Buffett/Munger analysis engine (Sprint 4) is expected to only ever run against
  `stock`/`equity_etf`-tagged holdings.
- A separate whisky/collectibles CSV (`Collection_2.csv`) was in the same upload batch. Faiz chose
  to **skip it** — out of scope for this equity-only rebuild, consistent with CLAUDE.md leaving
  legacy non-equity data alone.
- Delete scope: the backend already had confirm-gated deletes for individual accounts, holdings,
  snapshots and positions (built in Sprint 1, never exposed in the UI). Faiz chose to **just expose
  those in the new Portfolio page**, not add a new bulk "delete everything" endpoint.

**Not yet done:** run this import against Faiz's real 5 account CSVs / the real Supabase DB (built
and tested against in-memory SQLite only, per the tests) — needs his go-ahead first (see "Needs
from Faiz" below). Not yet deployed to Railway either.

## Session: Sprint 2 closed with the frontend research UI

Faiz chose "finish Sprint 2: research UI" as that session's next-phase scope (over also building
the deferred numeric-macro/scheduler work, or skipping ahead to Sprint 3). Before building, that
session re-verified the repo's actual state against the docs (CLAUDE.md's status-honesty rule):
fresh venv, full backend test run (198/198 passing), `ruff check`, and a fresh frontend
`tsc`/`eslint`/`vite build` — all matched what the docs already claimed, with one small correction
(the prior session's CSV-import commit had in fact already been pushed to `origin/main`, so that
line in the "Needs from Faiz" table below is now closed).

Built: a shared `ResearchPanel` component (list/refresh/status, reused across all three research
surfaces); a Macro page (`/macro`, portfolio-wide macro/geopolitical research + a picker for
sectors actually held); a Sector page (`/sectors/:sector`); and a company-research panel added to
`HoldingDetailPage`. "Macro" is now a live nav item. No backend changes were needed — the
`/research/*` API was already built and tested in a prior session. Frontend `tsc --noEmit`,
`eslint .`, and `vite build` all clean. 1 commit (`20d76c1`), local only at the time.

## This session: Sprint 3 backend (valuation engine)

Faiz said "let's start developing next phase according to plan" — per the sprint plan, next was
Sprint 3 (valuation engine). Answered three clarifying questions before building (all "Recommended"
options): yfinance for market/FX/beta data; live risk-free rate + versioned equity-risk-premium for
the discount rate (CAPM); backend only this session, frontend deferred.

Built the full backend valuation engine in 6 tested, committed units: (1) yfinance + FRED provider
interfaces and new `MarketObservation`/`FxObservation`/`RiskFreeRateObservation` models (new
migration for the risk-free-rate table); (2) staleness-cached market-data services mirroring the
Sprint 2 research-caching pattern; (3) versioned valuation assumptions (`v1`: 4.5% ERP for
USD/EUR/GBP/NOK, 2.5% terminal growth, ±3% bull/bear growth offsets, beta default 1.0); (4) the
deterministic DCF/reverse-DCF/CAPM-discount-rate engine (owner-earnings-based, Gordon Growth
terminal value, reverse DCF via bisection search); (5) multiples-over-time (P/E, P/B, P/S,
EV/EBITDA); (6) the orchestration layer tying it all together for one real holding — including live
FX conversion when a holding's trading currency differs from its filing currency — and the
`/valuation` API endpoints.

Every failure mode (missing risk-free rate, no FX rate, fewer than two periods of owner-earnings
history, no beta from the provider) degrades only the affected part of the result rather than
failing the whole response, per CLAUDE.md's fail-visibly discipline. 88 new tests (274 → 286 total
after fixing a bug this doc's history caught: the API-level `current_price_per_share` field was
being computed but never actually attached to the result — an integration test written specifically
to exercise the real endpoint caught it). Ruff clean on every new/changed file (only pre-existing
repo-wide `EXE002`/alembic-`I001` noise remains). 6 commits, local only — `git push` fails in this
shell with the same credential error as every prior session.

**Discovered this session, not yet fixed:** the real (gitignored) `backend/.env` has
`MARKET_DATA_PROVIDER=stub` and `RESEARCH_PROVIDER=stub` set — neither is an implemented provider,
so running the backend for real right now would immediately break both the new valuation feature
and the already-shipped Sprint 2 research feature with an "Unknown ... provider" error. Left
untouched deliberately (real config only ever lives in `backend/.env`, never edited by an agent
session per CLAUDE.md) — flagged to Faiz below instead.

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Fix `backend/.env`: `MARKET_DATA_PROVIDER=stub` and `RESEARCH_PROVIDER=stub`** | Neither is a real provider — set them to `yfinance` and `google_ai_studio` (or whatever you intend) or the app raises immediately when either feature is used |
| **Push `main`** (6 commits this session, `9571fe8`..`816127b`) | No GitHub push credentials in this session's shell either — confirmed by an actual failed `git push` attempt this session, not just assumed |
| **OK to run the portfolio CSV import against your real 5 account exports / the real Supabase DB** | Built and tested against in-memory SQLite only so far — nothing has touched your real data yet |
| Set a real `GOOGLE_AI_STUDIO_API_KEY` before trying `/research/*` for real | `GeminiResearchProvider` raises immediately without one — reuses the same key Sprint 0's analysis provider already needs |
| Set a `FRED_API_KEY` before trying `/valuation/*` for real | `FredRiskFreeRateProvider` needs one; free to obtain from FRED |
| Redeploy to Railway once pushed, with the LLM/object-storage env vars from prior sprints set | Still **not deployed to Railway** — status-honesty rule applies here same as every prior sprint |
| Decide priority among the Backlog candidates (numeric macro data, portfolio risk, thesis tracking, market-data/performance, LLM usage ledger, alerts, reporting) | See the sprint plan doc's Backlog section — none of these are scheduled into a sprint yet |
| Fix GitHub push credentials for good, at some point | Every session (cloud and device-linked alike) has hit the identical `could not read Username for 'https://github.com'` error — a one-time PAT/credential-helper setup would stop this being a recurring manual step |

## Known ongoing issue

No session's shell — cloud or the one on Faiz's linked device — has had GitHub push credentials
configured (`git push` fails with `could not read Username for 'https://github.com'`). Commits so
far in the repo were pushed by Faiz himself from his own terminal/GitHub Desktop between sessions;
this session's 6 commits are sitting local, waiting on the same thing.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Sprint 3 backend: valuation engine | Built the full backend valuation engine: yfinance/FRED providers + models (new migration), staleness-cached market-data services, versioned valuation assumptions, deterministic DCF/reverse-DCF/CAPM engine, multiples-over-time, the orchestration layer (with live-FX currency handling) and the `/valuation` API. Every live-data failure mode degrades only the affected part of the result, never the whole response. 88 new tests (286 total), ruff clean apart from pre-existing noise. 6 commits (`9571fe8`..`816127b`), local only — `git push` still fails in this shell. Discovered (not fixed): real `.env` has `MARKET_DATA_PROVIDER=stub`/`RESEARCH_PROVIDER=stub`, which would break both this feature and Sprint 2's research feature if run as-is — flagged to Faiz above. Frontend valuation UI deliberately deferred to a follow-up session (Faiz's choice). | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 closed: frontend research UI | Verified the repo's actual state (fresh venv, 198/198 backend tests, ruff, fresh frontend build) before starting, per the status-honesty rule — confirmed the prior session's CSV-import commit had already been pushed. Built the frontend for `/research/*`: a shared `ResearchPanel` component, a Macro page (+ sector picker), a Sector page, and a company-research panel on `HoldingDetailPage`; "Macro" is now a live nav item. No backend changes. Frontend lint/type-check/build all clean. 1 commit (`20d76c1`), since confirmed pushed. Also drafted a Backlog section in the sprint plan doc covering candidate phases beyond Sprint 7 (numeric macro data & scheduler, portfolio risk intelligence, thesis tracking, market-data/performance tracking, LLM usage ledger, alerts, reporting/export). | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio CSV import + delete UI (pulled forward from Sprint 4) | Built the broker-export CSV parser (UTF-16LE, Nordnet-style), an instrument-type classifier for the mixed equity/bond/ETC rows these exports contain, the CSV→Account/Document/Snapshot/Position ingestion service, the `POST /portfolio/import-csv` API, and a new frontend Portfolio page (multi-file upload + account/snapshot lists with delete buttons, using the already-built confirm-gated delete endpoints). Faiz chose to import every row (tagged, not skipped), skip the whisky/collectibles CSV entirely, and keep deletes granular rather than add a bulk wipe. 25 new tests (198 total), ruff clean. 1 commit (`2cb56c7`), since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 started: live research (macro/sector/company) | Built the full research vertical slice: `ResearchRun`/`ResearchItem` models (onto already-existing DB tables), `GeminiResearchProvider` (Google Search grounding, reusing the Gemini key/pacing), versioned prompts, staleness-checked caching services, and `/research` API endpoints (GET serves-cache-or-refreshes, POST `.../refresh` forces it). 26 new tests (173 total), ruff clean. 2 commits (`16c3ff6`, `588198d`), both since confirmed pushed. Numeric macro data (FRED/Norges Bank) and a background scheduler deliberately deferred. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Minimal API + first frontend pages (Sprint 1 closed) | Built holdings/accounts/portfolio CRUD, read-only computed-metrics endpoints, and portfolio-wide document uploads (5 backend commits) — closing the Minimal API deliverable after asking Faiz how portfolio positions should be entered (he chose requiring a real source document over a manual-entry shortcut). Then built the holding-list and holding-detail frontend pages against that API and the Design & UX direction (1 frontend commit). 47 new tests (147 backend total), ruff/lint/type-check all clean. 6 commits this session, all since confirmed pushed by Faiz. Sprint 1 is now fully closed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Document ingestion (Sprint 1) | Built PDF/PPTX/XLSX extraction, sha256 intake/dedup, swappable object storage (local/S3), the DB session module (fixing a broken alembic import along the way), and the first real API router (`/documents/upload`, `/documents`, `/documents/{id}`). 32 new tests, 109 total passing, ruff clean. 3 commits this session since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 close + Sprint 1 start | Faiz confirmed `LLM_PROVIDER=google_ai_studio` and to finish Sprint 0 before Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, daily budget guard) — Sprint 0 fully closed. Then built `app/models/` and `app/services/calculations.py`. 77 backend unit tests, all passing. Two commits made, since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs. Saved the Mistral fallback key to `backend/.env`, clearing Sprint 0's last blocker. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files). Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
