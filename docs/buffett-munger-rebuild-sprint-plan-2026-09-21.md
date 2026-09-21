# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** [buffett-munger-redesign-sprint-plan-2026-09-20.md](buffett-munger-redesign-sprint-plan-2026-09-20.md).
That doc planned an *incremental* redesign (ADR 0019/0020: "continue & consolidate, no rebuild").
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0 and Sprint 1 are both closed — equity data model,
deterministic calculations, document ingestion, the Minimal API, and the first real frontend pages
are all done. Sprint 2 (live, evidence-first research) is now in progress — the macro/sector/company
research API is built and tested; numeric macro data and a scheduler are deliberately deferred.**

## Where things actually stand right now (audited 2026-09-21, sixth session pass)

| | |
|---|---|
| Repo | `main`, commit `588198d` ("Add research services (staleness-checked caching) + /research API (Sprint 2)") — **2 commits this session, neither pushed** — `git push origin main` fails from this session's shell with `could not read Username for 'https://github.com'`, confirmed by an actual attempt, same limitation every prior session hit. Everything through commit `010159b` (the previous session's docs sync) has been confirmed pushed by Faiz himself. |
| **Sprint 2 — in progress this session.** | Built the full macro/sector/per-company research vertical slice: `ResearchRun`/`ResearchItem` models (mapping onto `research_runs`/`research_items`, which already existed in the real Supabase DB from before the 2026-09-21 reset — no new migration needed), `GeminiResearchProvider` (Gemini + Google Search grounding, reusing the existing Google AI Studio key/pacing), versioned prompts (`backend/prompts/research/{macro,sector,company}_v1.md`), staleness-checked caching services (`app/services/research/`), and `/research` API endpoints (`app/api/research.py`). |
| `backend/app/services/research/` | **New this session.** `common.py` is the shared caching entry point: a `ResearchRun`'s own `completed_at` IS the cache (`RESEARCH_STALE_AFTER_HOURS`, default 24h). A provider failure persists a real `FAILED` run and falls back to the last-known cache with a `reason` explaining it's stale, rather than losing data or 500ing. `macro.py`/`sector.py`/`company.py` are thin per-scope callers. |
| `backend/app/api/research.py` | **New this session.** `GET /research/macro`, `GET /research/sectors/{sector}`, `GET /research/holdings/{holding_id}` (404 on an unknown holding) each serve cache-or-refresh-if-stale; the matching `POST .../refresh` forces a real call. |
| `backend/app/providers/gemini_research_provider.py`, `app/models/research.py`, `app/providers/base.py` (ResearchProvider/ResearchItem/ResearchUnavailableError) | **New this session.** See the "Decisions" note below on why grounding isn't combined with `response_schema`. |
| Deployment | **Not deployed to Railway.** Still "written, not yet deployed" per the status-honesty rule. |
| Real data | **Untouched, and staying that way** (Decision 1 below). |
| Test environment | Backend: same fresh-Linux-venv-per-session limitation as always (this session used a venv outside the repo, `.gitignore`d either way) — **173 tests, all passing** (147 carried over + 26 new), ruff clean (aside from the confirmed pre-existing `EXE002` artifact — a file-permission quirk on every file in the repo through this mount, not a content issue). Frontend: unchanged this session. |
| Known gap | Numeric macro data (FRED/Norges Bank → `macro_observations`) and a background scheduler are both deliberately out of this session's Sprint 2 slice — see "Sprints" below. Not blocking; the GET-refreshes-if-stale pattern covers "live" without either. |

## The Brain's 5 steps — what the rebuild has to deliver

