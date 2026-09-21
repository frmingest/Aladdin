# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** the pre-wipe incremental redesign plan (ADR 0019/0020: "continue & consolidate, no
rebuild" — deleted from this repo in the 2026-09-21 reset, still readable as a Claude project doc).
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0 is underway — skeleton apps are up and tested locally.**

## Where things actually stand right now

| | |
|---|---|
| Repo | `main`, pushed through commit `d1e9e36` (see Sprint 0 table for what that includes). Full git history preserved — nothing force-pushed or squashed. |
| Kept on disk | `backend/Dockerfile`, `frontend/Dockerfile`, `docker/` (compose + entrypoint), `.dockerignore`, `frontend/nginx.conf` (Railway deploy) · `backend/alembic/` + `alembic.ini` (Supabase migration history) · `backend/.env` + both `.env.example` files · `.gitignore`, `.gitattributes` · `CLAUDE.md` |
| Corrected 2026-09-21 | The original reset only wiped `backend/app/`. `frontend/src/` still held the entire pre-rebuild multi-asset UI until this session — see Sprint 0 table. Now removed. |
| Real data | **Untouched, and staying that way** (Decision 1 below). Supabase still holds the real portfolio/holdings/analysis history, including legacy non-equity rows/columns. |

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

This repo's `CLAUDE.md` — 5 rules (deterministic arithmetic, evidence-first citations, versioned
prompts/schemas, blind-pass confirmation-bias guard, untrusted document text) plus git/status-honesty/
secrets discipline, plus a docs-sync rule (see "Changes / history" below).

## 3 open checkpoints — resolved (2026-09-21)

| # | Question | Decision |
|---|---|---|
| 1 | DB schema strategy | **Leave the existing Supabase schema and data exactly as-is.** No migration to strip non-equity tables/columns now. |
| 2 | LLM provider | **Reuse Google AI Studio (Gemini) + Mistral** via keys in `backend/.env`/Railway. Rate-limit resilience (budget guard, retry/backoff, RPM pacing) built in from day one this time. |
| 3 | Leftover GitHub branches | **Delete all 6** — commands below. Still pending. |

## Actual current Supabase schema (read from `backend/alembic/versions/`, 21 tables, no live DB connection needed)

No non-equity table exists — the old multi-asset design used a discriminator, not separate tables:
`holdings.asset_class` (string column) and `portfolio_positions.acquired_at` (nullable, added for
collectibles) are the only non-equity-specific fields, both on otherwise-shared, otherwise-equity
tables. Nothing to route around structurally — just don't populate/query those for non-equity rows.

| Table | From phase |
|---|---|
| `accounts`, `holdings`, `portfolio_positions`, `portfolio_snapshots`, `documents`, `document_pages`, `document_chunks`, `financial_line_items` | Phase 1 (portfolio + document ingestion) + accounts migration |
| `market_observations`, `fx_observations` | Phase 2 (market data & FX) |
| `analysis_runs`, `holding_analyses`, `factor_assessments`, `evidence_references` | Phase 3 (AI analysis engine) |
| `research_runs`, `research_items`, `macro_observations` | Phase 4 (external research) |
| `investment_theses`, `valuation_cases`, `portfolio_risk_snapshots` | Phase 5 (thesis & portfolio intelligence) |
| `llm_usage_events` | LLM usage ledger |

## ⚠️ Still open: local `.env` is missing `MISTRAL_API_KEY`

`backend/.env` has `GOOGLE_AI_STUDIO_API_KEY` populated but still **no `MISTRAL_API_KEY` line**
(only a commented template in `.env.example`) as of 2026-09-21. Faiz is adding it himself; the
Gemini+Mistral provider wiring (budget guard, retry/backoff, RPM pacing) is written only once that's
confirmed in place, so a real key never has to pass through chat/session docs.

## Sprints

### Sprint 0 — Foundation

| Item | Status |
|---|---|
| Recreate a lean guardrail doc | ✅ Done — `CLAUDE.md` |
| Map the real Supabase schema | ✅ Done — see table above |
| DB strategy decision | ✅ Decided |
| LLM provider decision | ✅ Decided |
| Remove leftover legacy multi-asset frontend (reset had missed it) | ✅ Done 2026-09-21 — commit `622ad08` |
| Skeleton FastAPI app (`/health`) | ✅ Done 2026-09-21 — commit `ec4c0de`. Tested locally (`uvicorn` + `curl /health` → 200 OK). **Not deployed to Railway yet.** |
| Skeleton React/Vite app (health badge) | ✅ Done 2026-09-21 — commit `d1e9e36`. Tested locally (`npm run lint` + `npm run build` clean). **Not deployed to Railway yet.** |
| Deploy both skeletons through the existing Dockerfiles to a real Railway URL | Not started |
| Wire Gemini + Mistral providers with budget guard, retry/backoff and RPM pacing | ⏸️ Blocked on `MISTRAL_API_KEY` being added to `backend/.env` |

### Sprint 1 — Equity data model & deterministic calculations

- Holding/portfolio models — **equity only** — built fresh against the real tables above (`holdings`,
  `portfolio_positions`, `accounts`, etc.), simply never touching the legacy `asset_class`/
  `acquired_at` non-equity paths
- Document ingestion (PDF/PPTX/XLSX extraction)
- Deterministic calculations module: ROIC, ROE, margins, FCF, Net Debt/EBITDA, Net Debt/FCF,
  interest coverage, D/E, HHI, multiples — unit-tested before anything calls them from a prompt
- Covers Brain Steps 1.3 and 2.1-2.2's arithmetic

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
- Single-purpose dashboard (equity only)
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
| 2026-09-21 | Sprint 0 skeletons built: found and removed the legacy multi-asset frontend the original reset had missed (49 files, commit `622ad08`); built and locally tested a skeleton FastAPI backend with `/health` (commit `ec4c0de`, also fixed a Dockerfile that still referenced deleted top-level asset dirs); built and locally tested a skeleton React frontend with a health badge (commit `d1e9e36`). Pushed to `main`. Gemini+Mistral wiring still blocked on `MISTRAL_API_KEY`. Added a docs-sync rule to `CLAUDE.md`: every update to the Claude project's `progress.md`/sprint plan now also syncs `docs/PROGRESS.md` and this file in the same change, so GitHub reflects current state too. |
| 2026-09-21 | Repo wiped except Railway/Supabase/GitHub config, committed and pushed as `8ad0221` ("reset") with full history preserved. Real Supabase data untouched. |
| 2026-09-21 | 3 open checkpoints decided: keep DB as-is, reuse Gemini+Mistral with resilience built in from day one, delete 6 leftover branches. |
| 2026-09-21 | Sprint 0 partially done: mapped the real 21-table Supabase schema from the kept Alembic migrations; recreated a lean `CLAUDE.md` guardrail doc; found `MISTRAL_API_KEY` missing from local `.env`. |
| 2026-09-21 | This plan and `docs/PROGRESS.md` added to the repo itself (previously only in the Claude project). |
