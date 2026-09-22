# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-22

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | Sprint 0, 1, 2, 3 **closed**. **Sprint 4 (the analysis engine) backend is built this session — frontend deferred.** See the [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md), which also has a **Backlog** section for candidate phases beyond Sprint 7. |

## Sprint 0 — ✅ closed

| Item | Status |
|---|---|
| Guardrail doc (`CLAUDE.md`) | ✅ Done, committed |
| Map real Supabase schema | ✅ Done (13 Alembic migration files → 21 tables) |
| DB strategy decision | ✅ Decided — leave schema/data as-is |
| LLM provider decision | ✅ Decided — Gemini (`google_ai_studio`) primary, Mistral fallback |
| Legacy frontend cleanup | ✅ Done |
| Skeleton FastAPI backend (`/health`) | ✅ Built and (per real screenshots) now confirmed deployed to Railway |
| Skeleton React frontend (health badge) | ✅ Built and deployed |
| Wire Gemini + Mistral (budget guard, retry/backoff, RPM pacing) | ✅ Done |

## Sprint 1 — ✅ closed (equity data model & deterministic calculations)

| Deliverable | Status |
|---|---|
| SQLAlchemy models | ✅ Done — `app/models/`, built directly against the real (already-migrated) schema |
| Deterministic calculations module | ✅ Done — `app/services/calculations.py` |
| Document ingestion | ✅ Done — `app/services/documents/`, `POST /documents/upload` |
| Minimal API (holdings/accounts/portfolio CRUD, computed-metrics endpoints) | ✅ Done — `app/api/holdings.py`, `accounts.py`, `portfolio.py`, `app/services/metrics.py` |
| First real frontend pages (holding list + holding detail) | ✅ Done — `HoldingsListPage.tsx`, `HoldingDetailPage.tsx` |

## Sprint 2 — ✅ closed (live, evidence-first research)

| Deliverable | Status |
|---|---|
| Research data model, `GeminiResearchProvider`, versioned prompts, caching services, `/research` API, frontend UI | ✅ All done — see the sprint plan doc for detail |
| Numeric macro data (FRED / Norges Bank) + background scheduler | ⏳ Deliberately deferred — see the sprint plan's Backlog section |

## Sprint 3 — ✅ closed (valuation engine, backend + frontend)

| Deliverable | Status |
|---|---|
| Live market-data/risk-free-rate providers, staleness-cached services, versioned assumptions, deterministic DCF/reverse-DCF/multiples engine, `/valuation` API, frontend `ValuationPanel` | ✅ All done — see the sprint plan doc for detail |

## Portfolio CSV import + delete UI, page-load fixes, whisky grouping — ✅ done (pulled forward / out-of-sequence)

Real broker-CSV import, cascade-safe deletes (including a bulk portfolio wipe), 2N+1 query fixes on
the Holdings/Accounts list endpoints, the first portfolio-level chart, and whisky-holdings grouping.
See the sprint plan doc's own entries for full detail. **Faiz's own screenshots confirm the app is
deployed to Railway and running against his real data** (5 accounts, 124 positions, 7 snapshots) —
not independently re-verified against the live URL by any session, including this one.

**Follow-up bugs fixed 2026-09-21:** the "cascade-safe" delete above still missed one legacy table
(see "Portfolio delete: second cascade bug fixed" below), and separately CSV import itself started
500ing for an unrelated reason (see "CSV import 500 fixed" below).

## Sprint 4 — 🚧 backend built this session (the Buffett/Munger analysis engine)

Faiz confirmed the scope before building (three clarifying questions, all "Recommended" answered):
build the full evidence packet + two-pass pipeline this session, backend only (frontend deferred,
same split as Sprint 3); build both the blind pass and the reconciliation pass now, with a per-holding
notes field that's optional (empty notes still runs reconciliation); don't touch document-extraction
quality this session — use what Sprint 1's ingestion already extracts.

