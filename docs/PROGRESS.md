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
| 3 — AI analysis | ✅ Done | Evidence packet / AnalysisContext, Google AI Studio (Gemini) `LLMProvider`, two-pass Buffett/Munger analysis with confirmation-bias guardrail, structured LLM output + schema contract, deterministic scoring, `analysis_runs`/`holding_analyses`/`factor_assessments`/`evidence_references`, memo generation, `POST /analysis/snapshots/{id}/runs` + read endpoints, bare-bones frontend page. See [ADR 0005](decisions/0005-phase3-google-ai-studio-llm-provider.md), [ADR 0006](decisions/0006-phase3-ai-analysis-engine.md). |
| 4 — External research | ⬜ Not started | Central-bank data, macro research, sector research, scheduled refresh, caching. |
| 5 — Thesis & portfolio intelligence | ⬜ Not started | Thesis ledger, invalidation tracking, valuation cases, scenario analysis, portfolio-level synthesis and risk profiles. |
| 6 — Visualization | ⬜ Not started | Dashboard, allocation history, factor views, risk heatmaps, macro dashboard, thesis timeline. |

**Known gaps inside completed phases**, not yet worth their own phase:
- PDF/PPT structured financial-fact extraction remains XLSX-only, by deliberate choice, not
  oversight — Phase 3 reads PDF/PPT text as qualitative LLM evidence instead of extracting
  structured line items from it (see ADR 0006).
- Holdings ingested from a Nordnet export have no market-data symbol until set manually via
  `PATCH /portfolio/holdings/{id}` (no ticker exists in that export — see ADR 0003/0004).
- yfinance's live behavior is verified against mocked responses only; this build environment
  can't reach Yahoo Finance to smoke-test it for real (see ADR 0004's Consequences).
- Google AI Studio's live behavior is likewise verified only against the installed `google-genai`
  SDK's documented shapes, not a real API call — this build environment has no network path to
  Gemini either. A manual smoke test with a real `GOOGLE_AI_STUDIO_API_KEY` is a recommended
  follow-up (see ADR 0005's Consequences).
- Evidence-packet excerpt selection has no relevance ranking (most-recent-documents-first, in
  page order, until a character budget runs out — see ADR 0006). Fine for one recent report per
  holding; will under-serve a holding with many/older documents.
- No `black` formatting config committed — the codebase has never actually been run through
  `black`'s default line length (see ADR 0004's Consequences).

## Deployment readiness (Railway)

Not yet deployed anywhere. Gaps, as of Phase 3:

- [ ] `DATABASE_URL` pointed at Supabase and `alembic upgrade head` run against it (only ever run
      against SQLite in tests, and once by hand against a throwaway local SQLite file to confirm
      all three migrations apply cleanly — never against real Postgres).
- [ ] A durable object-storage provider wired in (Supabase Storage or R2) — the only implemented
      provider is local-filesystem, which won't survive Railway's ephemeral disk.
- [ ] CORS middleware added to the FastAPI app — needed once frontend and backend are separate
      Railway services/origins; invisible locally because Vite's dev proxy hides it.
- [ ] A Dockerfile (or Railway-compatible build config) for the backend and a production build/serve
      setup for the frontend — neither exists yet, only `docker/docker-compose.yml` for local Postgres.
- [ ] Environment variables set in the Railway project (`DATABASE_URL`, `MARKET_DATA_PROVIDER`,
      `GOOGLE_AI_STUDIO_API_KEY`, etc.).
- [ ] `GOOGLE_AI_STUDIO_API_KEY` obtained and set in `backend/.env` — analysis runs fail immediately
      with an explicit error until this is set (see ADR 0005); a live smoke test against the real
      Gemini API is still outstanding (this build environment has no network path to it).
- [ ] End-to-end smoke test on the deployed instance: upload the real Nordnet export, set a
      `market_ticker`, refresh valuation, upload a document, run an analysis, confirm the frontend
      renders the result and memo.

## Git status

Phases 0–3 are implemented in `E:\Aladdin`. Phase 0 is committed and pushed to
`github.com/frmingest/Aladdin` (`main`). Phases 1, 2, and 3 are written to disk but **not yet
committed to git** — that's a manual step, still pending.
