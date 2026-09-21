# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** [buffett-munger-redesign-sprint-plan-2026-09-20.md](buffett-munger-redesign-sprint-plan-2026-09-20.md).
That doc planned an *incremental* redesign (ADR 0019/0020: "continue & consolidate, no rebuild").
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0 and Sprint 1 are both closed — equity data model,
deterministic calculations, document ingestion, the Minimal API, and the first real frontend pages
are all done. Sprint 2 (live research) is next.**

## Where things actually stand right now (audited 2026-09-21, fifth session pass)

| | |
|---|---|
| Repo | `main`, commit `29c7132` ("Add first real frontend pages: holding list + holding detail (Sprint 1)") — **6 commits this session, none pushed yet** — no GitHub push credentials in this session's shell either, same limitation every session has hit. Everything through commit `50fb2ef` (the previous session's docs sync) has been confirmed pushed. |
| **Sprint 1 — fully closed this session.** | Backend: holdings/accounts/portfolio CRUD, portfolio-wide document uploads, computed-metrics endpoints (see the 4-commit Minimal API breakdown in "Sprints" below). Frontend: a holding-list page and a holding-detail page (profile, deterministic-metrics panel, filings table + upload), built against that API and the Design & UX direction's tokens. |
| **Design decision (asked Faiz directly this session)** | Portfolio snapshots must point at a real uploaded document (`source_file_id`) — no manual-entry shortcut. Faiz chose traceability over convenience. |
| `frontend/src/` | **New this session:** `lib/api.ts` (fetch wrapper — `/api/*` in dev via the existing vite proxy, `VITE_API_BASE_URL` directly in production), `lib/types.ts` (hand-written to mirror the backend's Pydantic schemas — no shared generator yet; every Decimal arrives as a JSON string), `lib/format.ts`, `components/Layout.tsx` (fixed left nav, Holdings live / Portfolio-Thesis-Macro disabled placeholders), `components/ui.tsx`, `pages/HoldingsListPage.tsx`, `pages/HoldingDetailPage.tsx`. Added `react-router-dom`. `npm run lint` / `npx tsc --noEmit` / `npm run build` all clean. |
| Frontend — what's *not* verified | No live dev-server smoke test against a running backend this session — deliberately skipped to avoid any risk of a local backend run picking up real `DATABASE_URL`/Supabase credentials from `backend/.env` (this app handles Faiz's real brokerage data — CLAUDE.md). Worth doing from Faiz's own machine, ideally against a disposable dev DB. |
| `backend/app/services/documents/` | Unchanged this session except one correctness fix (previous session): a holding-less (portfolio-export) document discards candidate facts (flagged `facts_skipped_no_holding`) instead of risking a null-FK `IntegrityError`. |
| `backend/app/models/`, `calculations.py`, `object_storage*.py`, `database.py` | Unchanged this session. |
| Deployment | **Not deployed to Railway.** Still "written, not yet deployed" per the status-honesty rule. |
| Real data | **Untouched, and staying that way** (Decision 1 below). |
| Test environment | Backend: same fresh-Linux-venv-per-session limitation as always — **147 tests, all passing**, ruff clean (aside from the confirmed pre-existing `EXE002` artifact). Frontend: no test framework installed yet (Vitest/RTL would be Sprint 7-adjacent guardrail work, or added whenever the first component gets complex enough to need one) — verified via lint + strict type-check + a successful production build instead. |
| Known gap | None blocking Sprint 2. |

## The Brain's 5 steps — what the rebuild has to deliver

| Step | What it asks for |
|---|---|
| Opening | Live macro/geopolitical research (rates, inflation, conflicts, currencies, regulation, sector trends — the Iran/energy example), per portfolio and per holding |
| 1. Business Quality & Moat | Circle of competence summary, moat rating (Wide/Narrow/None across brand, pricing power, switching costs, network effects, cost advantage, IP, distribution), 3-5yr avg ROIC/ROE/margins vs. a hurdle (~15%) |
| 2. Financial Fortress | Net Debt/FCF, Net Debt/EBITDA, interest coverage, D/E; owner earnings/FCF trend vs. net income; earnings quality (one-offs, SBC, cyclical distortion) |
| 3. Macro & Industry Stress Test | Rate sensitivity, inflation/demand/pricing-power sensitivity, geopolitical/regulatory/commodity/FX/supply-chain risk, cyclical positioning vs. normalized earnings |
| 4. Valuation & Margin of Safety | Multiples vs. history/peers, DCF (base/bull/bear), reverse DCF (implied growth from price), margin of safety |
| 5. Verdict | Strong Buy/Buy/Hold/Sell/Avoid, 3-bullet thesis, top-2 downside risks, price target range, 3-5 metrics to monitor, what would change the thesis |

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

