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
| 6 — Visualization | ✅ Done | A `Dashboard` tab (now the default landing tab) covering every §19 visualization: portfolio composition, allocation drift, factor profile, portfolio risk heatmap + scenario impact + systemic/state risk detail, macro dashboard + sector research, and a per-holding drill-down (analysis comparison, evidence panel, thesis timeline, valuation scenarios). Built entirely on existing Phase 1-5 endpoints — no backend changes. See [ADR 0009](decisions/0009-phase6-visualization-dashboard.md). |
| 7 — Deployment & production hardening | 🟡 Code done, not yet deployed | `backend/Dockerfile` + `frontend/Dockerfile` (nginx static serve), CORS middleware (opt-in via `CORS_ALLOWED_ORIGINS`), single-user auth (`APP_AUTH_TOKEN`/`X-API-Key`, every domain router except `/health`), a durable S3-compatible object storage provider (`S3ObjectStorageProvider`, serves both `r2` and `supabase`) replacing `LocalObjectStorageProvider` for real deployments, `alembic upgrade head` run from the backend container's entrypoint. See [ADR 0010](decisions/0010-deployment-and-production-hardening.md) for what remains genuinely unverified (no live Railway/bucket/Postgres deploy from this build environment). |

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
- ~~No frontend page renders the Phase 4 research endpoints yet~~ — resolved by Phase 6's
  `MacroSection` (`frontend/src/pages/dashboard/MacroSection.tsx`).
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
- ~~No frontend page renders any Phase 5 endpoint yet~~ — resolved by Phase 6's `RiskSection` and
  `HoldingDetailSection` (thesis timeline, valuation scenarios). ~~Creating a thesis or a valuation
  case is still API-only~~ — resolved this pass: `HoldingDetailSection` now has a "+ New thesis" and
  a "+ New valuation case" inline form (see "Frontend data-entry" below, moved out of Smaller
  improvements).
- Correlation (Phase 5) depends on `MarketDataProvider.get_historical_prices` against real yfinance
  data, which — like every other yfinance/Gemini/FRED/Norges Bank call in this codebase — this build
  environment has no network path to smoke-test live (see ADR 0004/0005/0007's matching caveats).
- The Phase 6 risk heatmap's per-tile shading uses illustrative public reference conventions (US
  DOJ/FTC HHI bands, standard correlation-strength ranges), not the app's own versioned
  `scoring/versions/risk_v1.yaml` thresholds — `PortfolioRiskSnapshotOut` doesn't expose the
  per-dimension bands the backend computes internally. The overall `risk_band`/`composite_risk_score`
  shown alongside it are the real, authoritative assessment (see ADR 0009).