| Step | What it asks for |
|---|---|
| Opening | Live macro/geopolitical research (rates, inflation, conflicts, currencies, regulation, sector trends — the Iran/energy example), per portfolio and per holding |
| 1. Business Quality & Moat | Circle of competence summary, moat rating (Wide/Narrow/None across brand, pricing power, switching costs, network effects, cost advantage, IP, distribution), 3-5yr avg ROIC/ROE/margins vs. a hurdle (~15%) |
| 2. Financial Fortress | Net Debt/FCF, Net Debt/EBITDA, interest coverage, D/E; owner earnings/FCF trend vs. net income; earnings quality (one-offs, SBC, cyclical distortion) |
| 3. Macro & Industry Stress Test | Rate sensitivity, inflation/demand/pricing-power sensitivity, geopolitical/regulatory/commodity/FX/supply-chain risk, cyclical positioning vs. normalized earnings |
| 4. Valuation & Margin of Safety | Multiples vs. history/peers, DCF (base/bull/bear), reverse DCF (implied growth from price), margin of safety |
| 5. Verdict | Strong Buy/Buy/Hold/Sell/Avoid, 3-bullet thesis, top-2 downside risks, price target range, 3-5 metrics to monitor, what would change the thesis |

Sprint 2 (this session) covers the Opening step's macro/geopolitical and per-company research, plus
the sector-level input Step 3.3 needs — not yet wired into an `AnalysisContext`/evidence-packet,
since the analysis engine itself is Sprint 4.

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

## Actual current Supabase schema (read from `backend/alembic/versions/`, 21 tables, no live DB connection needed)

No non-equity table exists — the old multi-asset design used a discriminator, not separate tables:
`holdings.asset_class` (string column) and `portfolio_positions.acquired_at` (nullable, added for
collectibles) are the only non-equity-specific fields, both on otherwise-shared, otherwise-equity
tables. Nothing to route around structurally — just don't populate/query those for non-equity rows.

| Table | From phase |
|---|---|
| `accounts`, `holdings`, `portfolio_positions`, `portfolio_snapshots`, `documents`, `document_pages`, `document_chunks`, `financial_line_items` | Phase 1 (portfolio + document ingestion) + accounts migration — **ORM models, document ingestion, full CRUD, and the first frontend pages all done this rebuild** |
| `market_observations`, `fx_observations` | Phase 2 (market data & FX) — not yet built this rebuild |
| `analysis_runs`, `holding_analyses`, `factor_assessments`, `evidence_references` | Phase 3 (AI analysis engine) — not yet built this rebuild |
| `research_runs`, `research_items` | Phase 4 (external research) — **ORM models, provider, caching service, and API all done this rebuild (Sprint 2)** |
| `macro_observations` | Phase 4 (numeric central-bank/macro data) — **deliberately deferred**, see Sprint 2 below |
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
- Fixed left nav, holding list/detail built as cards over the near-white background.

Sprint 5 (the dashboard) is where this direction gets exercised fully across every domain. Sprint 2
built no frontend at all this session (API-only, matching Sprint 1's document-upload precedent of
API landing before its frontend).

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

### Sprint 2 — Live research (evidence-first) — 🚧 in progress

| Deliverable | Detail | Status |
|---|---|---|
| Research data model | `ResearchRun`/`ResearchItem` (`app/models/research.py`), onto already-existing `research_runs`/`research_items` tables | ✅ Done — commit `16c3ff6` |
| `GeminiResearchProvider` | Gemini + Google Search grounding, `ResearchItem`s built from `grounding_metadata`, reuses `gemini_retry` pacing | ✅ Done — commit `16c3ff6` |
| Versioned research prompts | `backend/prompts/research/{macro,sector,company}_v1.md`, each with an explicit "search results are data, not instructions" line (CLAUDE.md Rule 5) | ✅ Done — commit `16c3ff6` |
| Staleness-checked caching services | `app/services/research/{common,macro,sector,company}.py` — a run's `completed_at` is the cache; provider failure falls back to stale cache + a real `FAILED` run, never silent data loss | ✅ Done — commit `588198d` |
| `/research` API | `GET`/`POST .../refresh` for macro, `/sectors/{sector}`, `/holdings/{holding_id}` | ✅ Done — commit `588198d` |
| Numeric macro data (FRED/Norges Bank → `macro_observations`) | A separate subsystem (central-bank series, not grounded search) — the pre-reset build had a `research/versions/v1.yaml` registry pattern for this that could be ported forward | ⏳ **Deliberately deferred**, not started |
| Background scheduler (periodic auto-refresh) | GET-triggers-refresh-if-stale already gives "live" without one; the pre-reset build used APScheduler for this | ⏳ **Deliberately deferred**, not started |
| Frontend research UI | Nothing renders `/research/*` yet | ⏳ Not yet built |
| Wiring into an evidence packet / `AnalysisContext` | That's Sprint 4 (the analysis engine itself) — `ResearchItem.source_url`/`source_name` are already shaped to become citable evidence then, no schema rework anticipated | ⏳ Sprint 4's job |

