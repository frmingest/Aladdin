# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** [buffett-munger-redesign-sprint-plan-2026-09-20.md](buffett-munger-redesign-sprint-plan-2026-09-20.md).
That doc planned an *incremental* redesign (ADR 0019/0020: "continue & consolidate, no rebuild").
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0, Sprint 1, and Sprint 2 are all closed** — equity data
model, deterministic calculations, document ingestion, the Minimal API, the first real frontend
pages, and the full live-research vertical slice (API + Macro/Sector/company-research frontend UI)
are all done. Sprint 3 (valuation engine) is next. Numeric macro data and a background scheduler
remain **deliberately deferred** out of Sprint 2 — see the Backlog section below for where that work
now sits. Separately, portfolio CSV import + delete UI (originally slated for Sprint 4) was pulled
forward and is done.

## Where things actually stand right now (audited 2026-09-21, eighth session pass)

| | |
|---|---|
| Repo | `main`, commit `20d76c1` ("Add frontend research UI: Macro, Sector, and per-holding company panels (Sprint 2 close)") — **1 commit this session, not pushed** — `git push origin main` fails from this session's shell with `could not read Username for 'https://github.com'`, confirmed by an actual attempt this session, same limitation every prior session hit. Everything through `7497e45` has been confirmed pushed (verified this session: `git status` showed `main` up to date with `origin/main` before this session's commit). |
| **Sprint 2 closed this session — frontend research UI built.** | The `/research/*` API (macro, sector, per-holding company) was built in a prior session; this session built and wired the frontend for it: a `ResearchPanel` shared component, a Macro page (portfolio-wide research + a sector picker built from sectors actually held), a Sector page (`/sectors/:sector`), and a company-research panel added to `HoldingDetailPage`. "Macro" is now a live nav item (was visible-but-disabled). |
| `frontend/src/components/ResearchPanel.tsx` | **New this session.** Shared list/refresh/status rendering for all three research surfaces — renders Gemini-grounded output as plain text data (CLAUDE.md Rule 5: LLM output is data to display, never instructions), always paired with its source link (CLAUDE.md Rule 2: evidence-first, always traceable). |
| `frontend/src/pages/MacroPage.tsx`, `SectorPage.tsx` | **New this session.** `/macro` and `/sectors/:sector` routes. |
| `frontend/src/pages/HoldingDetailPage.tsx` | **Updated this session.** New "Research" section (per-holding company research) and a sector-research link next to the deterministic-metrics section. |
| Deployment | **Not deployed to Railway.** Still "written, not yet deployed" per the status-honesty rule — no Railway CLI session or config found in the repo this session either. |
| Real data | **Still untouched.** Portfolio CSV import (previous session) has been built and tested against in-memory SQLite only — still not yet run against Faiz's real 5 account CSVs or the real Supabase DB; needs his go-ahead first. |
| Test environment | Backend: same fresh-Linux-venv-per-session limitation as always — **198 tests, all passing**, re-verified this session in a fresh venv (no backend code changed this session, so the count is unchanged from the prior audit). `ruff check` on `backend/`: 111 `EXE002` (pre-existing file-permission artifact, confirmed every session) + 12 `I001` (pre-existing, all in `alembic/versions/*.py` migration files predating this rebuild — not touched this rebuild, not app code). Frontend: `tsc --noEmit`, `eslint .`, and `vite build` all clean including the new research-UI files. |
| Known gap | Numeric macro data (FRED/Norges Bank → `macro_observations`) and a background scheduler are both still deliberately deferred — see "Backlog" below. |

## The Brain's 5 steps — what the rebuild has to deliver

