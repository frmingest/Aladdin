# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** [buffett-munger-redesign-sprint-plan-2026-09-20.md](buffett-munger-redesign-sprint-plan-2026-09-20.md).
That doc planned an *incremental* redesign (ADR 0019/0020: "continue & consolidate, no rebuild").
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0 is closed. Sprint 1 (equity data model & deterministic
calculations) is underway — models, calculations, document ingestion, and the Minimal API are done;
only the first real frontend pages remain.**

## Where things actually stand right now (audited 2026-09-21, fourth session pass)

| | |
|---|---|
| Repo | `main`, commit `52bc5d3` ("Add portfolio snapshot/position CRUD API (Sprint 1 Minimal API, part 4)") — **5 commits this session, none pushed yet** — no GitHub push credentials in this session's shell either, same limitation every session has hit. The document-ingestion commit (`3ca7b68`) and its docs-sync commit (`50fb2ef`) from the previous session *have* been pushed (confirmed: `main` and `origin/main` matched at the start of this session). |
| **Minimal API — done this session** | `app/api/holdings.py` (CRUD), `app/api/accounts.py` (CRUD), `app/api/portfolio.py` (snapshot/position CRUD + HHI concentration), `app/services/metrics.py` + `GET /holdings/{id}/metrics` (deterministic ratios from extracted facts). See "Sprints" below for the full breakdown. |
| **Design decision (asked Faiz directly this session)** | Portfolio snapshots must point at a real uploaded document (`source_file_id`) — no manual-entry shortcut. Faiz chose traceability over convenience: every position stays linked to real evidence, same standard as document-derived facts. This required making `POST /documents/upload`'s `holding_id` optional (new `document_type="portfolio_export"` for a brokerage export covering many holdings) — see `app/domain/document_types.py`. |
| `backend/app/services/documents/` | Unchanged this session except one correctness fix: `financial_line_items.holding_id` is `NOT NULL`, so a holding-less (portfolio-export) document now explicitly discards any candidate extracted facts (flagged `facts_skipped_no_holding`) rather than risking an `IntegrityError` on a null FK. |
| `backend/app/providers/object_storage.py` + `object_storage_s3.py` | Unchanged this session. Swappable object storage: local filesystem for dev, or any S3-compatible bucket (Cloudflare R2 / Supabase Storage) for real deployment. |
| `backend/app/config/database.py` | Unchanged this session. |
| `backend/app/models/` | Unchanged this session. 8 SQLAlchemy models against the real, already-migrated schema. |
| `backend/app/services/calculations.py` | Unchanged this session (still 15 deterministic functions) — now actually exercised end-to-end via `app/services/metrics.py` (per-holding ratios) and `app/api/portfolio.py` (HHI concentration). |
| `frontend/src/` | Unchanged this session: skeleton only (`App.tsx` health badge). **Sprint 1's last open item.** |
| Deployment | **Not deployed to Railway.** Still "written, not yet deployed" per the status-honesty rule. |
| Real data | **Untouched, and staying that way** (Decision 1 below). Supabase still holds the real portfolio/holdings/analysis history, including legacy non-equity rows/columns. |
| Test environment | Same limitation as every session: the repo's own `backend/.venv` is a **Windows** venv, can't run from the Linux shell this session works in — a fresh Linux venv was created this session (not persisted anywhere durable — expect to recreate it again next session) to install `requirements.txt` and run the suite: **147 tests, all passing** (up from 109), ruff clean aside from the same pre-existing `EXE002` mount-permission artifact on every file (unrelated to any session's changes). |
| Known gap | None blocking Sprint 1's remaining item — the Minimal API the frontend needs is now complete. |

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

## 3 open checkpoints — resolved (2026-09-21)

| # | Question | Decision |
|---|---|---|
| 1 | DB schema strategy | **Leave the existing Supabase schema and data exactly as-is.** No migration to strip non-equity tables/columns now. |
| 2 | LLM provider | **Reuse Google AI Studio (Gemini) + Mistral** via keys in `backend/.env`/Railway. Rate-limit resilience (budget guard, retry/backoff, RPM pacing) built in from day one — done. |
| 3 | Leftover GitHub branches | **Deleted** — confirmed gone from `origin` this session (`git ls-remote --heads origin` shows only `main`). |

## 4th open checkpoint — resolved (2026-09-21, this session)

| # | Question | Decision |
|---|---|---|
| 4 | Portfolio position entry: require a real document, or allow manual entry? | **Require a real uploaded document** (`source_file_id`, `NOT NULL`) for every portfolio snapshot — asked Faiz directly, he chose traceability over convenience. No synthetic "manual entry" document, no relaxing the FK. A portfolio-wide export uploads via `POST /documents/upload` with `document_type="portfolio_export"` and no `holding_id`. |

## Actual current Supabase schema (read from `backend/alembic/versions/`, 21 tables, no live DB connection needed)

No non-equity table exists — the old multi-asset design used a discriminator, not separate tables:
`holdings.asset_class` (string column) and `portfolio_positions.acquired_at` (nullable, added for
collectibles) are the only non-equity-specific fields, both on otherwise-shared, otherwise-equity
tables. Nothing to route around structurally — just don't populate/query those for non-equity rows.

| Table | From phase |
|---|---|
| `accounts`, `holdings`, `portfolio_positions`, `portfolio_snapshots`, `documents`, `document_pages`, `document_chunks`, `financial_line_items` | Phase 1 (portfolio + document ingestion) + accounts migration — **ORM models, document ingestion, and full CRUD done this rebuild** |
| `market_observations`, `fx_observations` | Phase 2 (market data & FX) |
| `analysis_runs`, `holding_analyses`, `factor_assessments`, `evidence_references` | Phase 3 (AI analysis engine) |
| `research_runs`, `research_items`, `macro_observations` | Phase 4 (external research) |
| `investment_theses`, `valuation_cases`, `portfolio_risk_snapshots` | Phase 5 (thesis & portfolio intelligence) |
| `llm_usage_events` | LLM usage ledger — not yet re-created this rebuild; `app/providers/budget.py`'s in-memory guard is a placeholder until this exists |

## Design & UX direction (researched 2026-09-21, unchanged this session)

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

**Concrete starting tokens** (still not yet built — for Faiz to confirm before Sprint 1's frontend
pages are styled against them):

- Background: near-white (`#FAFAF9`/`#FFFFFF`), elevated surfaces (cards) a hair off that.
- Text: near-black (`#111111`-ish primary, warm gray secondary/muted) — not pure `#000`.
- One accent color for links/primary actions/focus states.
- Data semantics: one green (gain/pass), one red (loss/fail), one amber (caution/hold) — state only.
- Typography: one quiet sans-serif (Inter or similar) + tabular figures (`font-variant-numeric: tabular-nums`) for financial values.
- Layout: fixed left nav (portfolio / holdings / thesis / macro as sprints add them) + a content area built around cards with real whitespace.

This becomes real in Sprint 5 (the dashboard), but Sprint 1's remaining frontend pages (holding
list, holding detail — not yet built) should be styled against these tokens from the start.

