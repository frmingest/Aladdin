# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** [buffett-munger-redesign-sprint-plan-2026-09-20.md](buffett-munger-redesign-sprint-plan-2026-09-20.md).
That doc planned an *incremental* redesign (ADR 0019/0020: "continue & consolidate, no rebuild").
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0 is closed. Sprint 1 (equity data model & deterministic
calculations) is underway — models and the calculations module are done; document ingestion, the API,
and the first frontend pages are not.**

## Where things actually stand right now (audited 2026-09-21, second session pass)

| | |
|---|---|
| Repo | `main`, 2 commits ahead of `origin/main` this session (`72d3c03` LLM providers, `ff5ee54` models+calculations) — **not yet pushed**, no GitHub push credentials in this session's shell. |
| `backend/app/providers/` | **New this session.** Vendor-agnostic `LLMProvider` interface; `GoogleAIStudioProvider` (Gemini, `gemini-3.6-flash`) and `MistralProvider` (fallback) with retry/backoff on transient errors only, shared RPM pacing, and an in-memory `DailyBudgetGuard`. 44 unit tests, all against mocked SDK clients. |
| `backend/app/models/` | **New this session.** 8 SQLAlchemy models (Account, Holding, Document, DocumentPage, DocumentChunk, PortfolioSnapshot, PortfolioPosition, FinancialLineItem) built directly against the real, already-migrated schema (read from `alembic/versions/`, not guessed) — including the widened `holdings.ticker`, the `accounts` table/FKs, and the legacy `asset_class`/`acquired_at` columns (mapped but unused, per this doc's DB-strategy decision). |
| `backend/app/services/calculations.py` | **New this session.** 15 deterministic functions (margins, ROIC/ROE, FCF, owner earnings, Net Debt/EBITDA, Net Debt/FCF, interest coverage, D/E, P/E, P/B, P/S, EV/EBITDA, HHI) — Decimal throughout, raises on undefined (zero-denominator) results rather than guessing. |
| `backend/app/` (rest) | `main.py` (`/health`), `config/settings.py` now also carries LLM provider/rate-limit/fallback settings. |
| `frontend/src/` | Unchanged this session: skeleton only (`App.tsx` health badge). |
| Deployment | **Not deployed to Railway.** Still "written, not yet deployed" per the status-honesty rule — this session had no network path to check a live URL either. |
| `backend/.env` | **Fixed this session**: `LLM_PROVIDER` now `google_ai_studio` (Faiz's explicit call), leftover `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` lines removed, and the LLM tuning/rate-limit/fallback-model keys `.env.example` already documented (but `.env` was missing) added. |
| Real data | **Untouched, and staying that way** (Decision 1 below). Supabase still holds the real portfolio/holdings/analysis history, including legacy non-equity rows/columns. |
| Test environment | The repo's own `backend/.venv` is a **Windows** venv (`Scripts/python.exe`) — can't run from `device_bash`'s Linux shell. This session created a separate Linux venv to install `requirements.txt` + test tooling and actually run the suite (77 tests, all passing) rather than skipping verification. |

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
| 2 | LLM provider | **Reuse Google AI Studio (Gemini) + Mistral** via keys in `backend/.env`/Railway. Rate-limit resilience (budget guard, retry/backoff, RPM pacing) built in from day one this time — **done, this session.** |
| 3 | Leftover GitHub branches | **Delete all 6** — commands handed to Faiz to run himself. Still pending. |

## Actual current Supabase schema (read from `backend/alembic/versions/`, 21 tables, no live DB connection needed)

No non-equity table exists — the old multi-asset design used a discriminator, not separate tables:
`holdings.asset_class` (string column) and `portfolio_positions.acquired_at` (nullable, added for
collectibles) are the only non-equity-specific fields, both on otherwise-shared, otherwise-equity
tables. Nothing to route around structurally — just don't populate/query those for non-equity rows.
**Now reflected in `app/models/` — see above.**

| Table | From phase |
|---|---|
| `accounts`, `holdings`, `portfolio_positions`, `portfolio_snapshots`, `documents`, `document_pages`, `document_chunks`, `financial_line_items` | Phase 1 (portfolio + document ingestion) + accounts migration — **ORM models done this session** |
| `market_observations`, `fx_observations` | Phase 2 (market data & FX) |
| `analysis_runs`, `holding_analyses`, `factor_assessments`, `evidence_references` | Phase 3 (AI analysis engine) |
| `research_runs`, `research_items`, `macro_observations` | Phase 4 (external research) |
| `investment_theses`, `valuation_cases`, `portfolio_risk_snapshots` | Phase 5 (thesis & portfolio intelligence) |
| `llm_usage_events` | LLM usage ledger — not yet re-created this rebuild; `app/providers/budget.py`'s in-memory guard is a placeholder until this exists |

## Design & UX direction (researched 2026-09-21)

Faiz asked for a deliberate look this time: *"a simple philosophy... what investment-grade
financial webpage has a clean, simple and beautiful UI that is popular."* Worth naming plainly why
this needs deciding once, now: Aladdin's UI has already changed identity three times pre-reset —
copied wholesale from the CWO app's navy/cyan terminal look, then redone as its own amber
Bloomberg-terminal identity, then (per a later UX-review pass) actually living as an ad hoc Tailwind
`slate-950` dark theme with no real token system at all. None of it stuck, and none of it was
chosen for *this* app's job (a single-user equity research and conviction tool), which is why it
kept getting redone.

**What "investment-grade, clean, simple, beautiful" actually looks like in practice** (from a
survey of fintech dashboards actually praised for this — Mercury, Stripe's own dashboard, Ramp,
Wealthfront, plus wider 2026 fintech UI roundups):

| Principle | What it means concretely |
|---|---|
| **Color means state, nothing else** | Green/red reserved strictly for gain/loss and pass/fail signals (moat rating, verdict, thesis status). No decorative gradients or brand color inside data areas. One quiet accent color for interactive elements only. |
| **Numbers are typeset, not just printed** | Tabular figures (fixed-width digits so columns of numbers align), consistent decimal places, currency symbols set lighter/smaller than the value itself. This is what makes a page of numbers feel trustworthy rather than sloppy. |
| **Editorial calm over data density** | Mercury's whole reputation is "made a bank account feel like a designed product" — generous whitespace, one clear focal number per section, routine detail collapsed by default. The opposite of a terminal's wall-of-numbers instinct. |
| **Progressive disclosure** | Summary first (portfolio verdict, moat, valuation at a glance), detail on demand (drill into a holding for the full 5-step Brain analysis, evidence citations, DCF assumptions). Prevents the "everything visible at once" overload a dense terminal UI creates. |
| **Left-nav information architecture** | Stripe Dashboard's pattern for scaling to many domains (portfolio, holdings, thesis, macro, valuation) without the top-nav running out of room, and without forcing a rebuild when a new section (Sprint 2-7 add several) shows up. |
| **Light-first, not dark-terminal** | Every example above (Mercury, Stripe, Wealthfront) is light/near-white with near-black text — not a Bloomberg-style dark terminal. This is the actual reversal from Aladdin's design history: dense/dark/monospace-forward reads as a trading terminal, not as a considered, trustworthy advisor. Recommend dropping the terminal aesthetic for good this time, in favor of a quiet light theme (a dark-mode toggle can come later, as a real second theme built on the same tokens — not a replacement for deciding the primary one). |

**Concrete starting tokens** (proposal, still not yet built — for Faiz to confirm before Sprint 1's
frontend pages are styled against them, so it's chosen once):

- Background: near-white (`#FAFAF9`/`#FFFFFF`), elevated surfaces (cards) a hair off that, not stark white-on-white.
- Text: near-black (`#111111`-ish primary, warm gray secondary/muted) — not pure `#000`.
- One accent color for links/primary actions/focus states — a single considered color, not a gradient.
- Data semantics: one green (gain/pass), one red (loss/fail), one amber (caution/hold) — used only for state, never decoration.
- Typography: one quiet sans-serif for everything (Inter or similar) + tabular figures (`font-variant-numeric: tabular-nums`) specifically for financial values — no separate "terminal mono" font family.
- Layout: fixed left nav (portfolio / holdings / thesis / macro as sprints add them) + a content area built around cards with real whitespace, not edge-to-edge tables.

This becomes real in Sprint 5 (the dashboard), but Sprint 1's first pages (holding list, holding
detail forms — not yet built) should be styled against these tokens from the start — the whole point
is not re-deciding this a fourth time once the dashboard sprint arrives.

## Sprints

### Sprint 0 — Foundation — ✅ closed 2026-09-21

| Item | Status |
|---|---|
| Recreate a lean guardrail doc | ✅ Done — `CLAUDE.md` |
| Map the real Supabase schema | ✅ Done — see table above |
| DB strategy decision | ✅ Decided |
| LLM provider decision | ✅ Decided |
| Remove leftover legacy multi-asset frontend (reset had missed it) | ✅ Done 2026-09-21 — commit `622ad08` |
| Skeleton FastAPI app (`/health`) | ✅ Done 2026-09-21 — commit `ec4c0de`. **Not deployed to Railway yet.** |
| Skeleton React/Vite app (health badge) | ✅ Done 2026-09-21 — commit `d1e9e36`. **Not deployed to Railway yet.** |
| Deploy both skeletons through the existing Dockerfiles to a real Railway URL | Not started |
| `MISTRAL_API_KEY` present in `backend/.env` | ✅ Done |
| Resolve `LLM_PROVIDER` mismatch (`anthropic` vs. `google_ai_studio`) | ✅ **Done this session** — Faiz confirmed `google_ai_studio`, `.env` fixed |
| Wire Gemini + Mistral providers with budget guard, retry/backoff and RPM pacing | ✅ **Done this session** — commit `72d3c03`, 44 tests passing |

### Sprint 1 — Equity data model & deterministic calculations — 🚧 in progress

| Deliverable | Detail | Status |
|---|---|---|
| SQLAlchemy models | `Account`, `Holding`, `PortfolioPosition`, `PortfolioSnapshot`, `Document`, `DocumentPage`, `DocumentChunk`, `FinancialLineItem` — equity-relevant fields only, built fresh against the real tables; `holdings.asset_class`/`portfolio_positions.acquired_at` simply never populated or queried for these paths | ✅ **Done this session** — commit `ff5ee54` |
| Document ingestion | PDF/PPTX/XLSX text + structured line-item extraction into `DocumentChunk`/`FinancialLineItem`, ready to feed the evidence packet Sprint 4 builds on | ⬜ Not started |
| Deterministic calculations module | A single, unit-tested module (no LLM involvement — Rule 1): ROIC, ROE, gross/operating/net margin, FCF, owner earnings, Net Debt/EBITDA, Net Debt/FCF, interest coverage, D/E, HHI (portfolio concentration), and trailing P/E, P/B, P/S, EV/EBITDA multiples | ✅ **Done this session** — commit `ff5ee54`, 33 tests, covers Brain Steps 1.3 and 2.1-2.2's arithmetic |
| Tests | The calculations module reaches solid unit-test coverage *before* anything (a prompt, an endpoint) is allowed to call it — covers Brain Steps 1.3 and 2.1-2.2's arithmetic | ✅ Done alongside the module above |
| Minimal API | Read/write for holdings & portfolio, read-only endpoints exposing the computed metrics above | ⬜ Not started |
| First real frontend pages | Holding list + holding detail, styled against the [Design & UX direction](#design--ux-direction-researched-2026-09-21) tokens from the start, not the old terminal classes | ⬜ Not started |

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

### Sprint 5 — Portfolio roll-up & dashboard

- Aggregate verdict/moat/valuation view across all holdings
- Single-purpose dashboard (equity only), built out fully against the Design & UX direction above
  (left nav, progressive disclosure, tabular figures, state-only color)
- Deterministic executive summary

### Sprint 6 — Evidence quality

- Per-document evidence budget, section-aware chunking

### Sprint 7 — Guardrail tooling

- Pre-commit hooks, CI workflow, secret-scanning

## Cleanup: delete the 6 leftover GitHub branches

Run from a terminal with GitHub push access:

```
git push origin --delete claude/next-development-phase-0cer0a
git push origin --delete claude/next-phase-development-16lo2r
git push origin --delete claude/next-phase-planning-3oboz6
git push origin --delete claude/project-review-progress-zr4tpn
git push origin --delete claude/update-and-pr-56vsmu
git push origin --delete fix/s3-path-style-addressing
```

## Changes / history

| Date | Summary |
|---|---|
| 2026-09-21 | **Sprint 0 closed, Sprint 1 started.** Faiz confirmed `LLM_PROVIDER=google_ai_studio` and the plan to finish Sprint 0 before starting Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, in-memory daily budget guard) — 44 tests. Then built `app/models/` (8 SQLAlchemy models against the real schema) and `app/services/calculations.py` (15 deterministic financial functions, Decimal-based) — 33 more tests. 77/77 backend tests passing this session; ruff clean aside from a confirmed pre-existing mount-permission artifact. Two commits made (`72d3c03`, `ff5ee54`), not yet pushed — no GitHub credentials in this session's shell. |
| 2026-09-21 | Status audit + planning pass: confirmed the repo (not the docs) had the real up-to-date state — docs/ mirror and the 3 skeleton commits were already pushed. Added the missing `MISTRAL_API_KEY` to `backend/.env` directly (was typed but unsaved), clearing Sprint 0's last blocker. Flagged an `LLM_PROVIDER` mismatch for Faiz to resolve. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and wrote up a concrete Design & UX direction — light, editorial, state-only color, tabular figures, progressive disclosure — replacing the never-finalized terminal aesthetic. Expanded Sprint 1 into concrete deliverables. |
| 2026-09-21 | Sprint 0 skeletons built: found and removed the legacy multi-asset frontend the original reset had missed (49 files, commit `622ad08`); built and locally tested a skeleton FastAPI backend with `/health` (commit `ec4c0de`, also fixed a Dockerfile that still referenced deleted top-level asset dirs); built and locally tested a skeleton React frontend with a health badge (commit `d1e9e36`). Since confirmed pushed and docs synced. Gemini+Mistral wiring was blocked on `MISTRAL_API_KEY`. |
| 2026-09-21 | Repo wiped except Railway/Supabase/GitHub config, committed and pushed as `8ad0221` ("reset") with full history preserved. Real Supabase data untouched. |
| 2026-09-21 | 3 open checkpoints decided: keep DB as-is, reuse Gemini+Mistral with resilience built in from day one, delete 6 leftover branches. |
| 2026-09-21 | Sprint 0 partially done: mapped the real 21-table Supabase schema from the kept Alembic migrations; recreated a lean `CLAUDE.md` guardrail doc; found `MISTRAL_API_KEY` missing from local `.env`. |
