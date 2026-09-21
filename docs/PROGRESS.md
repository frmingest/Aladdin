# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | ✅ **Sprint 0, 1, 2, 3 all closed** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md), which also has a **Backlog** section for candidate phases beyond Sprint 7. **Sprint 4 (the analysis engine) is next**, not yet started. |

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

## Sprint 3 — ✅ closed 2026-09-21 (valuation engine, backend + frontend)

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
| **Frontend valuation UI** | ✅ Done — `ValuationPanel.tsx` on `HoldingDetailPage`: assumption stat tiles, DCF bull/base/bear scenario cards with margin-of-safety coloring, reverse-DCF implied growth, and multiples-over-time as small-multiples charts |

**Design choices Faiz made when this sprint's backend was built** (all "Recommended" options,
chosen via clarifying questions before building): live market/FX/beta data from **yfinance**;
discount rate from a **live risk-free rate + a versioned equity-risk-premium assumption** (CAPM),
not a single hardcoded number; and that session scoped to **backend only**, frontend left for a
follow-up session (this one).

**Frontend session's own design note:** P/E, P/B, P/S, and EV/EBITDA sit on very different scales,
so multiples-over-time renders as four separate small-multiple line charts (one axis each) rather
than one combined chart — avoids a dual-axis chart, which reads misleadingly. Uses `recharts`
(already a frontend dependency, first put to use here).

