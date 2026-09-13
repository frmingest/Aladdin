# Progress

One place to see what's built, what's not, and where the detail lives. The build phases below
are §26 of [`architecture.md`](architecture.md); the reasoning behind specific choices made while
building each one lives in [`docs/decisions/`](decisions/) (ADRs, numbered sequentially per
[ADR 0001](decisions/0001-record-architecture-decisions.md)).

This file tracks build phases and deployment readiness. It does not replace the ADRs — update
both when a phase completes: the ADR for *why*, this file for *how far along things are*.

## Build phases (architecture §26)

| Phase | Status | Summary |
|---|---|---|
| 0 — Foundation | ✅ Done | Repo structure, FastAPI backend, React+Vite+Tailwind frontend, Postgres via Docker Compose, Alembic, pytest scaffold, provider interfaces. Pushed to `main` on GitHub. |
| 1 — Portfolio + document ingestion | ✅ Done | Portfolio CSV/XLSX upload (canonical schema + real Nordnet export format), document upload (PDF/PPT/XLSX) with SHA-256 dedup + object storage, deterministic fact extraction from XLSX. No AI dependency, as specified. See [ADR 0002](decisions/0002-phase1-portfolio-and-document-ingestion.md), [ADR 0003](decisions/0003-nordnet-export-support.md). |
| 2 — Deterministic financial & market data | ✅ Done | yfinance-backed `MarketDataProvider`, `market_observations`/`fx_observations` tables, deterministic metrics (growth, margins, ROIC/ROE, multiples, dividend yield, FX, P&L, HHI concentration), `POST /portfolio/snapshots/{id}/valuation`. See [ADR 0004](decisions/0004-phase2-market-data-and-financial-metrics.md). |
| 3 — AI analysis | ⬜ Not started | Evidence packet / AnalysisContext, Buffett/Munger reasoning, structured LLM output, confidence, analysis runs, memo generation. |
| 4 — External research | ⬜ Not started | Central-bank data, macro research, sector research, scheduled refresh, caching. |
| 5 — Thesis & portfolio intelligence | ⬜ Not started | Thesis ledger, invalidation tracking, valuation cases, scenario analysis, portfolio-level synthesis and risk profiles. |
| 6 — Visualization | ⬜ Not started | Dashboard, allocation history, factor views, risk heatmaps, macro dashboard, thesis timeline. |

**Known gaps inside completed phases**, not yet worth their own phase:
- PDF/PPT structured financial-fact extraction (Phase 1 scope explicitly deferred this — XLSX only so far).
- Holdings ingested from a Nordnet export have no market-data symbol until set manually via
  `PATCH /portfolio/holdings/{id}` (no ticker exists in that export — see ADR 0003/0004).
- yfinance's live behavior is verified against mocked responses only; this build environment
  can't reach Yahoo Finance to smoke-test it for real (see ADR 0004's Consequences).
- No `black` formatting config committed — the codebase has never actually been run through
  `black`'s default line length (see ADR 0004's Consequences).

## Deployment readiness (Railway)

Not yet deployed anywhere. Gaps, as of Phase 2:

- [ ] `DATABASE_URL` pointed at Supabase and `alembic upgrade head` run against it (only ever run
      against SQLite in tests so far).
- [ ] A durable object-storage provider wired in (Supabase Storage or R2) — the only implemented
      provider is local-filesystem, which won't survive Railway's ephemeral disk.
- [ ] CORS middleware added to the FastAPI app — needed once frontend and backend are separate
      Railway services/origins; invisible locally because Vite's dev proxy hides it.
- [ ] A Dockerfile (or Railway-compatible build config) for the backend and a production build/serve
      setup for the frontend — neither exists yet, only `docker/docker-compose.yml` for local Postgres.
- [ ] Environment variables set in the Railway project (`DATABASE_URL`, `MARKET_DATA_PROVIDER`, etc.
      — `ANTHROPIC_API_KEY` isn't needed until Phase 3).
- [ ] End-to-end smoke test on the deployed instance: upload the real Nordnet export, set a
      `market_ticker`, refresh valuation, confirm the frontend renders it.

## Git status

Phases 0–2 are implemented in `E:\Aladdin`. Phase 0 is committed and pushed to
`github.com/frmingest/Aladdin` (`main`). Phases 1 and 2 are written to disk but **not yet committed
to git** — that's a manual step, still pending.