- The frontend has no project-wide ESLint config (`npm run lint` fails: "couldn't find an
  eslint.config.js file") — a Phase 0 gap Phase 6 didn't introduce or fix.
- `vite build`'s single JS bundle is ~600 kB (167 kB gzipped, mostly `recharts`) — no code-splitting
  yet; fine for a single-user personal app per §2.9, worth revisiting only for a public rollout.
- Building/smoke-testing the Phase 6 dashboard surfaced that pydantic v2 serializes every `Decimal`
  field as a JSON string throughout this API, not just the Phase 5 risk-snapshot JSON columns
  (`_json_safe`) previously documented — corrected across the frontend's TypeScript types (Phase 6's
  own new types plus a type-only fix to Phase 1/3's `types/portfolio.ts`/`types/analysis.ts`); see
  ADR 0009.
- ~~No application authentication exists anywhere in the codebase~~ — resolved by Phase 7's
  `APP_AUTH_TOKEN`/`X-API-Key` (see ADR 0010). Still only a single shared token, not a real
  user/session system — sufficient for §24's letter and §25's single-user scope, not more.
- §23 (Observability & Cost Tracking) is only half-built: `LLMAnalysisService`/`AnalysisRunResult`
  compute `total_input_tokens`/`total_output_tokens` per run (`app/services/analysis/llm_analysis.py`),
  but that figure is never persisted (no column on `analysis_runs`, no separate cost-log table) or
  surfaced anywhere — it's discarded after the run completes. Latency and estimated cost are not
  captured at all. The near-zero-cost objective §23 exists to make measurable currently isn't
  measurable after the fact.
- `backend/tests/golden_documents/` and `backend/tests/regression/` have existed as scaffolded
  packages (`__init__.py` only, no test files) since Phase 0 — architecture §22.2 (golden document
  extraction tests) and §22.3 (prompt/model regression tests) were never actually built despite the
  directories implying they had a home. All 31 existing test files live under `unit/`/`integration/`.
- `HoldingDetailSection`'s thesis-status color map didn't cover `INVALIDATED`
  (`app.models.thesis.InvestmentThesisStatus` has four values: ACTIVE/UNDER_REVIEW/INVALIDATED/CLOSED;
  the frontend map only had three) — an invalidated thesis silently rendered in the same neutral
  color as a healthy one. Fixed this pass; see "Frontend data-entry & UX review" below.

## Deployment readiness (Railway)

Not yet deployed anywhere. Phase 7 (see above, [ADR 0010](decisions/0010-deployment-and-production-hardening.md))
closed every code-level gap below; what's left is account/infrastructure setup and the first live
run, which this build environment has no network path to do itself.

- [x] A durable object-storage provider wired in (Supabase Storage or R2) — `S3ObjectStorageProvider`
      (`app/providers/s3_storage_provider.py`), selected via `OBJECT_STORAGE_PROVIDER=r2|supabase`.
      Untested against a real bucket (unit tests mock boto3) — first real upload/retrieve is still
      outstanding.
- [x] CORS middleware added to the FastAPI app — opt-in via `CORS_ALLOWED_ORIGINS` (see `main.py`).
- [x] A Dockerfile for the backend (`backend/Dockerfile`, built from the repo root — see ADR 0010)
      and a production build/serve setup for the frontend (`frontend/Dockerfile`, Vite build served
      via nginx). Neither has been through an actual `docker build` — this build environment's Docker
      daemon isn't reachable — only manually verified path arithmetic plus the existing
      `npm run build`/pytest suite.
- [x] Single-user application authentication (see next section) — `APP_AUTH_TOKEN`/`X-API-Key`,
      checked via `app/api/auth.py`, applied to every domain router.
- [ ] `DATABASE_URL` pointed at Supabase and `alembic upgrade head` run against it (only ever run
      against SQLite in tests, and once by hand against a throwaway local SQLite file to confirm
      all three migrations apply cleanly — never against real Postgres). Phase 7 wires
      `alembic upgrade head` into the backend container's entrypoint so this happens automatically
      on first deploy — still needs an actual Supabase/Postgres instance to run against.
- [ ] Environment variables set in the Railway project (`DATABASE_URL`, `MARKET_DATA_PROVIDER`,
      `GOOGLE_AI_STUDIO_API_KEY`, `APP_AUTH_TOKEN`, `CORS_ALLOWED_ORIGINS`,
      `OBJECT_STORAGE_PROVIDER`/`OBJECT_STORAGE_ENDPOINT_URL`/etc., `VITE_API_BASE_URL`/
      `VITE_API_KEY` as frontend build args, etc.).
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
- [x] Application authentication (architecture §24) — `APP_AUTH_TOKEN`, a shared bearer token
      checked via a FastAPI dependency (`app/api/auth.py`), gating every router except `/health`.

## Next phases & identified follow-up work

Reviewed 2026-09-13 against the current codebase (`backend/app`, `frontend/src`, `docs/`) to find
what's next after Phase 6, beyond what "Known gaps" above already tracks line-by-line. Phases 0-6
(architecture §26) are all complete — nothing here revises that. This is additive: candidate next
phases, plus improvements that don't need a phase of their own.

**Update, same day:** candidate #1 below (deployment & production hardening) is now Phase 7 — see
the phase table and [ADR 0010](decisions/0010-deployment-and-production-hardening.md). Its code-level
scope (Dockerfiles, CORS, single-user auth, durable object storage, migrations-on-boot) is done;
what's left is account/infrastructure setup and the first live deploy, which this build environment
cannot do itself (no reachable Docker daemon, no Railway/Supabase/R2 credentials or network path).
Candidates #2-#3 below are unaffected and still open.

**Update, 2026-09-14:** the "Frontend data-entry" smaller improvement below (creating a thesis or a
valuation case from the dashboard) is done — see "Frontend data-entry & UX review" below. Candidates
#2-#3 are unaffected and still open.

### Candidate next phases

1. ~~**Deployment & production hardening**~~ — now Phase 7 (see above). The actual Railway
   project/services, real secrets, and first live smoke test (yfinance, Gemini analysis + Search
   grounding, FRED, Norges Bank, a real Supabase/R2 bucket, real Postgres) remain outstanding — code
   readiness and infrastructure readiness are different things, and only the former was in this
   build environment's reach.
2. **Track-record & calibration engine** (architecture §22.5, `calibration_checks` table already
   specified in §20 but never migrated) — the one architecturally-specified capability with zero
   implementation. Scope: `calibration_checks` model + Alembic migration, a periodic (e.g.
   quarterly, APScheduler-driven like Phase 4's research refresh) job comparing each past
   `analysis_run`'s score/thesis_status against subsequent price movement and any new documents
   ingested since, and a read-only dashboard view (was high confidence associated with better
   outcomes?). Purely deterministic per §22.5 — no new LLM calls. Recommend after a real deploy
   exists since it needs weeks of real, live-deployed analysis history to be useful at all —
   building it against only synthetic/test data would just be untested code with nothing to
   calibrate against yet.
3. **Testing debt** — populate `tests/golden_documents/` (known source documents with expected
   extraction values, §22.2) and `tests/regression/` (fixed-`AnalysisContext` prompt/model
   comparison, §22.3), both empty since Phase 0. Also: add a `black` config and run the codebase
   through it once (currently never formatted); add the frontend's missing `eslint.config.js` so
   `npm run lint` stops failing outright, then fix whatever it flags.

### Smaller improvements (don't need their own phase)

- Persist §23's already-computed `total_input_tokens`/`total_output_tokens` (currently discarded
  after each analysis run) onto `analysis_runs`, plus latency and a rough estimated-cost figure —
  most of the plumbing already exists in `LLMAnalysisService`, this is largely wiring it to a column.
- Evidence-packet excerpt selection (§5.3) has no relevance ranking, just most-recent-first —
  worth revisiting once any holding accumulates more than one or two documents.
- Regime classification (§13.1) is a manual `active_macro_regime_profile` setting — could be
  informed by the macro snapshot instead, per the architecture's own suggested path.
- Jurisdictional concentration (§15.1) is proxied via `Holding.institution`; a dedicated
  custodian-country field would make it a verified value rather than an approximation.
- Norwegian wealth-tax estimate (§15.1) is single-bracket with no per-couple splitting — revisit
  fidelity if it's ever relied on for a real filing rather than a directional risk signal.
- `vite build`'s ~600 kB single bundle (mostly `recharts`) has no code-splitting — fine at
  single-user scale, worth it only before any wider rollout.
- PDF/PPT structured financial-fact extraction remains a deliberate non-goal (Phase 3 treats them
  as qualitative text, XLSX-only for structured facts) — revisit only if a holding's primary
  source material is consistently PDF-only with no XLSX equivalent.

## Frontend data-entry & UX review (2026-09-14)

Committed directly to `E:\Aladdin` (frontend only — no backend/API changes; both endpoints this
uses already existed). **Not yet committed to git** — same manual step as every prior phase, and
this pass additionally couldn't run `tsc`/`npm run build`/git itself (see "Manual follow-ups"
below) — verify before committing.