| Deliverable | Status |
|---|---|
| New tables `equity_analysis_runs`, `equity_holding_notes` | ✅ Done — migration `b5e1a9c3d7f2`, deliberately a fresh schema, not an extension of the legacy Phase-3 `analysis_runs`/`holding_analyses` tables (CLAUDE.md Rule 3) |
| Versioned output schema (`app/domain/analysis_schema/v1.py`) | ✅ Done — moat rating + 7 sub-dimensions, capital efficiency/financial fortress/macro-stress narrative sections, valuation synthesis, verdict (rating, thesis, risks, metrics to monitor, invalidation triggers) — every section carries `evidence_ids` |
| Versioned analysis assumptions (`app/domain/analysis_assumptions/v1.py`) | ✅ Done — 15% capital-efficiency hurdle, 5-year history lookback, mirrors the valuation-assumptions pattern |
| Versioned prompts (`prompts/analysis/{blind,reconciliation}_v1.md`) | ✅ Done — the blind prompt explicitly states it has been given no user notes; both frame evidence (and, for reconciliation, the owner's notes) as data to reason over, never instructions to follow (CLAUDE.md Rule 5) |
| Evidence packet builder | ✅ Done — `app/services/analysis/evidence_packet.py`. Pulls in: 3-5yr ROE history + the hurdle comparison (computed in Python, not by the LLM), margins, leverage ratios, owner-earnings trend (all via `app/services/calculations.py`/`metrics.py`), the full Sprint 3 valuation (DCF scenarios, reverse DCF, multiples), and Sprint 2's macro/sector/company research — reusing all of it unchanged |
| Blind pass + reconciliation pass | ✅ Done — `app/services/analysis/{blind_pass,reconciliation_pass}.py`. Each validates the LLM's JSON against the versioned schema and flags (never silently drops) any cited evidence ID that isn't actually in the packet |
| Two-pass pipeline orchestration | ✅ Done — `app/services/analysis/pipeline.py`. Gates on `EQUITY_ANALYZABLE_TYPES` (stock/equity_etf only), falls back to the secondary LLM provider on a primary outage, keeps the blind pass's result if only the reconciliation call fails, and sets the price-target range deterministically from the Sprint 3 DCF bear/bull scenarios — **never LLM-generated** (CLAUDE.md Rule 1) |
| Per-holding notes | ✅ Done — `app/services/analysis/notes.py`, `GET`/`PUT /analysis/holdings/{id}/notes`. Read only by the reconciliation pass — a dedicated test proves the blind pass's own prompt text never contains the notes (CLAUDE.md Rule 4) |
| `/analysis` API | ✅ Done — `app/api/analysis.py`: `GET`/`POST .../run` (always a fresh, explicit, LLM-cost-bearing call — no "serve cached" shape, unlike `/research/*`/`/valuation/*`), `GET`/`PUT .../notes` |
| Frontend | ⏳ **Deliberately deferred to a follow-up session** — Faiz's explicit choice, same split as Sprint 3 |

**Discovered this session, not fixed:** a holding created through the plain `POST /holdings` endpoint
(as opposed to the CSV-import path) defaults `asset_class_raw` to `"equity"` — which is **not** in
`EQUITY_ANALYZABLE_TYPES` (`stock`, `equity_etf`). Sprint 4 is the first place that gate is actually
enforced, so a manually-added holding would be rejected from analysis until re-tagged. Faiz's real
124 imported positions already carry correct tags via the CSV importer's classifier, so this doesn't
affect his existing data — but it will bite the first time a holding is added by hand rather than via
CSV import. Left as-is this session (a Sprint 1 model-default decision, out of this session's scope)
— flagged below.

**Testing:** 19 new tests (evidence packet, the pipeline's equity-gating/fallback/notes-isolation
behavior, notes CRUD, and the `/analysis/*` API against fakes for every live dependency — LLM, market
data, risk-free rate, research). 307/307 backend tests passing, ruff clean (only the same
pre-existing `EXE002` file-permission noise). Migration verified in both directions via
`alembic upgrade/downgrade --sql` against the Postgres dialect (no live DB connection available from
this session). **Not run against a real Gemini/Mistral call, real market data, or Faiz's real
holdings** — every test uses fakes; this is genuinely untested against the live stack.

## CSV import 500 fixed: object-storage provider alias — ✅ done 2026-09-21

Faiz reported `POST /portfolio/import-csv` 500ing on every CSV, no exceptions. Railway logs showed
`NotImplementedError: Object storage provider 'supabase' not supported — use 'local' or 's3'.` raised
from `get_object_storage()`, a FastAPI dependency on that route — meaning it failed before the route
ever looked at the uploaded file, matching "failing on all my csv files" exactly.

**Root cause:** Railway has `OBJECT_STORAGE_PROVIDER=supabase` set. `backend/.env.example`'s own
wording ("Only used when `OBJECT_STORAGE_PROVIDER` is r2 or supabase") reads as if `supabase` were a
valid value, but `app/providers/factory.py` only ever matched the literal string `"s3"`. So the env
var was set following the doc's own wording, and the factory rejected it anyway.

**Fix:** since R2 and Supabase Storage both expose the same S3-compatible API and the app already
treats the vendor as pure config (`endpoint_url`/`region`/keys, never a code branch —
`app/providers/object_storage_s3.py`'s own docstring says as much), `"s3"`, `"r2"`, and `"supabase"`
now all build `S3ObjectStorageProvider`. Clarified the matching comments in `settings.py`,
`.env.example`, and `requirements.txt` so they no longer imply a literal value the code didn't accept.
5 new regression tests in `test_factory.py` (all three aliases, the `local` default, and the
still-rejected unknown-provider case) — 249/249 backend unit tests pass.

**Faiz's Railway `OBJECT_STORAGE_PROVIDER=supabase` env var needs no change** — this was a code fix,
not a config fix.

**Status: ✅ pushed and deployed** (Faiz confirmed redeploy 2026-09-22).

## Portfolio delete: second cascade bug fixed — ✅ done 2026-09-21

Faiz hit a 500 on `DELETE /portfolio/all?confirm=true` in production. Root cause: `portfolio_risk_snapshots`
(a pre-2026-09-21 Phase-5 table, `portfolio_snapshot_id` with no `ON DELETE CASCADE`) was never added
to `_purge_legacy_analysis` when that function was first written — it only covered `analysis_runs`
and its children. Same class of bug as the original cascade-delete fix, just one table missed.

| Change | Detail |
|---|---|
| New model | `PortfolioRiskSnapshot` mapped in `app/models/legacy_analysis.py` (purge-only, matches the Phase 5 migration's columns) |
| Purge logic | `_purge_legacy_analysis` (`app/api/portfolio.py`) now also bulk-deletes `portfolio_risk_snapshots` rows for the snapshot(s) being deleted, unconditionally (it hangs off `portfolio_snapshot_id` directly, not through `analysis_runs`) |
| API response | `LegacyAnalysisPurgeCounts` schema gained a `portfolio_risk_snapshots` count field, surfaced in both `DELETE /portfolio/snapshots/{id}` and `DELETE /portfolio/all` responses |
| Frontend | `PortfolioPage.tsx`'s delete-confirmation notes now fold this count into the "old analysis/risk record(s) removed" message |
| Tests | 2 new regression tests (one per delete endpoint), mirroring the existing `analysis_runs` cascade test. 309/309 backend tests passing; `tsc --noEmit` clean |

Pushed to `main` since this row was written (confirmed by `git status` showing only 1 commit ahead
before this session's own new commit).

## Free market-data & research provider proposal — 📋 research doc only, 2026-09-21

Faiz asked for good free-to-use market-data/research sources. Full write-up:
[free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md).
No code changed. Headline finding: company **financials are 100% manual** right now (upload → LLM
extraction); the two highest-value free additions would be **SEC EDGAR** company-facts XBRL (US
names, no key, evidence-grade citations) and **Oslo Børs Newsweb** (Norwegian names' regulated
announcements) — both fit the existing "new provider = new file behind the factory" pattern.
Suggested as a backlog item, not started.

## CSV import ticker/duplicate-holding fixes, manual-edit UI, and full data wipe — ✅ done 2026-09-21

Faiz uploaded 5 real CSVs, hit a 500 on every one, and separately noticed garbage tickers and
duplicate holdings. Full write-up:
[csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md](csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md).

Three real bugs fixed, one new UI, one irreversible action taken at Faiz's explicit request:

| What | Detail |
|---|---|
| `POST /portfolio/import-csv` 500 | The CSV always imported successfully (account/document/snapshot/positions all committed) — only the *response* crashed, because `DocumentOut.quality_flags` rejected a matched Document row whose `quality_flags` was a `list` instead of a `dict`. `DocumentOut` now coerces any shape into a dict rather than crashing. |
| Garbage tickers + duplicate holdings | The CSV importer's dedup key was an exact match on a slugified-name-as-ticker, so any holding that already existed under a *different* ticker (hand-assigned or legacy) was invisible to it and got duplicated on every import — with a broken, non-market-real ticker that was then passed straight to the market-data/valuation/analysis pipeline. Matching is now by normalized security name, independent of `ticker`; the placeholder ticker for a genuinely new holding is transliterated (æøå) and collision-safe. |
| Manual-edit UI | Ticker, Sector (canonical GICS-11 dropdown, `app/domain/sectors.py`), and Instrument Type (dropdown) are all now editable per holding, inline, on the Holdings page (`PATCH /holdings/{id}`, `GET /holdings/field-options`). Ticker was previously excluded from `HoldingUpdate` on a "changing it is unsafe" rationale that turned out to be wrong — nothing FKs on it, only on the holding's `id`. |
| **Full Supabase data wipe** | Faiz explicitly asked for this, after being told exactly what it costs (15 uploaded documents across 6 holdings, whisky/gold/silver legacy holdings, 5 accounts / 7 snapshots / 124 positions, the untested Sprint 4 analysis tables). New migration `e5f6a7b8c9d0` (new head) `TRUNCATE`s every table in `public` except `alembic_version`. **✅ Ran** — Faiz confirmed (2026-09-22) the push + Railway redeploy is done, which is when `alembic upgrade head` executes it on container startup. Faiz has since re-uploaded his CSVs. |

Testing: 326/326 backend tests passing (17 new), ruff clean, frontend `tsc`/`eslint`/`vite build` all
clean. Not run against the live Railway deployment.

## Account rename, lost position data, and Macro page slowness — ✅ done 2026-09-22

Faiz raised three issues in one message. Full write-up:
[account-name-position-data-macro-speed-2026-09-22.md](account-name-position-data-macro-speed-2026-09-22.md).

| What | Detail |
|---|---|
| Account name field | Backend already fully supported `Account.name` (model/schema/`PATCH /accounts/{id}`) — the gap was 100% frontend. Added an optional account-name field on CSV upload and inline rename (click "Rename") on every row of the Accounts table. No backend change needed. |
| CSV upload "losing" quantity/price/GAV | Two different things: `quantity`/`cost_basis` (GAV × quantity) were already being saved correctly, just never shown anywhere in the frontend (fixed: new expandable positions table on the Portfolio page). `last_price` ("siste kurs") and total market value ("Verdi NOK") were a real bug — parsed out of every CSV row and then genuinely discarded, never persisted. New columns `last_price`/`market_value_nok` on `portfolio_positions` (migration `a2b4c6d8e0f1`), populated on every import from here on. Existing imported positions have `NULL` for both until re-uploaded. |
| Macro page loading slowly | Root cause: `app/providers/budget.py`'s `DailyBudgetGuard` was built (`factory.get_primary_budget_guard()`) but never actually consulted anywhere — confirmed by grep, no call site anywhere used `.would_exceed()`/`.record_usage()`. Once the real 20/day Google AI Studio quota (shared across macro + every sector + every company research + every analysis run) was spent, every further call still paid the full RPM-pacing wait + a real network call + the full retry/backoff ladder before failing — 45-60+ seconds of hanging, which is exactly what "loading really slow" looks like. Now wired in: both Gemini-calling providers share the one budget-guard instance and fail immediately (no wait, no call, no retries) once it's exhausted. Doesn't make a real Gemini call faster — makes a doomed one fail in milliseconds instead of about a minute. |

**Testing:** 333/333 backend tests passing (7 new), ruff clean on every file touched. Migration
verified upgrade+downgrade against the Postgres dialect offline (no live DB reachable from this
session). Frontend `tsc --noEmit`/`eslint`/`vite build` all clean. **Not run against a live Gemini
call, real market data, or Faiz's real 124 holdings.**

**Status: ✅ pushed and deployed** — `git status` shows `main` up to date with `origin/main`; Faiz confirmed the Railway redeploy on 2026-09-22.

## Setup checklist — confirmed by Faiz 2026-09-22

| Item | Status |
|---|---|
| Push `main` + redeploy on Railway (runs the full data wipe, migration `e5f6a7b8c9d0`, plus `a2b4c6d8e0f1`) | ✅ Done — Faiz confirmed; `git status` shows `main` up to date with `origin/main` |
| Re-upload the 5 CSVs + assign real tickers via the inline Ticker/Sector/Type edit UI | ✅ Done — Faiz confirmed real yfinance-compatible tickers are set |
| `GOOGLE_AI_STUDIO_API_KEY`, `FRED_API_KEY` set for real | ✅ Done — Faiz confirmed, in both `backend/.env` and Railway config |
| `MARKET_DATA_PROVIDER` / `RESEARCH_PROVIDER` set for real | ⏳ Open — see below |

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Set `MARKET_DATA_PROVIDER=yfinance` and `RESEARCH_PROVIDER=gemini_search`** in Railway (and in local `backend/.env`, which still has both as `stub`) | These are the **only** values the code accepts today (`app/providers/factory.py`). No new key needed: yfinance is keyless; `gemini_search` reuses `GOOGLE_AI_STUDIO_API_KEY`. Sprint 4's analysis engine depends on both. |
| **Try a real `POST /analysis/holdings/{id}/run`** against one real equity holding once the above is set, and share what comes back | Pipeline so far verified against fakes only — first real signal on prompt/schema quality, LLM cost per run, and usefulness |
| Decide when the Sprint 4 frontend follow-up happens, and review `app/domain/analysis_schema/v1.py` + `prompts/analysis/*.md` (moat sub-dimensions, verdict shape, 15% hurdle) | CLAUDE.md Rule 3: once a real run uses v1, changes need a new version file |
| Decide whether to schedule the free-source providers below as a real sprint | Research only today — see next table |

### Free data sources from the 2026-09-21 research (backlog, not built)

These are **not** values for the env vars above — each would need a new provider file behind the
factory first. Full detail: [free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md).

| Source | Covers | Cost / key | Priority |
|---|---|---|---|
| **SEC EDGAR** company-facts XBRL + full-text search | Financials for US/SEC-registered names, citation-grade | Free, no key (10 req/s, User-Agent required) | ⭐ Top pick |
| **Oslo Børs Newsweb** | Regulated announcements for Oslo Børs names (quarterlies, insider trades) | Free, no key (web feed, not JSON API) | ⭐ Top pick |
| Brønnøysundregistrene (Enhetsregisteret / Regnskapsregisteret) | Norwegian entity data, annual-accounts figures | Free, no key — verify accounts API still live | Nice to have |
| World Bank / OECD / IMF SDMX | Broader global macro beyond FRED + Norges Bank | Free, no key | Low |
| GDELT | Global news volume/sentiment signal | Free, no key | Low |
| VFF (vff.no) | Norwegian mutual-fund NAVs (Alfred Berg, Heimdal — unpriced today) | Unverified | Needs a look |
| FMP / Finnhub free tiers | US-only / fundamentals mostly paywalled | Free tier limited | Not recommended |

## Known ongoing issue

No session's shell — cloud or the one on Faiz's linked device — has had GitHub push credentials
configured (`git push` fails with `could not read Username for 'https://github.com'`). Commits so
far in the repo were pushed by Faiz himself from his own terminal/GitHub Desktop between sessions.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-22 | Setup checklist confirmed | Faiz confirmed: pushed + Railway redeploy done (full data wipe ran), 5 CSVs re-uploaded with real yfinance tickers, `GOOGLE_AI_STUDIO_API_KEY`/`FRED_API_KEY` set in `.env` and Railway. Clarified the only valid provider values (`MARKET_DATA_PROVIDER=yfinance`, `RESEARCH_PROVIDER=gemini_search`) — still open. Added a free-data-source backlog table. Docs only, no code. | [free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-22 | Account rename, lost position data (`last_price`/`market_value_nok`), Macro page slowness | Frontend: account rename UI + optional name-on-upload field; new expandable positions table on the Portfolio page (quantity, GAV, cost basis, last price, market value, weight — previously shown nowhere). Backend: migration `a2b4c6d8e0f1` adds `last_price`/`market_value_nok` to `portfolio_positions` (parsed from every CSV row since day one, never persisted until now); wired the previously-dead `DailyBudgetGuard` into both Gemini-calling providers so an exhausted daily quota fails in milliseconds instead of 45-60+ seconds of pacing+retry. 333/333 backend tests passing (7 new), ruff/tsc/eslint/vite build all clean. Committed locally, not pushed, not deployed. | [account-name-position-data-macro-speed-2026-09-22.md](account-name-position-data-macro-speed-2026-09-22.md) |
| 2026-09-21 | CSV import ticker/duplicate-holding fixes, manual-edit UI, full data wipe | Fixed the CSV-import 500 (quality_flags shape coercion), the duplicate-holding/garbage-ticker bug (name-normalized matching, transliterated/collision-safe placeholder tickers), added inline Ticker/Sector/Instrument-Type editing (`PATCH /holdings/{id}`, `GET /holdings/field-options`, canonical sector list). At Faiz's explicit request after being told the cost, wrote (not yet run) a migration that fully wipes Supabase on next deploy. 326/326 backend tests passing (17 new), ruff/tsc/eslint/vite build all clean. | [csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md](csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md) |
| 2026-09-21 | CSV import 500 fixed: object-storage provider alias | `POST /portfolio/import-csv` was 500ing on every request (`get_object_storage()` dependency raising `NotImplementedError` for `OBJECT_STORAGE_PROVIDER=supabase`, before the route ever ran). Made `"s3"`, `"r2"`, and `"supabase"` all build the same `S3ObjectStorageProvider` (they're all S3-compatible), matching what `.env.example` already implied was valid. Clarified 3 stale comments, added 5 regression tests (249/249 unit tests pass). Committed (`72e7ed9`), not pushed, not deployed — Railway's env var needs no change, just a push + redeploy. | — |
| 2026-09-21 | Portfolio delete: second cascade bug + free-provider research | Fixed `DELETE /portfolio/all` / `DELETE /portfolio/snapshots/{id}` 500ing when a legacy `portfolio_risk_snapshots` row was attached (missed by the original cascade-delete fix) — new purge-only model, updated `_purge_legacy_analysis`, schema/frontend count surfaced, 2 new regression tests (309 total passing). Also wrote up a free market-data/research provider proposal doc (SEC EDGAR + Oslo Børs Newsweb as top picks) — research only, no code. | [free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-21 | **Sprint 4 backend: the two-pass Buffett/Munger analysis engine** | Built the evidence packet (reusing Sprint 2 research + Sprint 3 valuation + Sprint 1 calculations unchanged), the versioned output schema and prompts, the blind pass, the reconciliation pass (notes-aware, optional notes), the orchestration pipeline (equity-type gating, LLM fallback, deterministic DCF-derived price target), per-holding notes CRUD, and the `/analysis` API. New tables `equity_analysis_runs`/`equity_holding_notes` (migration `b5e1a9c3d7f2`) — a fresh schema, not an extension of the legacy Phase-3 analysis tables. 19 new tests (307 total), ruff clean. Discovered: manually-created holdings default to a non-analyzable `asset_class_raw`, flagged above. Frontend deliberately deferred. Not yet run against a real LLM call or real data. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio delete fixes, page-load speed, first portfolio-level chart, whisky grouping | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 closed: frontend valuation UI | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 backend: valuation engine | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 closed: frontend research UI | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio CSV import + delete UI (pulled forward from Sprint 4) | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 started: live research (macro/sector/company) | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Minimal API + first frontend pages (Sprint 1 closed) | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Document ingestion (Sprint 1) | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 closed + Sprint 1 start | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | See the sprint plan doc for full detail. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history. Earlier session summaries in this table were condensed
2026-09-21 to keep this page scan-able — full detail for each remains in the sprint plan doc's own
"Changes / history" table, which is not condensed.*