| Step | What it asks for |
|---|---|
| Opening | Live macro/geopolitical research (rates, inflation, conflicts, currencies, regulation, sector trends — the Iran/energy example), per portfolio and per holding |
| 1. Business Quality & Moat | Circle of competence summary, moat rating (Wide/Narrow/None across brand, pricing power, switching costs, network effects, cost advantage, IP, distribution), 3-5yr avg ROIC/ROE/margins vs. a hurdle (~15%) |
| 2. Financial Fortress | Net Debt/FCF, Net Debt/EBITDA, interest coverage, D/E; owner earnings/FCF trend vs. net income; earnings quality (one-offs, SBC, cyclical distortion) |
| 3. Macro & Industry Stress Test | Rate sensitivity, inflation/demand/pricing-power sensitivity, geopolitical/regulatory/commodity/FX/supply-chain risk, cyclical positioning vs. normalized earnings |
| 4. Valuation & Margin of Safety | Multiples vs. history/peers, DCF (base/bull/bear), reverse DCF (implied growth from price), margin of safety |
| 5. Verdict | Strong Buy/Buy/Hold/Sell/Avoid, 3-bullet thesis, top-2 downside risks, price target range, 3-5 metrics to monitor, what would change the thesis |

Sprint 2 (now closed) covers the Opening step's macro/geopolitical and per-company research, plus the
sector-level input Step 3.3 needs — including its frontend surface. It is not yet wired into an
`AnalysisContext`/evidence-packet, since the analysis engine itself is Sprint 4. Sprint 4's analysis
engine is expected to run only against holdings tagged `stock`/`equity_etf`
(`app/domain/instrument_types.EQUITY_ANALYZABLE_TYPES`) — the portfolio-import work done in a prior
session tags every holding's real instrument type precisely so that filter is possible then.

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
| 9 | Sprint 2 next-phase scope (this session) | Faiz chose **"finish Sprint 2: research UI"** over also building the deferred numeric-macro/scheduler items, or skipping ahead to Sprint 3. |

## Actual current Supabase schema (read from `backend/alembic/versions/`, 21 tables, no live DB connection needed)

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
| `market_observations`, `fx_observations` | Phase 2 (market data & FX) — not yet built this rebuild |
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

Sprint 5 (the dashboard) is where this direction gets exercised fully across every domain.

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

**Frontend UI decisions made this session:**

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

### Sprint 3 — Valuation engine

- DCF (base/bull/bear), reverse DCF, discount rate from live risk-free rate/FX, multiples-over-time
- Covers Step 4

### Sprint 4 — The Buffett/Munger persona & output schema (the centerpiece)

- Output schema: moat rating + sub-dimensions, capital efficiency vs. hurdle, balance-sheet health,
  cyclicality, reverse DCF, verdict, price target range, key metrics to monitor, invalidation
  triggers
- Two-pass pipeline: blind pass (no user notes, evidence-cited) → reconciliation pass
- Covers Step 5 and closes every remaining schema gap from Steps 1-4
- This is also where PDF/PPTX table-parsing or an LLM extraction pass (to get structured facts out
  of those formats, not just XLSX) most naturally belongs, if Faiz wants that filled in before then
- Wires Sprint 2's research items into the evidence packet as citable `EvidenceItem`s
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
| **Portfolio risk & regime intelligence** | Correlation/factor exposure across holdings, drawdown scenarios, rebalancing flags, populating `portfolio_risk_snapshots` (Phase 5 table already exists, unused) | Most naturally builds on Sprint 5's dashboard and Sprint 3's valuation numbers existing first |
| **Investment thesis tracking** | Persist a written thesis per holding (`investment_theses`, `valuation_cases` — Phase 5 tables already exist, unused); track the Step 5 "what would change the thesis" triggers and flag when new research/financials suggest one fired | Depends on Sprint 4's verdict/thesis output schema existing first |
| **Historical price/FX & performance tracking** | `market_observations`/`fx_observations` ingestion (Phase 2 tables, not yet built this rebuild), daily P&L, benchmark comparison, position-level return | No market-data ingestion exists at all yet — every number today is document-sourced and point-in-time |
| **LLM usage ledger & cost observability** | Persist real `llm_usage_events` rows (table exists, unused) instead of `app/providers/budget.py`'s in-memory placeholder guard; a simple spend view | Low-risk, could be pulled forward any time Faiz wants real budget visibility rather than the in-memory placeholder |
| **Alerts & notifications** | Notify (email/push) when a thesis-invalidation trigger fires, a material new research item lands, or research goes stale past a threshold | Needs thesis tracking built first as the thing being watched |
| **Reporting & export** | One-holding or whole-portfolio PDF/print view of an analysis run; tax-lot-aware export | Natural once Sprint 4's analysis output actually exists to export |
| **Fix GitHub push credentials** (ops, not a feature) | A PAT or credential-helper set up on Faiz's side so sessions (cloud and linked device alike) can push directly, instead of every session's commits sitting local until he pushes them by hand | Not a build task for an agent session — needs a decision/action from Faiz outside the repo; flagged because it's hit identically in every session's history above |