Closes the "Frontend data-entry" smaller improvement noted above:

- **New thesis form** (`HoldingDetailSection`) — a "+ New thesis" toggle opens an inline form
  (thesis, optional bull/bear case, key assumptions and invalidation conditions as one-per-line
  text, confidence) that POSTs to the existing `POST /thesis/holdings/{holding_id}`. Each thesis-
  ledger entry's status is now an editable control (PATCH `/thesis/{id}`) instead of static text,
  so a thesis can actually be moved to UNDER_REVIEW/INVALIDATED/CLOSED from the dashboard — before
  this, a thesis could be created via the API but never updated from the UI at all.
- **New valuation case form** (`HoldingDetailSection`) — a "+ New valuation case" toggle opens the
  DCF inputs (case type, the seven required assumption fields, projection years) with the
  currency/FX/commodity/base-revenue overrides tucked behind an "Advanced options" disclosure,
  plus a "run AI critique" checkbox (on by default) surfacing that this triggers an LLM call.
  POSTs to the existing `POST /valuation/holdings/{holding_id}/cases`.
- **Valuation case list** — previously a holding's valuation cases fed only the scenario bar chart;
  there was no way to see a case's confidence, calculation note, or AI critique anywhere in the UI.
  Added a compact list below the chart (case type, value, confidence, date) with the critique
  (assumptions-reasonable verdict, reasoning, key risks) behind a "Show critique" toggle per case.
- **Bug fix**: `THESIS_STATUS_COLOR` only mapped three of the four `InvestmentThesisStatus` values
  — `INVALIDATED` was missing, so an invalidated thesis rendered in the same neutral color as a
  healthy one instead of flagging as risk. Fixed (now red, matching the app's existing
  emerald/amber/red semantic convention).

No new dependencies, no design-system changes — both forms and the status control reuse this
codebase's existing form/button/card conventions (`bg-slate-900`/`border-slate-700` inputs, the
`bg-emerald-700` primary-button style already used by "Add account" and "Compute new risk
snapshot", the same `ApiError`-catching error-display pattern used throughout). A full UX pass
(applying the same review rigor as the CWO UX Designer skill, judged against Aladdin's own actual
tokens rather than that skill's Bloomberg-terminal palette — this app has no design-token file,
just Tailwind's slate scale + emerald/amber/red used consistently) is written up separately; the
one finding severe enough to fix immediately (the status-color gap above) is folded into this pass.

### Manual follow-ups for Faiz

- **This pass could not run `device_bash`** — a Windows update (2026-09-08) broke the
  `E:\Aladdin` mount for this session's device shell (tracked, Claude Code unaffected). All file
  edits went through the stage → edit → commit-back path instead, and unlike every prior phase's
  status note, **`tsc --noEmit`, `npm run build`, `npm run lint`, and the backend test suite were
  never run this pass** — please run `cd frontend && npx tsc --noEmit` (and ideally `npm run
  build`) before trusting this compiles cleanly.
- Manually exercise the two new forms once: create a thesis, change its status, create a bull/base/
  bear valuation case for a holding with a revenue fact on record, expand its critique.
- Git commit this work (still uncommitted, per the existing convention).