## Sprints

### Sprint 0 — Foundation — ✅ closed 2026-09-21

All items done — see prior session detail in the project's `progress.md`.

### Sprint 1 — Equity data model & deterministic calculations — 🚧 in progress

| Deliverable | Detail | Status |
|---|---|---|
| SQLAlchemy models | `Account`, `Holding`, `PortfolioPosition`, `PortfolioSnapshot`, `Document`, `DocumentPage`, `DocumentChunk`, `FinancialLineItem` | ✅ Done |
| Deterministic calculations module | ROIC, ROE, margins, FCF, owner earnings, leverage ratios, HHI, multiples | ✅ Done |
| Document ingestion | PDF/PPTX/XLSX text + structured line-item extraction into `DocumentChunk`/`FinancialLineItem`, sha256 dedup, swappable object storage (local/S3), `POST /documents/upload` + `GET /documents` + `GET /documents/{id}` | ✅ Done |
| **Minimal API** | Holdings CRUD, accounts CRUD, portfolio snapshot/position CRUD + HHI concentration, read-only computed-metrics endpoints (`GET /holdings/{id}/metrics`) | ✅ **Done this session** — commits `98ec5be`..`52bc5d3`, 38 new tests (147 total) |
| First real frontend pages | Holding list + holding detail, styled against the Design & UX direction tokens | ⬜ Not started — **the only Sprint 1 item left** |

