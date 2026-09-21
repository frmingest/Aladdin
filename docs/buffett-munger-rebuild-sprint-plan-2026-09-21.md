# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** [buffett-munger-redesign-sprint-plan-2026-09-20.md](buffett-munger-redesign-sprint-plan-2026-09-20.md).
That doc planned an *incremental* redesign (ADR 0019/0020: "continue & consolidate, no rebuild").
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0, Sprint 1, and Sprint 2 are all closed.** **Sprint 3's
backend (the valuation engine) is now also closed** — DCF/reverse-DCF/multiples all built and wired
into a `/valuation` API against live market data; its **frontend is deferred to a follow-up
session** by Faiz's own choice. Numeric macro data and a background scheduler remain **deliberately
deferred** out of Sprint 2 — see the Backlog section below for where that work now sits.
Separately, portfolio CSV import + delete UI (originally slated for Sprint 4) was pulled forward and
is done.

## Where things actually stand right now (audited 2026-09-21, ninth session pass)

| | |
|---|---|
| Repo | `main`, commit `816127b` ("Add valuation API endpoints tying DCF/multiples to live market data") — **6 commits this session, not pushed** — `git push` fails from this session's shell with `could not read Username for 'https://github.com'`, confirmed by an actual attempt this session, same limitation every prior session hit. Everything through `20d76c1` has been confirmed pushed. |
| **Sprint 3 backend closed this session — valuation engine built and wired to a live-data API.** | Live market data (yfinance: price, price history, FX, beta), a live risk-free rate for any currency (FRED, OECD long-term govt bond series), versioned valuation assumptions, the deterministic DCF/reverse-DCF/CAPM engine, multiples-over-time, and the orchestration layer that ties them together for one real holding (including live FX conversion for holdings that trade in a different currency than they report in) — all wired into `GET`/`POST .../refresh` on `/valuation/holdings/{id}`. |
| `app/providers/yfinance_provider.py`, `fred_risk_free_rate_provider.py` | **New this session.** Defensive 3-path price/currency fallback for yfinance (`fast_info` → `.info` → `.history()` with a currency hint) given yfinance's own history of breaking `fast_info` across releases; FRED covers risk-free rates for every currency needed (USD/NOK/EUR/GBP) via its own republished OECD series, avoiding a second Norges-Bank-specific integration. |
| `app/services/market_data/` | **New this session.** Staleness-cached price/FX/risk-free-rate services, generalized from Sprint 2's research-caching pattern (`app/services/research/common.py`) via a shared `get_or_refresh()` — a provider failure never loses a working (now-stale) cached value. |
| `app/domain/valuation_assumptions/v1.py` | **New this session.** Versioned, not hardcoded: 4.5% equity risk premium for USD/EUR/GBP/NOK (5.5% default for anything else), 2.5% terminal growth, ±3% bull/bear growth offsets off the base CAGR, default beta 1.0 when a provider can't supply one. |
| `app/services/valuation/{dcf,discount_rate,growth,multiples}.py`, `holding_valuation.py` | **New this session.** DCF discounts *owner earnings* (Buffett's concept — net income + D&A − capex − ΔWC), not FCFF/WACC; reverse DCF solves for implied growth via bisection (no closed form once terminal value is in the mix); the orchestration layer degrades only the affected part of a result (missing risk-free rate → DCF unavailable; missing FX → margin-of-safety/reverse-DCF skipped but DCF scenarios still computed; <2 periods of owner-earnings history → DCF unavailable) rather than failing the whole response, per CLAUDE.md's fail-visibly discipline. |
| `app/api/valuation.py`, `app/schemas/valuation.py` | **New this session.** Mirrors `/research/*`'s shape exactly: `GET` serves fresh-or-refreshed, `POST .../refresh` forces a live re-pull. |
| Deployment | **Not deployed to Railway.** Still "written, not yet deployed" per the status-honesty rule — no Railway CLI session or config found in the repo this session either. |
| Real data | **Still untouched.** Portfolio CSV import (prior session) still not yet run against Faiz's real 5 account CSVs or the real Supabase DB; needs his go-ahead first. |
| Test environment | Backend: same fresh-Linux-venv-per-session limitation as always — **286 tests, all passing** (274 before this session's own +12 across the last unit of work; 88 new tests total across all 6 of this session's commits). `ruff check` on `backend/`: pre-existing `EXE002` (file-permission artifact, confirmed every session, 143 currently) + pre-existing `I001` in `alembic/versions/*.py` migration files (13 currently, including this session's own new migration, consistent with the other 12 predating this rebuild) — neither touches app code, both unrelated to this session's changes. Frontend: unchanged this session (backend-only, by Faiz's choice). |
| **Discovered this session, not fixed** | The real (gitignored) `backend/.env` has `MARKET_DATA_PROVIDER=stub` and `RESEARCH_PROVIDER=stub` — neither is an implemented provider in `app/providers/factory.py`. Running the backend right now would immediately break both the new `/valuation/*` feature and the already-shipped `/research/*` feature with an "Unknown ... provider" error. Left untouched (real config only ever lives in `backend/.env`, never edited by an agent session per CLAUDE.md) — flagged to Faiz in `progress.md`'s "Needs from Faiz" table. |
| Known gap | Numeric macro data (FRED/Norges Bank → `macro_observations`) and a background scheduler are both still deliberately deferred — see "Backlog" below. Frontend valuation UI (DCF/reverse-DCF/multiples on `HoldingDetailPage`) is the immediate next step, deferred out of this session by Faiz's own choice. |

## The Brain's 5 steps — what the rebuild has to deliver

| Step | What it asks for |
|---|---|
| Opening | Live macro/geopolitical research (rates, inflation, conflicts, currencies, regulation, sector trends — the Iran/energy example), per portfolio and per holding |
| 1. Business Quality & Moat | Circle of competence summary, moat rating (Wide/Narrow/None across brand, pricing power, switching costs, network effects, cost advantage, IP, distribution), 3-5yr avg ROIC/ROE/margins vs. a hurdle (~15%) |
| 2. Financial Fortress | Net Debt/FCF, Net Debt/EBITDA, interest coverage, D/E; owner earnings/FCF trend vs. net income; earnings quality (one-offs, SBC, cyclical distortion) |
| 3. Macro & Industry Stress Test | Rate sensitivity, inflation/demand/pricing-power sensitivity, geopolitical/regulatory/commodity/FX/supply-chain risk, cyclical positioning vs. normalized earnings |
| 4. Valuation & Margin of Safety | Multiples vs. history/peers, DCF (base/bull/bear), reverse DCF (implied growth from price), margin of safety |
| 5. Verdict | Strong Buy/Buy/Hold/Sell/Avoid, 3-bullet thesis, top-2 downside risks, price target range, 3-5 metrics to monitor, what would change the thesis |

Sprint 2 covers the Opening step's macro/geopolitical and per-company research, plus the
sector-level input Step 3.3 needs. **Sprint 3's backend (this session) covers Step 4** — multiples,
DCF, reverse DCF and margin-of-safety are all now computed against live data, per holding. None of
this is yet wired into an `AnalysisContext`/evidence-packet, since the analysis engine itself is
Sprint 4. Sprint 4's analysis engine is expected to run only against holdings tagged
`stock`/`equity_etf` (`app/domain/instrument_types.EQUITY_ANALYZABLE_TYPES`) — the portfolio-import
work done in a prior session tags every holding's real instrument type precisely so that filter is
possible then.

## Non-negotiable design rules

The repo's `CLAUDE.md` — 5 rules (deterministic arithmetic, evidence-first citations, versioned
prompts/schemas, blind-pass confirmation-bias guard, untrusted document text) plus git/status-honesty/
secrets discipline.

## Open checkpoints — all resolved

| # | Question | Decision |
|---|---|---|
| 1 | DB schema strategy | **Leave the existing Supabase schema and data exactly as-is.** No migration to strip non-equity tables/columns now. |
| 2 | LLM provider | **Reuse Google AI Studio (Gemini) + Mistral** via keys in `backend/.env`/Railway. Rate-limit resilience built in from day one — done. |
| 3 | Leftover GitHub branches | **Deleted** — confirmed gone from `origin` (`git ls-remote --heads origin` shows only `main`). |
| 4 | Portfolio position entry: require a real document, or allow manual entry? | **Require a real uploaded document** (`source_file_id`, `NOT NULL`) for every portfolio snapshot — asked Faiz directly, he chose traceability over convenience. |
| 5 | Sprint 2 research vendor | **Gemini + Google Search grounding**, reusing the Google AI Studio key/infra rather than a second vendor account — mirrors the pre-reset build's own Phase 4 decision, ported forward rather than re-litigated. |
| 6 | Portfolio CSV import: skip non-equity rows (bond funds, gold ETC) or import everything? | **Import every row, tagged with its real instrument type** (`asset_class_raw`) — asked Faiz directly (his real exports mix equities with bond/money-market funds and a physical gold ETC); he chose accurate portfolio composition over silently narrowing to equities. |
| 7 | Same upload batch included a whisky/collectibles CSV — support it too? | **No — skipped**, out of scope for this equity-only rebuild, consistent with Decision 1. |
| 8 | Portfolio delete UI: granular only, or add a bulk "delete everything"? | **Granular only** — expose the existing per-account/per-snapshot confirm-gated deletes in the UI; no new bulk-wipe endpoint. |
| 9 | Sprint 2 next-phase scope | Faiz chose **"finish Sprint 2: research UI"** over also building the deferred numeric-macro/scheduler items, or skipping ahead to Sprint 3. |
| 10 | Sprint 3 market/FX/beta data source | **yfinance** (Recommended option) — free, no separate account setup needed for a personal single-user app. |
| 11 | Sprint 3 discount-rate methodology | **Live risk-free rate + a versioned equity-risk-premium assumption** (CAPM) (Recommended option) — not a single hardcoded discount rate. |
| 12 | Sprint 3 session scope | **Backend only this session** (Recommended option) — frontend valuation UI deferred to a follow-up session. |

## Actual current Supabase schema (read from `backend/alembic/versions/`, 21 tables + 1 new this session, no live DB connection needed)

No non-equity table exists — the old multi-asset design used a discriminator, not separate tables:
`holdings.asset_class` (string column) and `portfolio_positions.acquired_at` (nullable, added for
collectibles) are the only non-equity-specific fields, both on otherwise-shared, otherwise-equity
tables. Nothing to route around structurally — just don't populate/query those for non-equity rows.
(`holdings.asset_class_raw` is the *other* legacy column — always-writable, not NOT-NULL-constrained
to "equity" — now used by the portfolio-import feature to carry the real instrument type; see
Decision 6 above.)

| Table | From phase |
|---|---|
| `accounts`, `holdings`, `portfolio_positions`, `portfolio_snapshots`, `documents`, `document_pages`, `document_chunks`, `financial_line_items` | Phase 1 (portfolio + document ingestion) + accounts migration — **ORM models, document ingestion, full CRUD, the first frontend pages, and CSV import all done this rebuild** |
| `market_observations`, `fx_observations` | Phase 2 (market data & FX) — **ORM models + staleness-cached live services built this session (Sprint 3)**, used by the valuation engine's price/FX lookups |
| `risk_free_rate_observations` | **New table + migration this session (Sprint 3)** — not part of the original pre-reset schema; needed for the CAPM discount-rate methodology (Decision 11 above) |
| `analysis_runs`, `holding_analyses`, `factor_assessments`, `evidence_references` | Phase 3 (AI analysis engine) — not yet built this rebuild |
| `research_runs`, `research_items` | Phase 4 (external research) — **ORM models, provider, caching service, API, and frontend UI all done this rebuild (Sprint 2, now closed)** |
| `macro_observations` | Phase 4 (numeric central-bank/macro data) — **deliberately deferred**, see Backlog |
| `investment_theses`, `valuation_cases`, `portfolio_risk_snapshots` | Phase 5 (thesis & portfolio intelligence) |
| `llm_usage_events` | LLM usage ledger — not yet re-created this rebuild; `app/providers/budget.py`'s in-memory guard is a placeholder until this exists |

## Design & UX direction (researched 2026-09-21; tokens implemented in `frontend/tailwind.config.js`)

Faiz asked for a deliberate look this time: *"a simple philosophy... what investment-grade
financial webpage has a clean, simple and beautiful UI that is popular."*

**What "investment-grade, clean, simple, beautiful" actually looks like in practice** (from a
survey of fintech dashboards actually praised for this — Mercury, Stripe's own dashboard, Ramp,
Wealthfront, plus wider 2026 fintech UI roundups):

| Principle | What it means concretely |
|---|---|
| **Color means state, nothing else** | Green/red reserved strictly for gain/loss and pass/fail signals (moat rating, verdict, thesis status). No decorative gradients or brand color inside data areas. One quiet accent color for interactive elements only. |
| **Numbers are typeset, not just printed** | Tabular figures (fixed-width digits so columns of numbers align), consistent decimal places, currency symbols set lighter/smaller than the value itself. |
| **Editorial calm over data density** | Generous whitespace, one clear focal number per section, routine detail collapsed by default. |
| **Progressive disclosure** | Summary first (portfolio verdict, moat, valuation at a glance), detail on demand (drill into a holding for the full 5-step Brain analysis, evidence citations, DCF assumptions). |
| **Left-nav information architecture** | Scales to many domains (portfolio, holdings, thesis, macro, valuation) without the top-nav running out of room. |
| **Light-first, not dark-terminal** | Every example above is light/near-white with near-black text. Dropping the terminal aesthetic for good this time. |

**Tokens (implemented in `frontend/tailwind.config.js` — `background`, `surface`,
`border`/`border-subtle`, `ink`/`ink-muted`/`ink-faint`, `accent`/`accent-hover`/`accent-subtle`,
`positive`/`negative`/`caution` each with a `-subtle` background variant, plus `.tabular` for
`font-variant-numeric: tabular-nums`):**

- Background near-white (`#FAFAF9`), surfaces (cards) pure white.
- Text near-black (`#111111`), muted warm gray for secondary text — not pure `#000`.
- One accent (`#2563EB`, a calm blue — Faiz hasn't specified a preference beyond "one quiet accent
  color," so this is a reasonable, unconfirmed default; easy to swap in one file if he wants
  something else).
- Green/red/amber only for state (document status badges, gains/losses once those exist, pass/fail
  once the moat rating exists).
- System font stack (no external font request); `Inter` is named first for whenever it's actually
  loaded.
- Fixed left nav, holding list/detail built as cards over the near-white background. The Portfolio
  and Macro/Sector pages follow the same card/table conventions.

Sprint 3's valuation UI (next step) and Sprint 5's dashboard are where this direction gets exercised
across the remaining domains.

## Sprints

### Sprint 0 — Foundation — ✅ closed 2026-09-21

All items done — see prior session detail in the project's `progress.md`.

### Sprint 1 — Equity data model & deterministic calculations — ✅ closed 2026-09-21

| Deliverable | Detail | Status |
|---|---|---|
| SQLAlchemy models | `Account`, `Holding`, `PortfolioPosition`, `PortfolioSnapshot`, `Document`, `DocumentPage`, `DocumentChunk`, `FinancialLineItem` | ✅ Done |
| Deterministic calculations module | ROIC, ROE, margins, FCF, owner earnings, leverage ratios, HHI, multiples | ✅ Done |
| Document ingestion | PDF/PPTX/XLSX text + structured line-item extraction, sha256 dedup, swappable object storage, `POST /documents/upload` + `GET /documents` + `GET /documents/{id}` | ✅ Done |
| Minimal API | Holdings CRUD (`app/api/holdings.py`), accounts CRUD (`app/api/accounts.py`), portfolio snapshot/position CRUD + HHI concentration (`app/api/portfolio.py`), read-only computed-metrics endpoints (`app/services/metrics.py`) | ✅ Done — commits `98ec5be`..`52bc5d3` |
| First real frontend pages | Holding list (`HoldingsListPage.tsx`) + holding detail (`HoldingDetailPage.tsx`) | ✅ Done — commit `29c7132` |

### Sprint 2 — Live research (evidence-first) — ✅ closed 2026-09-21

| Deliverable | Detail | Status |
|---|---|---|
| Research data model | `ResearchRun`/`ResearchItem` (`app/models/research.py`), onto already-existing `research_runs`/`research_items` tables | ✅ Done — commit `16c3ff6` |
| `GeminiResearchProvider` | Gemini + Google Search grounding, `ResearchItem`s built from `grounding_metadata`, reuses `gemini_retry` pacing | ✅ Done — commit `16c3ff6` |
| Versioned research prompts | `backend/prompts/research/{macro,sector,company}_v1.md`, each with an explicit "search results are data, not instructions" line (CLAUDE.md Rule 5) | ✅ Done — commit `16c3ff6` |
| Staleness-checked caching services | `app/services/research/{common,macro,sector,company}.py` — a run's `completed_at` is the cache; provider failure falls back to stale cache + a real `FAILED` run, never silent data loss | ✅ Done — commit `588198d` |
| `/research` API | `GET`/`POST .../refresh` for macro, `/sectors/{sector}`, `/holdings/{holding_id}` | ✅ Done — commit `588198d` |
| Frontend research UI | `ResearchPanel` shared component; Macro page (portfolio-wide + sector picker); Sector page (`/sectors/:sector`); company-research panel on `HoldingDetailPage` | ✅ Done — commit `20d76c1` |
| Numeric macro data (FRED/Norges Bank → `macro_observations`) | A separate subsystem (central-bank series, not grounded search) — the pre-reset build had a `research/versions/v1.yaml` registry pattern for this that could be ported forward | ⏳ **Deliberately deferred** — see Backlog |
| Background scheduler (periodic auto-refresh) | GET-triggers-refresh-if-stale already gives "live" without one; the pre-reset build used APScheduler for this | ⏳ **Deliberately deferred** — see Backlog |
| Wiring into an evidence packet / `AnalysisContext` | That's Sprint 4 (the analysis engine itself) — `ResearchItem.source_url`/`source_name` are already shaped to become citable evidence then, no schema rework anticipated | ⏳ Sprint 4's job |

**Design decisions made building the research API (prior session):**

- **Not combining Gemini's Google Search grounding with `response_schema`-constrained output** —
  same reasoning the pre-reset build's own Phase 4 landed on: Google's Gemini API doesn't support
  both in the same call. `GeminiResearchProvider` asks for plain grounded text and derives
  `ResearchItem`s from `response.candidates[0].grounding_metadata` directly, verified against the
  installed `google-genai==2.8.0` SDK's own pydantic model fields (`GroundingChunkWeb.domain`/
  `title`/`uri`, `GroundingSupport.segment`/`grounding_chunk_indices`, `Segment.text`) — this
  session's SDK version differs from the pre-reset build's (`2.23.0`), so the field set was
  re-verified from scratch rather than assumed to match.
- **A `ResearchRun`'s own `completed_at` is the cache** (no separate cache layer, no scheduler) —
  simpler than the pre-reset build's APScheduler approach and sufficient for a single-user,
  not-always-running dev app; a scheduler can be added later without changing this.
- **A provider failure never loses working data.** `get_or_refresh()` always persists a real
  `FAILED` `ResearchRun` (fail visibly, CLAUDE.md), but if a prior `COMPLETED` run exists it still
  returns those (now-stale) items with an explicit `reason` — a temporary Gemini outage shouldn't
  blank a page that had real data on it a moment ago. The frontend `ResearchPanel` surfaces this
  `reason` directly rather than hiding it.
- **Numeric macro data (FRED/Norges Bank) and the scheduler were explicitly scoped out** of the
  research-API session, rather than attempted partially — the numeric-series subsystem is a distinct
  enough piece of work (a new registry file family, two more vendor integrations,
  `MacroDataProvider` as a *separate* interface from `ResearchProvider`) that it deserves its own
  session rather than a rushed partial port from the pre-reset build's
  `archive/main-before-wipe-2026-09-20` branch.

**Frontend UI decisions made building the research UI:**

- **Sector research has no dedicated top-level nav item.** There's no "all sectors" endpoint — only
  per-sector research scoped to a sector actually held — so a standalone nav entry would either need
  its own sector-enumeration logic duplicated from the Macro page or list sectors nobody holds.
  Reached instead from Macro's sector chips and from a holding's own sector link on
  `HoldingDetailPage`.
- **Company research got its own section on `HoldingDetailPage`** (next to Metrics and Documents)
  rather than a separate route — it's holding-scoped the same way those two already are, and this
  keeps everything about one holding on one page rather than splitting research out across another
  click.

### Portfolio CSV import + delete UI — ✅ done 2026-09-21 (pulled forward from Sprint 4)

| Deliverable | Detail | Status |
|---|---|---|
| Broker-CSV parser | `app/services/portfolio_import/csv_parser.py` — BOM-sniffed UTF-16/utf-8-sig decode, tab-delimited, header-name column matching, Norwegian decimal comma, account number parsed from the filename | ✅ Done |
| Instrument-type classifier | `app/domain/instrument_types.py` — name-based heuristic (stock / equity_etf / bond_fund / money_market_fund / commodity_etc), tags `Holding.asset_class_raw` | ✅ Done |
| CSV import ingestion service | `app/services/portfolio_import/ingestion.py` — traceable `Document` + find-or-create `Account`/`Holding`s (deduped by name) + `PortfolioSnapshot`/`PortfolioPosition`s, all in one transaction | ✅ Done |
| `POST /portfolio/import-csv` API | `app/api/portfolio.py` | ✅ Done |
| Frontend Portfolio page | `frontend/src/pages/PortfolioPage.tsx` — multi-file CSV upload, accounts list + snapshots list each with a delete button (existing confirm-gated endpoints, exposed in the UI for the first time), nav enabled | ✅ Done |

Commit `2cb56c7`, confirmed pushed. 25 new tests (198 total), ruff clean. Frontend lint/build clean.
Not yet run against Faiz's real 5 account CSVs or the real Supabase DB.

### Sprint 3 — Valuation engine — ✅ backend closed 2026-09-21, frontend next

| Deliverable | Detail | Status |
|---|---|---|
| Live market-data providers | `app/providers/yfinance_provider.py` — current price, price history, FX rate, beta; defensive 3-path fallback (`fast_info` → `.info` → `.history()`) given yfinance's own history of breaking attribute shapes across releases | ✅ Done — commit `9571fe8` |
| Live risk-free-rate provider | `app/providers/fred_risk_free_rate_provider.py` — FRED's own republished OECD long-term government bond yield series covers every currency needed (USD/EUR/GBP/NOK), avoiding a second Norges-Bank-specific integration | ✅ Done — commit `9571fe8` |
| New models + migration | `MarketObservation`, `FxObservation` (onto the already-existing Phase 2 tables), `RiskFreeRateObservation` (new table, new migration `a4c9f7e2b6d1`) | ✅ Done — commit `9571fe8` |
| Staleness-cached market-data services | `app/services/market_data/{common,price,fx,risk_free_rate}.py` — generalizes Sprint 2's `get_or_refresh()` pattern; a provider failure falls back to the latest cached observation with a `reason`, never a bare crash | ✅ Done — commit `1058b39` |
| Versioned valuation assumptions | `app/domain/valuation_assumptions/v1.py` — 4.5% ERP (USD/EUR/GBP/NOK), 5.5% default ERP, 2.5% terminal growth, ±3% bull/bear growth offsets, default beta 1.0 | ✅ Done — commit `64ebf2d` |
| Deterministic DCF / reverse-DCF / CAPM engine | `app/services/valuation/{dcf,discount_rate,growth}.py` — discounts *owner earnings* (net income + D&A − capex − ΔWC), Gordon Growth terminal value, reverse DCF via bisection search (no closed form once terminal value is in the mix) | ✅ Done — commit `2e65408` |
| Multiples-over-time | `app/services/valuation/multiples.py` — P/E, P/B, P/S, EV/EBITDA per period, matched against the nearest price observation | ✅ Done — commit `0fd795d` |
| Orchestration + currency handling | `app/services/valuation/holding_valuation.py` — ties live data + assumptions + the calc modules together for one holding; converts the live price into the filing's currency via live FX when a holding trades in a different currency than it reports in (e.g. a Norway-listed company reporting in USD) | ✅ Done — commit `816127b` |
| `/valuation` API | `app/api/valuation.py` — `GET`/`POST .../refresh` on `/valuation/holdings/{id}`, mirrors `/research/*`'s shape exactly | ✅ Done — commit `816127b` |
| **Frontend valuation UI** | DCF scenarios, reverse DCF, margin of safety, multiples-over-time chart on `HoldingDetailPage` | ⏳ **Not started — next step** (Faiz's own choice: backend only this session) |

**Design decisions made building the valuation engine this session:**

- **Owner earnings, not FCFF/WACC.** The DCF discounts Buffett's "owner earnings" concept (net
  income + D&A − maintenance capex − ΔWC), consistent with this app's whole Buffett/Munger framing,
  rather than a textbook FCFF/WACC model.
- **CAPM cost of equity, not a single hardcoded discount rate.** `risk_free_rate + beta ×
  equity_risk_premium`, with the risk-free rate live (FRED) and beta live (yfinance, falling back to
  a versioned default when the provider can't supply one) — Decision 11 above.
- **FRED alone covers every currency needed**, rather than a second Norges-Bank integration for NOK
  — verified via FRED's own official series pages that it republishes OECD long-term government bond
  yield data for Norway/Euro area/UK under the `IRLTLT01<CC>M156N` series pattern.
- **Reverse DCF has no closed-form solution** once a multi-year projection plus a Gordon Growth
  terminal value are both in play, so `reverse_dcf_implied_growth()` solves for the growth rate that
  reproduces the current price via bisection search instead.
- **Currency consistency is handled explicitly, not assumed away.** A holding's filing currency
  (`FinancialLineItem.currency`) and its trading currency (`Holding.trading_currency`) can differ —
  the orchestration layer fetches the risk-free rate for the *filing* currency and converts the live
  price into it via a live FX rate before computing margin of safety or the reverse DCF, rather than
  silently mixing currencies.
- **Every live-data failure degrades only the affected part of the result**, per CLAUDE.md's
  fail-visibly discipline: no risk-free rate → DCF unavailable entirely (recorded in
  `unavailable_reasons`); no FX rate → margin-of-safety/reverse-DCF skipped but DCF scenarios are
  still computed without a price; fewer than two periods of complete owner-earnings inputs → DCF
  unavailable but multiples-over-time (which doesn't depend on DCF) still computes. Nothing 500s on a
  live-data hiccup.

**Bug caught by testing, fixed this session:** the orchestration layer computed
`current_price_per_share` for internal use (feeding it into the DCF/reverse-DCF calls) but never
actually attached it to the result object returned to the API — caught by a unit test asserting the
field directly, not by the integration test alone. Fixed before committing; both the 7 new unit
tests and the 5 new integration tests pass.

### Sprint 4 — The Buffett/Munger persona & output schema (the centerpiece)

- Output schema: moat rating + sub-dimensions, capital efficiency vs. hurdle, balance-sheet health,
  cyclicality, reverse DCF, verdict, price target range, key metrics to monitor, invalidation
  triggers
- Two-pass pipeline: blind pass (no user notes, evidence-cited) → reconciliation pass
- Covers Step 5 and closes every remaining schema gap from Steps 1-4
- This is also where PDF/PPTX table-parsing or an LLM extraction pass (to get structured facts out
  of those formats, not just XLSX) most naturally belongs, if Faiz wants that filled in before then
- Wires Sprint 2's research items and Sprint 3's valuation output into the evidence packet as
  citable `EvidenceItem`s
- The analysis engine itself should only ever run against holdings where
  `asset_class_raw in EQUITY_ANALYZABLE_TYPES` (stock, equity_etf) — a bond fund or a physical gold
  ETC has no moat/ROIC/owner-earnings to assess

**Real broker-export parsing — ✅ done ahead of schedule, 2026-09-21** (see the Sprints section's
own "Portfolio CSV import + delete UI" entry above). This was originally planned as part of
Sprint 4; Faiz asked for it pulled forward on its own, independent of the rest of Sprint 4's scope
(the analysis engine itself is still not started).

### Sprint 5 — Portfolio roll-up & dashboard

- Aggregate verdict/moat/valuation view across all holdings
- Single-purpose dashboard (equity only), built out fully against the Design & UX direction above
- Deterministic executive summary

### Sprint 6 — Evidence quality

- Per-document evidence budget, section-aware chunking (current ingestion is 1 page = 1 chunk)

### Sprint 7 — Guardrail tooling

- Pre-commit hooks, CI workflow, secret-scanning
- Also a natural place for a frontend test framework (Vitest/RTL) if one still doesn't exist by then

## Backlog — candidate future phases (beyond Sprint 7)

Not yet scheduled or asked for — flagged here so they're visible when planning what comes after
Sprint 7, rather than getting lost. Ordered roughly by what naturally unblocks what, not by
priority — that's Faiz's call.

| Candidate | What it would deliver | Why it's not scheduled yet |
|---|---|---|
| **Numeric macro data & scheduler** | FRED/Norges Bank central-bank series ingestion into `macro_observations`, a `MacroDataProvider` interface (separate from `ResearchProvider`), and optionally a background scheduler for periodic auto-refresh across all three research kinds | Explicitly deferred out of Sprint 2 twice now as its own distinct subsystem (new registry file family, two more vendor integrations) — ready to pick up whenever Faiz wants it, doesn't block anything else |
| **Portfolio risk & regime intelligence** | Correlation/factor exposure across holdings, drawdown scenarios, rebalancing flags, populating `portfolio_risk_snapshots` (Phase 5 table already exists, unused) | Most naturally builds on Sprint 5's dashboard and Sprint 3's valuation numbers existing first — Sprint 3's backend is now done, so this is closer to ready |
| **Investment thesis tracking** | Persist a written thesis per holding (`investment_theses`, `valuation_cases` — Phase 5 tables already exist, unused); track the Step 5 "what would change the thesis" triggers and flag when new research/financials suggest one fired | Depends on Sprint 4's verdict/thesis output schema existing first |
| **Historical price/FX & performance tracking** | Daily P&L, benchmark comparison, position-level return, now that `market_observations`/`fx_observations` are actively populated by Sprint 3's live-price/FX lookups | Sprint 3 built the ingestion path for current snapshots; historical backfill/performance tracking on top of it is still unscheduled |
| **LLM usage ledger & cost observability** | Persist real `llm_usage_events` rows (table exists, unused) instead of `app/providers/budget.py`'s in-memory placeholder guard; a simple spend view | Low-risk, could be pulled forward any time Faiz wants real budget visibility rather than the in-memory placeholder |
| **Alerts & notifications** | Notify (email/push) when a thesis-invalidation trigger fires, a material new research item lands, or research goes stale past a threshold | Needs thesis tracking built first as the thing being watched |
| **Reporting & export** | One-holding or whole-portfolio PDF/print view of an analysis run; tax-lot-aware export | Natural once Sprint 4's analysis output actually exists to export |
| **Fix GitHub push credentials** (ops, not a feature) | A PAT or credential-helper set up on Faiz's side so sessions (cloud and linked device alike) can push directly, instead of every session's commits sitting local until he pushes them by hand | Not a build task for an agent session — needs a decision/action from Faiz outside the repo; flagged because it's hit identically in every session's history above |

## Changes / history

| Date | Summary |
|---|---|
| 2026-09-21 | **Sprint 3 backend closed: valuation engine.** Built live market-data providers (yfinance) and a live risk-free-rate provider (FRED, all currencies), staleness-cached market-data services, versioned valuation assumptions, the deterministic DCF/reverse-DCF/CAPM discount-rate engine, multiples-over-time, and the orchestration layer (with live-FX currency-consistency handling) tying it all together for one holding — wired into a new `/valuation` API mirroring `/research/*`'s shape. 88 new tests (286 total), ruff clean apart from pre-existing noise. 6 commits (`9571fe8`..`816127b`), local only — `git push` still fails in this shell. Discovered (not fixed): real `.env` has `MARKET_DATA_PROVIDER=stub`/`RESEARCH_PROVIDER=stub`, flagged to Faiz. Frontend valuation UI deliberately deferred to a follow-up session (Faiz's choice, made via clarifying questions before building). |
| 2026-09-21 | **Sprint 2 closed: frontend research UI.** Built the frontend for the `/research/*` API: a shared `ResearchPanel` component, a Macro page (portfolio-wide research + a sector picker), a Sector page (`/sectors/:sector`), and a company-research panel added to `HoldingDetailPage`. "Macro" is now a live nav item. No backend changes — 198 backend tests unaffected/still passing; frontend `tsc`/`eslint`/`vite build` all clean. 1 commit (`20d76c1`), since confirmed pushed. |
| 2026-09-21 | **Portfolio CSV import + delete UI, pulled forward from Sprint 4.** Built the broker-export CSV parser, an instrument-type classifier for the mixed equity/bond/ETC rows these exports contain, the CSV→Account/Document/Snapshot/Position ingestion service, `POST /portfolio/import-csv`, and a new frontend Portfolio page (multi-file upload + account/snapshot lists with delete buttons). Faiz chose to import every row (tagged, not skipped), skip a whisky/collectibles CSV in the same upload batch entirely, and keep deletes granular rather than add a bulk wipe. 25 new tests (198 total), ruff clean. 1 commit (`2cb56c7`), since confirmed pushed. |
| 2026-09-21 | **Sprint 2 started.** Built the macro/sector/per-company live research vertical slice: `ResearchRun`/`ResearchItem` models, `GeminiResearchProvider` (Google Search grounding), versioned prompts, staleness-checked caching services, `/research` API. 26 new tests (173 total), ruff clean. 2 commits (`16c3ff6`, `588198d`), both since confirmed pushed. |
| 2026-09-21 | **Sprint 1 closed.** Minimal API (4 commits: holdings CRUD, accounts CRUD, computed-metrics endpoints, portfolio snapshot/position CRUD — the last requiring `POST /documents/upload` to accept portfolio-wide files with no single holding, per Faiz's explicit traceability-over-convenience decision) + first real frontend pages (1 commit: holding list + holding detail, `react-router-dom`, tokens from the Design & UX direction actually implemented in `tailwind.config.js`). 47 new tests this session (147 backend total), ruff clean; frontend lint/type-check/build all clean. 6 commits, since confirmed pushed by Faiz. |
| 2026-09-21 | Document ingestion built (Sprint 1's 3rd deliverable). Built `app/services/documents/`, swappable object storage, `app/config/database.py` (fixing a broken `alembic/env.py` import), and `app/api/documents.py`. 32 new tests, 109 total, ruff clean. Committed (`3ca7b68`), since confirmed pushed. |
| 2026-09-21 | Sprint 0 closed, Sprint 1 started. Built `app/providers/` (Gemini + Mistral), `app/models/`, `app/services/calculations.py`. 77 tests. Two commits, since confirmed pushed. |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research. Set the Design & UX direction (now implemented). |
| 2026-09-21 | Sprint 0 skeletons built: legacy frontend removed, skeleton FastAPI backend + React frontend. 3 commits, since confirmed pushed. |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped. |
| 2026-09-21 | Full repo reset + rebuild plan written. Committed and pushed as `8ad0221`. |
