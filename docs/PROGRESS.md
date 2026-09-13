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
| 4 — External research | ✅ Done | Hybrid FRED + Norges Bank `MacroDataProvider` for central-bank/macro numeric series, Gemini + Google Search grounding `ResearchProvider` for macro-news and sector research, `research_runs`/`research_items`/`macro_observations` tables, APScheduler background refresh (macro daily, sector research weekly per distinct sector) plus manual `POST /research/*/refresh` endpoints, `AnalysisContext` wired to cite macro/sector research as evidence. See [ADR 0007](decisions/0007-phase4-external-research.md). |
| 5 — Thesis & portfolio intelligence | ✅ Done | Investment thesis ledger (`investment_theses`, replacing `PortfolioPosition.notes` as Phase 3's reconciliation-guardrail input) with a deterministic invalidation-signal check; deterministic DCF valuation engine (`app.domain.valuation`) plus a best-effort LLM assumption critique (§17); deterministic scenario-impact engine (`app.domain.scenarios`, `scenarios/versions/v1.yaml`, the eight §18 scenarios) over concentration exposures; portfolio risk snapshots (`portfolio_risk_snapshots`) covering concentration (reused from Phase 2), correlation, currency/commodity exposure, systemic/state risk (§15.1 — deposit concentration vs. guarantee limit, custody-type breakdown, Norwegian wealth-tax estimate, institution-proxied jurisdictional concentration), a worst-dimension risk band, and a secondary composite score (`scoring/versions/risk_v1.yaml`). See [ADR 0008](decisions/0008-phase5-thesis-and-portfolio-intelligence.md). |
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
- Norges Bank's exact dataset/key for the `no_policy_rate` series (`research/versions/v1.yaml`) is a
  best-effort reading of Norges Bank's published API guide, not confirmed against a live response —
  this build environment has no network path to `data.norges-bank.no` (see ADR 0007's Consequences).
- FRED's and Gemini's grounded-search request/response shapes are likewise verified only against
  documentation and the installed SDK, not a live call (see ADR 0007's Consequences, matching ADR
  0004/0005's yfinance/Gemini-analysis caveats). A real `FRED_API_KEY` (free at
  https://fred.stlouisfed.org/docs/api/api_key.html) is required before macro refresh does anything.
- `recent_events` on `AnalysisContext` remains unbuilt — macro/sector narrative items partially cover
  the need, but dedicated holding-specific event detection is deferred (see ADR 0007).
- No frontend page renders the Phase 4 research endpoints yet (`GET /research/macro/snapshot`,
  `GET /research/sectors/{sector}/items`) — API-only this phase, matching how Phase 2's market data
  landed before Phase 3 added a frontend page.
- No calibration/track-record engine (architecture §22.5) — `check_invalidation_signal`
  (Phase 5, per-thesis) covers a related but narrower need; the periodic, portfolio-wide "was high
  confidence associated with better outcomes" dashboard, with its own `calibration_checks` table, is a
  deliberate, documented follow-up (see ADR 0008).
- The DCF valuation engine and the scenario-shock registry are both illustrative/directionally-reasoned,
  not fitted to or validated against real market data (see ADR 0008) — same caveat the architecture
  doc's own §18 example carries.
- Jurisdictional concentration (§15.1) is approximated via `Holding.institution`, not a dedicated
  custodian-country field — a reasonable proxy for Faiz's own portfolio, not a verified jurisdiction.
- The Norwegian wealth-tax estimate (§15.1) only runs when a snapshot's `reporting_currency` is NOK, and
  is a simplification of the real rules (single bracket, no per-couple splitting) — see
  `app.config.settings.Settings`'s wealth-tax fields and ADR 0008.
- No portfolio-risk LLM narrative (`PortfolioRiskSnapshot.narrative` is a short, deterministic,
  code-generated summary, not LLM prose) — a deliberate scope decision this phase, see ADR 0008.
- No frontend page renders any Phase 5 endpoint yet (`/thesis/...`, `/valuation/...`,
  `/portfolio/.../risk-snapshot(s)`) — API-only this phase, matching the Phase 2/Phase 4 precedent.
- Correlation (Phase 5) depends on `MarketDataProvider.get_historical_prices` against real yfinance
  data, which — like every other yfinance/Gemini/FRED/Norges Bank call in this codebase — this build
  environment has no network path to smoke-test live (see ADR 0004/0005/0007's matching caveats).

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
- [ ] `FRED_API_KEY` obtained (free at https://fred.stlouisfed.org/docs/api/api_key.html) and set in
      `backend/.env` — macro refresh fails immediately with an explicit error until this is set (see
      ADR 0007); Norges Bank's dataset/key also needs a one-time live verification (see that ADR's
      Consequences).
- [ ] End-to-end smoke test on the deployed instance: upload the real Nordnet export, set a
      `market_ticker`, refresh valuation, upload a document, run an analysis, confirm the frontend
      renders the result and memo.
- [ ] Phase 5's DCF valuation critique and portfolio-risk correlation depend on the same
      `GOOGLE_AI_STUDIO_API_KEY` (critique) and live `MarketDataProvider.get_historical_prices`
      (correlation) as Phase 3/2 — no new secrets needed, but neither has been smoke-tested live from
      this build environment (see ADR 0008's Consequences).

## Git status

Phases 0-5 are committed to the `claude/next-development-phase-0cer0a` branch of
`github.com/frmingest/Aladdin`.