### Sprint 2 — Live research (evidence-first)

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
  uploaded file, rather than the caller supplying them in the API call) most naturally belongs —
  today's `POST /portfolio/snapshots` takes positions as explicit structured input, matching how
  document ingestion works everywhere else in this rebuild (facts only become structured when
  something deterministic promotes them, never guessed)

### Sprint 5 — Portfolio roll-up & dashboard

- Aggregate verdict/moat/valuation view across all holdings
- Single-purpose dashboard (equity only), built out fully against the Design & UX direction above
- Deterministic executive summary

### Sprint 6 — Evidence quality

- Per-document evidence budget, section-aware chunking (current ingestion is 1 page = 1 chunk)

### Sprint 7 — Guardrail tooling

- Pre-commit hooks, CI workflow, secret-scanning

## Changes / history

| Date | Summary |
|---|---|
| 2026-09-21 | **Minimal API built (Sprint 1's 4th deliverable, closing it out).** Built holdings CRUD (`app/api/holdings.py`), accounts CRUD (`app/api/accounts.py`), portfolio-wide document uploads (holding_id now optional, new `portfolio_export` type), portfolio snapshot/position CRUD with HHI concentration (`app/api/portfolio.py`), and read-only computed-metrics endpoints (`app/services/metrics.py`). Asked Faiz directly how portfolio positions should be entered; he chose requiring a real uploaded source document over a manual-entry shortcut. Confirmed the 6 leftover GitHub branches are already deleted. 38 new tests (147 total), ruff clean. 5 commits, all still unpushed. |
| 2026-09-21 | Document ingestion built (Sprint 1's 3rd deliverable). Confirmed the prior session's 2 commits were pushed by Faiz in between sessions. Built `app/services/documents/` (intake/dedup/extraction for PDF/PPTX/XLSX, XLSX-only structured fact extraction via a deterministic label map), swappable object storage (`app/providers/object_storage*.py`, local/S3), `app/config/database.py` (new — and fixed a broken `alembic/env.py` import that's been silently broken since the reset), and the app's first real API router (`app/api/documents.py`). Added `backend/pyproject.toml` to fix a ruff false-positive on FastAPI's `Depends`/`Form`/`File` idiom. 32 new tests, 109 total passing, ruff clean. Committed (`3ca7b68`), since confirmed pushed. |
| 2026-09-21 | Sprint 0 closed, Sprint 1 started. Faiz confirmed `LLM_PROVIDER=google_ai_studio` and the plan to finish Sprint 0 before starting Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, in-memory daily budget guard) — 44 tests. Then built `app/models/` (8 SQLAlchemy models against the real schema) and `app/services/calculations.py` (15 deterministic financial functions, Decimal-based) — 33 more tests. 77/77 backend tests passing this session; ruff clean aside from a confirmed pre-existing mount-permission artifact. Two commits made (`72d3c03`, `ff5ee54`). |
| 2026-09-21 | Status audit + planning pass: confirmed the repo (not the docs) had the real up-to-date state — docs/ mirror and the 3 skeleton commits were already pushed. Added the missing `MISTRAL_API_KEY` to `backend/.env` directly (was typed but unsaved), clearing Sprint 0's last blocker. Re-verified the frontend build is still clean. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and wrote up a concrete Design & UX direction. Expanded Sprint 1 into concrete deliverables. |
| 2026-09-21 | Sprint 0 skeletons built: found and removed the legacy multi-asset frontend the original reset had missed (49 files, commit `622ad08`); built and locally tested a skeleton FastAPI backend with `/health` (commit `ec4c0de`, also fixed a Dockerfile that still referenced deleted top-level asset dirs); built and locally tested a skeleton React frontend with a health badge (commit `d1e9e36`). Since confirmed pushed and docs synced. Gemini+Mistral wiring was blocked on `MISTRAL_API_KEY`. |
| 2026-09-21 | Repo wiped except Railway/Supabase/GitHub config, committed and pushed as `8ad0221` ("reset") with full history preserved. Real Supabase data untouched. |
| 2026-09-21 | 3 open checkpoints decided: keep DB as-is, reuse Gemini+Mistral with resilience built in from day one, delete 6 leftover branches. |