## Changes / history

| Date | Summary |
|---|---|
| 2026-09-21 | **Sprint 2 closed: frontend research UI.** Built the frontend for the `/research/*` API: a shared `ResearchPanel` component, a Macro page (portfolio-wide research + a sector picker), a Sector page (`/sectors/:sector`), and a company-research panel added to `HoldingDetailPage`. "Macro" is now a live nav item. No backend changes — 198 backend tests unaffected/still passing; frontend `tsc`/`eslint`/`vite build` all clean. 1 commit (`20d76c1`), local only — confirmed `git push` still fails in this shell too. Also verified this session: `main` was up to date with `origin/main` before this commit (the prior session's CSV-import commit had in fact been pushed since), and re-ran the full backend test suite fresh (198/198 passing) as part of the status-honesty check before starting new work. |
| 2026-09-21 | **Portfolio CSV import + delete UI, pulled forward from Sprint 4.** Built the broker-export CSV parser, an instrument-type classifier for the mixed equity/bond/ETC rows these exports contain, the CSV→Account/Document/Snapshot/Position ingestion service, `POST /portfolio/import-csv`, and a new frontend Portfolio page (multi-file upload + account/snapshot lists with delete buttons). Faiz chose to import every row (tagged, not skipped), skip a whisky/collectibles CSV in the same upload batch entirely, and keep deletes granular rather than add a bulk wipe. 25 new tests (198 total), ruff clean. 1 commit (`2cb56c7`), since confirmed pushed. |
| 2026-09-21 | **Sprint 2 started.** Built the macro/sector/per-company live research vertical slice: `ResearchRun`/`ResearchItem` models, `GeminiResearchProvider` (Google Search grounding), versioned prompts, staleness-checked caching services, `/research` API. 26 new tests (173 total), ruff clean. 2 commits (`16c3ff6`, `588198d`), both since confirmed pushed. |
| 2026-09-21 | **Sprint 1 closed.** Minimal API (4 commits: holdings CRUD, accounts CRUD, computed-metrics endpoints, portfolio snapshot/position CRUD — the last requiring `POST /documents/upload` to accept portfolio-wide files with no single holding, per Faiz's explicit traceability-over-convenience decision) + first real frontend pages (1 commit: holding list + holding detail, `react-router-dom`, tokens from the Design & UX direction actually implemented in `tailwind.config.js`). 47 new tests this session (147 backend total), ruff clean; frontend lint/type-check/build all clean. 6 commits, since confirmed pushed by Faiz. |
| 2026-09-21 | Document ingestion built (Sprint 1's 3rd deliverable). Built `app/services/documents/`, swappable object storage, `app/config/database.py` (fixing a broken `alembic/env.py` import), and `app/api/documents.py`. 32 new tests, 109 total, ruff clean. Committed (`3ca7b68`), since confirmed pushed. |
| 2026-09-21 | Sprint 0 closed, Sprint 1 started. Built `app/providers/` (Gemini + Mistral), `app/models/`, `app/services/calculations.py`. 77 tests. Two commits, since confirmed pushed. |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research. Set the Design & UX direction (now implemented). |
| 2026-09-21 | Sprint 0 skeletons built: legacy frontend removed, skeleton FastAPI backend + React frontend. 3 commits, since confirmed pushed. |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped. |
| 2026-09-21 | Full repo reset + rebuild plan written. Committed and pushed as `8ad0221`. |