**Not yet done:** deployed to Railway; run against Faiz's real holdings/documents. **Update, see the
session below:** Faiz's own screenshots this session show a live Railway container log and a working
Portfolio page with real data (5 accounts, 124 positions, 7 snapshots) — strong evidence this *is*
now deployed and running against the real DB, contradicting this line. Not independently
re-confirmed against the live URL this session (not shared) — flagged below and in "Needs from Faiz".

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
  those in the new Portfolio page**, not add a new bulk "delete everything" endpoint (**superseded
  this session** — see below, he asked for the bulk wipe after all once he'd used the app for real).

**Not yet done:** run this import against Faiz's real 5 account CSVs / the real Supabase DB (built
and tested against in-memory SQLite only, per the tests) — needs his go-ahead first (see "Needs
from Faiz" below). Not yet deployed to Railway either. **Update, see the session below:** Faiz's own
screenshots/logs this session show this evidently has since happened — 5 real accounts, 124
positions, 7 snapshots, running against a live Railway container.

## Session: Portfolio delete fixes, page-load speed, first portfolio-level chart, whisky grouping (2026-09-21)

Faiz came back with six items from real hands-on use of the app (screenshots + a real Railway error
log), not a planned sprint step — Sprint 4 (the analysis engine) is still next per the sprint plan;
this was an out-of-sequence fix/polish session, same pattern as the CSV-import session above.

**Status-honesty finding, before anything else:** Faiz's screenshots included a live Railway
container log ("Starting Container… Uvicorn running…") and a working Portfolio page showing 5 real
accounts / 124 real positions / 7 snapshots. That directly contradicts this doc's prior "not yet
deployed to Railway" / "not yet run against the real DB" status on Sprints 0 and 3 and the CSV-import
entry above (now struck through with an update note in each place). This session did not
independently re-verify the live Railway URL itself (it wasn't shared) — treat "deployed and running
against real data" as strongly evidenced, not re-confirmed firsthand. Worth Faiz sharing the live
URL so a future session can check it directly instead of trusting docs that turned out stale here.

**1) Snapshot delete was 500ing (Faiz's own error log).** `DELETE /portfolio/snapshots/{id}` was
raising a raw psycopg2 `ForeignKeyViolation` on a real snapshot — a pre-2026-09-21 `analysis_runs`
row (Phase 3's old AI-analysis engine, superseded by this rebuild but never dropped per CLAUDE.md)
still referenced it, and `analysis_runs.portfolio_snapshot_id` has no `ON DELETE CASCADE`. Asked
Faiz directly how to handle it; he chose **cascade-delete the legacy analysis chain** over blocking
the delete or a two-step "force delete" reveal. Mapped the legacy tables for the first time
(`app/models/legacy_analysis.py` — `analysis_runs`, `holding_analyses`, `factor_assessments`,
`evidence_references`, `llm_usage_events`, onto pre-existing tables, no new migration) and made the
delete cascade-purge everything except `llm_usage_events` (real spend/usage history — those rows are
unlinked, never deleted). The endpoint now returns a small JSON body (what got purged) instead of a
bare 204.

**2) Bulk "delete all portfolio" button.** Didn't exist — the CSV-import session had deliberately
chosen granular-only deletes. Faiz asked for it after all, once he'd actually used the app and had to
delete 5 accounts/7 snapshots one by one. New `DELETE /portfolio/all` (accounts + snapshots +
positions only — Faiz's explicit choice; Holdings and Documents are out of scope, reusing the same
legacy-purge helper from #1), wired to a danger-styled button on the Portfolio page with a confirm
dialog naming the exact counts.

**3) Holdings/Portfolio/Macro page-load speed.** `GET /holdings` and `GET /accounts` were each
running 2 COUNT queries *per row* instead of one aggregate query for the whole list — 2N+1 round
trips to Postgres. `list_holdings` returns every row in the `holdings` table, including the legacy
pre-reset non-equity ones (see #6 below), so this was the likely main cause of the Holdings-page and
Macro-page slowness (Macro's sector picker also calls `listHoldings()`). Fixed to 2 aggregate
`GROUP BY` queries total regardless of row count, on both endpoints — same output values, existing
tests unaffected.

**4) No charts anywhere except Holding-detail valuation.** True — `ValuationPanel`'s DCF/multiples
charts (Sprint 3) were the only visuals in the app. Added a composition-by-instrument-type bar chart
to the Portfolio page: counts, not portfolio dollar value, since no $ aggregation exists yet across
accounts/currencies/live prices — that's genuinely Sprint 5's job ("Portfolio roll-up & dashboard"),
not something to fake here. Single accent-colored, direct-labeled bars, matching `ValuationPanel`'s
existing chart conventions rather than introducing a categorical palette (the Design & UX direction's
"color means state, one quiet accent color" principle).

**5 & 6) Whisky/gold/silver grouping under Holdings.** The legacy pre-reset whisky bottles are
individual rows in the `holdings` table (one per bottle, `sector` set to the distillery name — that
old app's own categorization hack) and were listing one-by-one, which is also why Faiz was seeing
individual distillery names as "Sector Research" chips on the Macro page. Faiz clarified: group
whisky into one row; leave gold and silver as individual holdings (no change needed there). Holdings
page now collapses every holding whose `sector` matches one of the 24 real distillery names visible
in Faiz's own screenshot (`WHISKY_SECTORS` in `frontend/src/lib/types.ts`) into a single expandable
"Whisky (N bottles)" row — there's no instrument-type tag marking these rows another way, since they
predate this rebuild's tagging.

**Testing:** 2 new backend tests (a cascade-delete regression test that inserts a real legacy
`AnalysisRun` row and confirms it gets purged; a bulk-wipe scope test confirming Holdings survive) +
1 existing test updated for the snapshot-delete 204→200 response shape change. 288/288 backend tests
passing, ruff clean (only the same pre-existing `EXE002` noise). Frontend `tsc --noEmit`, `eslint .`,
and `vite build` all clean. 3 commits (`e9a0eca`, `1eb2c0b`, `3193828`) — **local only**, `git push`
fails in this session's shell with the same credential error every prior session has hit
(`could not read Username for 'https://github.com'`), confirmed by an actual attempt this session.

**Not done this session:** git push (see above — needs Faiz, same as every prior session); Sprint 4
itself (this was an out-of-sequence fix session, same as the CSV-import one).

## Session: Sprint 3 closed with the frontend valuation UI

Faiz said "start on next development phase and ensure documentation is up to date" — per the
sprint plan and this doc, the explicit next step was Sprint 3's deferred frontend (the backend had
already closed in the prior session). Before building, this session re-verified the repo's actual
state against the docs, per CLAUDE.md's status-honesty rule: fresh venv, full backend test run
(286/286 passing, matching the docs exactly), `ruff check` (only the same pre-existing `EXE002`
noise), and fresh frontend `tsc`/`eslint`/`vite build` — all clean. One correction found: the prior
session's docs said "6 commits, local only, `git push` fails" — that was stale. `git status` this
session shows `main` up to date with `origin/main`, working tree clean, nothing unpushed — every
commit through the prior session's own docs-sync commit (`d4edc2f`) has in fact been pushed since.

Built `ValuationPanel.tsx` and wired it into `HoldingDetailPage.tsx` against the existing
`/valuation/holdings/{id}` API (no backend changes needed — it was already built and tested):
assumption stat tiles (live price, CAPM discount rate with risk-free-rate/beta hint, base growth
rate, reverse-DCF implied growth), DCF bull/base/bear scenario cards (intrinsic value per share +
margin of safety, colored green/red by sign), and multiples-over-time as four small-multiple line
charts (P/E, P/B, P/S, EV/EBITDA — kept on separate axes since they sit on very different scales,
using `recharts`, already a dependency). A per-period skip reason surfaces when a metric has no
computed value yet, and an `unavailable_reasons` banner surfaces when any part of a holding's
valuation degraded — both follow this app's existing "fail visibly, never silently" convention from
the Metrics and Research panels. Sprint 3 is now **fully closed**.

Frontend `tsc --noEmit`, `eslint .`, and `vite build` all clean. 1 commit (`ddeade1`), local only —
`git push` fails in this session's shell with the same credential error every prior session has
hit, confirmed by an actual attempt this session.

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
repo-wide `EXE002`/alembic-`I001` noise remains). 6 commits, since confirmed pushed (see the session
above).

**Discovered this session, not yet fixed:** the real (gitignored) `backend/.env` has
`MARKET_DATA_PROVIDER=stub` and `RESEARCH_PROVIDER=stub` set — neither is an implemented provider,
so running the backend for real right now would immediately break both the new valuation feature
and the already-shipped Sprint 2 research feature with an "Unknown ... provider" error. Left
untouched deliberately (real config only ever lives in `backend/.env`, never edited by an agent
session per CLAUDE.md) — still flagged to Faiz below, still unfixed as of this session. **Update, see
the session above:** Faiz's real deployment evidently works now, so this was presumably fixed on his
end since — worth confirming rather than assuming.

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Push `main`** (3 commits this session: `e9a0eca`, `1eb2c0b`, `3193828`) | No GitHub push credentials in this session's shell either — confirmed by an actual failed `git push` attempt this session, not just assumed |
| **Confirm the live Railway URL / that the app is in fact deployed** | Your own screenshots/logs this session show it running against real data, contradicting this doc's prior "not yet deployed" status — worth confirming directly so future sessions can check the live state instead of relying on docs |
| **Fix `backend/.env`: `MARKET_DATA_PROVIDER=stub` and `RESEARCH_PROVIDER=stub`**, if not already | Neither is a real provider — set them to `yfinance` and `google_ai_studio` (or whatever you intend) or the app raises immediately when either feature is used. Your real deployment working suggests this may already be fixed — flagging in case it isn't |
| Set a real `GOOGLE_AI_STUDIO_API_KEY` before trying `/research/*` for real, if not already | `GeminiResearchProvider` raises immediately without one |
| Set a `FRED_API_KEY` before trying `/valuation/*` for real, if not already | `FredRiskFreeRateProvider` needs one; free to obtain from FRED |
| Decide Sprint 4 scope + priority among the Backlog candidates | Sprint 4 (the Buffett/Munger persona & output schema) is next per the sprint plan; the Backlog section covers candidate phases beyond Sprint 7 — none of these are scheduled yet |
| Fix GitHub push credentials for good, at some point | Every session (cloud and device-linked alike) has hit the identical `could not read Username for 'https://github.com'` error — a one-time PAT/credential-helper setup would stop this being a recurring manual step |

## Known ongoing issue

No session's shell — cloud or the one on Faiz's linked device — has had GitHub push credentials
configured (`git push` fails with `could not read Username for 'https://github.com'`). Commits so
far in the repo were pushed by Faiz himself from his own terminal/GitHub Desktop between sessions;
this session's 3 commits (`e9a0eca`, `1eb2c0b`, `3193828`) are sitting local, waiting on the same
thing.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Portfolio delete fixes, page-load speed, first portfolio-level chart, whisky grouping | Six items from Faiz's real hands-on use (screenshots + a real Railway error log): (1) fixed `DELETE /portfolio/snapshots/{id}` 500ing on a legacy `analysis_runs` FK — now cascade-purges the pre-reset analysis chain; (2) added `DELETE /portfolio/all` (accounts+snapshots+positions only) + a UI button; (3) fixed 2N+1 query patterns on `GET /holdings`/`GET /accounts` (likely cause of Holdings/Macro slowness); (4) added the first portfolio-level chart (composition by instrument type); (5)/(6) legacy whisky holdings now collapse into one row on the Holdings page, gold/silver left as-is. Also surfaced a status-honesty finding: Faiz's screenshots show the app is in fact deployed to Railway and running against real data, contradicting this doc's prior "not yet deployed" status in several places (updated inline, not independently re-verified against the live URL). 2 new tests + 1 updated (288/288 passing), ruff clean. Frontend `tsc`/`eslint`/`vite build` clean. 3 commits (`e9a0eca`, `1eb2c0b`, `3193828`), local only — `git push` still fails in this shell. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 closed: frontend valuation UI | Re-verified repo state first (286/286 backend tests, ruff clean, fresh frontend build) — corrected a stale "local only" claim in the prior session's docs, since all those commits were in fact already pushed. Built `ValuationPanel.tsx` (assumption stat tiles, DCF bull/base/bear scenario cards with margin-of-safety coloring, reverse-DCF implied growth, multiples-over-time as small-multiple `recharts` line charts) and wired it into `HoldingDetailPage.tsx`. No backend changes — `/valuation/*` was already built and tested. Frontend `tsc`/`eslint`/`vite build` all clean. 1 commit (`ddeade1`), local only — `git push` still fails in this shell. Sprint 3 is now fully closed; Sprint 4 (the analysis engine) is next. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 backend: valuation engine | Built the full backend valuation engine: yfinance/FRED providers + models (new migration), staleness-cached market-data services, versioned valuation assumptions, deterministic DCF/reverse-DCF/CAPM engine, multiples-over-time, the orchestration layer (with live-FX currency handling) and the `/valuation` API. Every live-data failure mode degrades only the affected part of the result, never the whole response. 88 new tests (286 total), ruff clean apart from pre-existing noise. 6 commits (`9571fe8`..`816127b`), since confirmed pushed. Discovered (not fixed): real `.env` has `MARKET_DATA_PROVIDER=stub`/`RESEARCH_PROVIDER=stub`, which would break both this feature and Sprint 2's research feature if run as-is — flagged to Faiz above, still unfixed. Frontend valuation UI deliberately deferred to a follow-up session (Faiz's choice) — closed above. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 closed: frontend research UI | Verified the repo's actual state (fresh venv, 198/198 backend tests, ruff, fresh frontend build) before starting, per the status-honesty rule — confirmed the prior session's CSV-import commit had already been pushed. Built the frontend for `/research/*`: a shared `ResearchPanel` component, a Macro page (+ sector picker), a Sector page, and a company-research panel on `HoldingDetailPage`; "Macro" is now a live nav item. No backend changes. Frontend lint/type-check/build all clean. 1 commit (`20d76c1`), since confirmed pushed. Also drafted a Backlog section in the sprint plan doc covering candidate phases beyond Sprint 7 (numeric macro data & scheduler, portfolio risk intelligence, thesis tracking, market-data/performance tracking, LLM usage ledger, alerts, reporting/export). | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio CSV import + delete UI (pulled forward from Sprint 4) | Built the broker-export CSV parser (UTF-16LE, Nordnet-style), an instrument-type classifier for the mixed equity/bond/ETC rows these exports contain, the CSV→Account/Document/Snapshot/Position ingestion service, the `POST /portfolio/import-csv` API, and a new frontend Portfolio page (multi-file upload + account/snapshot lists with delete buttons). Faiz chose to import every row (tagged, not skipped), skip the whisky/collectibles CSV entirely, and keep deletes granular rather than add a bulk wipe. 25 new tests (198 total), ruff clean. 1 commit (`2cb56c7`), since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 started: live research (macro/sector/company) | Built the full research vertical slice: `ResearchRun`/`ResearchItem` models (onto already-existing DB tables), `GeminiResearchProvider` (Google Search grounding), versioned prompts, staleness-checked caching services, and `/research` API endpoints (GET serves-cache-or-refreshes, POST `.../refresh` forces it). 26 new tests (173 total), ruff clean. 2 commits (`16c3ff6`, `588198d`), both since confirmed pushed. Numeric macro data (FRED/Norges Bank) and a background scheduler deliberately deferred. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Minimal API + first frontend pages (Sprint 1 closed) | Built holdings/accounts/portfolio CRUD, read-only computed-metrics endpoints, and portfolio-wide document uploads (5 backend commits) — closing the Minimal API deliverable after asking Faiz how portfolio positions should be entered (he chose requiring a real source document over a manual-entry shortcut). Then built the holding-list and holding-detail frontend pages against that API and the Design & UX direction (1 frontend commit). 47 new tests (147 backend total), ruff/lint/type-check all clean. 6 commits this session, all since confirmed pushed by Faiz. Sprint 1 is now fully closed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Document ingestion (Sprint 1) | Built PDF/PPTX/XLSX extraction, sha256 intake/dedup, swappable object storage (local/S3), the DB session module (fixing a broken alembic import along the way), and the first real API router (`/documents/upload`, `/documents`, `/documents/{id}`). 32 new tests, 109 total passing, ruff clean. 3 commits this session since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 close + Sprint 1 start | Faiz confirmed `LLM_PROVIDER=google_ai_studio` and to finish Sprint 0 before Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, daily budget guard) — Sprint 0 fully closed. Then built `app/models/` and `app/services/calculations.py`. 77 backend unit tests, all passing. Two commits made, since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs. Saved the Mistral fallback key to `backend/.env`, clearing Sprint 0's last blocker. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files). Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