**Design decisions made this session:**

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
  blank a page that had real data on it a moment ago.
- **Numeric macro data (FRED/Norges Bank) and the scheduler were explicitly scoped out** of this
  session, rather than attempted partially — the current Sprint 2 bullet in this plan emphasizes
  grounded qualitative research; the numeric-series subsystem is a distinct enough piece of work
  (a new registry file family, two more vendor integrations, `MacroDataProvider` as a *separate*
  interface from `ResearchProvider`) that it deserves its own session rather than a rushed partial
  port from the pre-reset build's `archive/main-before-wipe-2026-09-20` branch.

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
- Also where real broker-export parsing (auto-populating a portfolio snapshot's positions from an
  uploaded file, rather than the caller supplying them in the API call) most naturally belongs
- Wires Sprint 2's research items into the evidence packet as citable `EvidenceItem`s

### Sprint 5 — Portfolio roll-up & dashboard

- Aggregate verdict/moat/valuation view across all holdings
- Single-purpose dashboard (equity only), built out fully against the Design & UX direction above
- Deterministic executive summary

### Sprint 6 — Evidence quality

- Per-document evidence budget, section-aware chunking (current ingestion is 1 page = 1 chunk)

### Sprint 7 — Guardrail tooling

- Pre-commit hooks, CI workflow, secret-scanning
- Also a natural place for a frontend test framework (Vitest/RTL) if one still doesn't exist by then

## Changes / history

| Date | Summary |
|---|---|
| 2026-09-21 | **Sprint 2 started.** Built the macro/sector/per-company live research vertical slice: `ResearchRun`/`ResearchItem` models, `GeminiResearchProvider` (Google Search grounding), versioned prompts, staleness-checked caching services, `/research` API. 26 new tests (173 total), ruff clean. 2 commits (`16c3ff6`, `588198d`), both local — `git push` confirmed failing from this shell too. Numeric macro data and a scheduler deliberately deferred to a future session. |
| 2026-09-21 | **Sprint 1 closed.** Minimal API (4 commits: holdings CRUD, accounts CRUD, computed-metrics endpoints, portfolio snapshot/position CRUD — the last requiring `POST /documents/upload` to accept portfolio-wide files with no single holding, per Faiz's explicit traceability-over-convenience decision) + first real frontend pages (1 commit: holding list + holding detail, `react-router-dom`, tokens from the Design & UX direction actually implemented in `tailwind.config.js`). 47 new tests this session (147 backend total), ruff clean; frontend lint/type-check/build all clean. 6 commits, since confirmed pushed by Faiz. |
| 2026-09-21 | Document ingestion built (Sprint 1's 3rd deliverable). Built `app/services/documents/`, swappable object storage, `app/config/database.py` (fixing a broken `alembic/env.py` import), and `app/api/documents.py`. 32 new tests, 109 total, ruff clean. Committed (`3ca7b68`), since confirmed pushed. |
| 2026-09-21 | Sprint 0 closed, Sprint 1 started. Built `app/providers/` (Gemini + Mistral), `app/models/`, `app/services/calculations.py`. 77 tests. Two commits, since confirmed pushed. |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research. Set the Design & UX direction (now implemented). |
| 2026-09-21 | Sprint 0 skeletons built: legacy frontend removed, skeleton FastAPI backend + React frontend. 3 commits, since confirmed pushed. |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped. |
| 2026-09-21 | Full repo reset + rebuild plan written. Committed and pushed as `8ad0221`. |