## Actual current Supabase schema (read from `backend/alembic/versions/`, 21 tables, no live DB connection needed)

No non-equity table exists — the old multi-asset design used a discriminator, not separate tables:
`holdings.asset_class` (string column) and `portfolio_positions.acquired_at` (nullable, added for
collectibles) are the only non-equity-specific fields, both on otherwise-shared, otherwise-equity
tables. Nothing to route around structurally — just don't populate/query those for non-equity rows.

| Table | From phase |
|---|---|
| `accounts`, `holdings`, `portfolio_positions`, `portfolio_snapshots`, `documents`, `document_pages`, `document_chunks`, `financial_line_items` | Phase 1 (portfolio + document ingestion) + accounts migration — **ORM models, document ingestion, full CRUD, and the first frontend pages all done this rebuild** |
| `market_observations`, `fx_observations` | Phase 2 (market data & FX) |
| `analysis_runs`, `holding_analyses`, `factor_assessments`, `evidence_references` | Phase 3 (AI analysis engine) |
| `research_runs`, `research_items`, `macro_observations` | Phase 4 (external research) |
| `investment_theses`, `valuation_cases`, `portfolio_risk_snapshots` | Phase 5 (thesis & portfolio intelligence) |
| `llm_usage_events` | LLM usage ledger — not yet re-created this rebuild; `app/providers/budget.py`'s in-memory guard is a placeholder until this exists |

## Design & UX direction (researched 2026-09-21; tokens now implemented in `frontend/tailwind.config.js`)

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

**Tokens (implemented in `frontend/tailwind.config.js` this session — `background`, `surface`,
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
- System font stack (no external font request — the fallback in `fontFamily.display`/`.body` reads
  fine and avoids a production dependency on a font CDN); `Inter` is named first for whenever it's
  actually loaded.
- Fixed left nav, holding list/detail built as cards over the near-white background.

Sprint 5 (the dashboard) is where this direction gets exercised fully across every domain; the
holding list/detail pages built this session are the first proof it holds up in a real page, not
just a spec.

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
| **First real frontend pages** | Holding list (`HoldingsListPage.tsx`) + holding detail (`HoldingDetailPage.tsx`: profile, metrics panel, filings + upload), styled against the Design & UX direction tokens | ✅ **Done this session** — commit `29c7132` |

### Sprint 2 — Live research (evidence-first) — next up

- Macro/geopolitical, sector, and per-company research (the Iran/energy example) — grounded,
  cached, cited as evidence
- Covers the Brain's opening step and Step 3.3

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
| 2026-09-21 | **Sprint 1 closed.** Minimal API (4 commits: holdings CRUD, accounts CRUD, computed-metrics endpoints, portfolio snapshot/position CRUD — the last requiring `POST /documents/upload` to accept portfolio-wide files with no single holding, per Faiz's explicit traceability-over-convenience decision) + first real frontend pages (1 commit: holding list + holding detail, `react-router-dom`, tokens from the Design & UX direction actually implemented in `tailwind.config.js`). 47 new tests this session (147 backend total), ruff clean; frontend lint/type-check/build all clean. 6 commits, all still unpushed. |
| 2026-09-21 | Document ingestion built (Sprint 1's 3rd deliverable). Built `app/services/documents/`, swappable object storage, `app/config/database.py` (fixing a broken `alembic/env.py` import), and `app/api/documents.py`. 32 new tests, 109 total, ruff clean. Committed (`3ca7b68`), since confirmed pushed. |
| 2026-09-21 | Sprint 0 closed, Sprint 1 started. Built `app/providers/` (Gemini + Mistral), `app/models/`, `app/services/calculations.py`. 77 tests. Two commits, since confirmed pushed. |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research. Set the Design & UX direction (now implemented). |
| 2026-09-21 | Sprint 0 skeletons built: legacy frontend removed, skeleton FastAPI backend + React frontend. 3 commits, since confirmed pushed. |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped. |
| 2026-09-21 | Full repo reset + rebuild plan written. Committed and pushed as `8ad0221`. |
