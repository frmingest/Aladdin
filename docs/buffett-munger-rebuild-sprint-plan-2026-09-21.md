# Aladdin → Buffett/Munger Advisor — Rebuild Sprint Plan (from scratch)

**Supersedes** [buffett-munger-redesign-sprint-plan-2026-09-20.md](buffett-munger-redesign-sprint-plan-2026-09-20.md).
That doc planned an *incremental* redesign (ADR 0019/0020: "continue & consolidate, no rebuild").
On 2026-09-21 Faiz overrode that decision and had the repo wiped to a clean slate. This doc plans
the rebuild from that clean slate. **Sprint 0, 1, 2, and 3 are all closed.** **Sprint 4 (the
Buffett/Munger persona & two-pass analysis engine) has its backend built this session** — evidence
packet, versioned schema/prompts, blind pass, reconciliation pass, orchestration, per-holding notes,
and the `/analysis` API are all done and tested against fakes; the frontend is deliberately deferred
to a follow-up session, same split as Sprint 3.

## Where things actually stand right now (audited 2026-09-21, eleventh session pass)

| | |
|---|---|
| Repo | `main`, verified clean and fully pushed at the start of this session (`f0d71b4`) — this session's own commit(s) for Sprint 4's backend are local only until Faiz pushes, same recurring `could not read Username for 'https://github.com'` credential gap every session has hit. |
| **Sprint 4 backend built this session.** | New tables `equity_analysis_runs`/`equity_holding_notes` (migration `b5e1a9c3d7f2`, a fresh schema per CLAUDE.md Rule 3, not an extension of the legacy Phase-3 tables); versioned output schema (`app/domain/analysis_schema/v1.py`) and assumptions (`app/domain/analysis_assumptions/v1.py`); versioned prompts (`prompts/analysis/{blind,reconciliation}_v1.md`); the evidence-packet builder (`app/services/analysis/evidence_packet.py`, reusing Sprint 1's calculations, Sprint 2's research, and Sprint 3's valuation unchanged); the blind pass and reconciliation pass (`app/services/analysis/{blind_pass,reconciliation_pass}.py`); the orchestration pipeline (`app/services/analysis/pipeline.py`); per-holding notes CRUD (`app/services/analysis/notes.py`); and the `/analysis` API (`app/api/analysis.py`). |
| Scope decisions Faiz made before this session's build (all "Recommended", via clarifying questions) | Build the full evidence packet + two-pass pipeline this session, backend only (frontend deferred — Decision 15 below); build both passes now with notes optional rather than shipping the blind pass alone first (Decision 16); don't touch document-extraction quality this session (Decision 17). |
| Verification before/after building | Fresh Linux venv (this session's own — the repo's checked-in `.venv/` is a Windows venv, incompatible here, same limitation every session hits), 288/288 pre-existing backend tests passing before starting, 307/307 after (19 new), ruff clean on every new/changed file (only the same pre-existing `EXE002` file-permission noise elsewhere). Migration verified both directions via `alembic upgrade/downgrade --sql` against the Postgres dialect offline (no live DB reachable from this session). |
| **Discovered this session, not fixed** | A holding created through the plain `POST /holdings` endpoint (rather than the CSV-import path) defaults `Holding.asset_class_raw` to `"equity"` — which is **not** in `EQUITY_ANALYZABLE_TYPES` (`stock`, `equity_etf`; see `app/domain/instrument_types.py`). Sprint 4 is the first place that gate is actually enforced (`POST /analysis/holdings/{id}/run` returns 422 for a non-analyzable holding), so a manually-added holding would be rejected until re-tagged. Faiz's real 124 imported positions already carry correct tags via the CSV importer's own classifier, so this doesn't affect existing data — it's a gap for the not-yet-built "add a holding by hand" flow. Left as-is (a Sprint 1 model-default decision, out of this session's scope). |
| **Also still discovered, still not fixed (three sessions running now)** | The real (gitignored) `backend/.env` still has `MARKET_DATA_PROVIDER=stub` and `RESEARCH_PROVIDER=stub`. This now blocks more than before: Sprint 4's evidence packet calls both the valuation engine and all three research kinds, so the analysis pipeline cannot produce a real result until these are set to real providers (`yfinance`, `gemini_search`) — flagged in `progress.md`'s "Needs from Faiz" table, now with more urgency. |
| Deployment | Not touched this session — no Railway deploy attempted. Per the prior session's evidence (real screenshots/logs), the app was already confirmed deployed and running against real data before this session started. |
| Real data | This session's entire Sprint 4 build was tested against fakes only (in-memory SQLite, fake LLM/market-data/risk-free-rate/research providers) — **no real Gemini/Mistral call, no real market data, and no run against any of Faiz's actual 124 real holdings** has happened yet. That's the natural next check once the stub-provider config above is fixed. |

## The Brain's 5 steps — what the rebuild has to deliver

| Step | What it asks for | Where it now lives |
|---|---|---|
| Opening | Live macro/geopolitical research (rates, inflation, conflicts, currencies, regulation, sector trends), per portfolio and per holding | Sprint 2 (`/research/*`), folded into Sprint 4's evidence packet as `macro_research`/`sector_research`/`company_research` items |
| 1. Business Quality & Moat | Circle of competence summary, moat rating (Wide/Narrow/None across 7 sources), 3-5yr avg ROIC/ROE/margins vs. a hurdle (~15%) | Sprint 4: `MoatAssessment` (LLM judgment, evidence-cited) over a deterministic ROE-history + hurdle comparison the evidence packet computes in Python (ROIC stays flagged not-computable — see below) |
| 2. Financial Fortress | Net Debt/FCF, Net Debt/EBITDA, interest coverage, D/E; owner earnings/FCF trend vs. net income; earnings quality | Sprint 4: deterministic ratios from `app/services/calculations.py`, narrated by `financial_fortress` |
| 3. Macro & Industry Stress Test | Rate sensitivity, inflation/demand/pricing-power sensitivity, geopolitical/regulatory/commodity/FX/supply-chain risk, cyclical positioning | Sprint 4: `macro_stress_test`, synthesizing the Sprint 2 research items in the packet |
| 4. Valuation & Margin of Safety | Multiples vs. history/peers, DCF (base/bull/bear), reverse DCF, margin of safety | Sprint 3 computes all of it; Sprint 4's `valuation_synthesis` narrates the already-computed numbers, never recomputes them |
| 5. Verdict | Strong Buy/Buy/Hold/Sell/Avoid, 3-bullet thesis, top-2 downside risks, price target range, 3-5 metrics to monitor, what would change the thesis | Sprint 4: `VerdictContent` — except the price target range, which `app/services/analysis/pipeline.py` sets deterministically from the Sprint 3 DCF bear/bull scenarios, never generated by the LLM (CLAUDE.md Rule 1) |

ROIC is honestly reported as not-computable in the evidence packet (needs NOPAT/invested capital,
neither derived from extracted facts today — same gap `app/services/metrics.py` already documented
for Sprint 1's `/holdings/{id}/metrics`) rather than estimated. ROE *is* computed directly via
`app/services/calculations.roe()` (net_income/total_equity are both extracted facts) even though
`app/services/metrics.py` itself deliberately always skips ROE alongside ROIC for that endpoint's own
reasons — Sprint 4 doesn't go through that module for ROE, to avoid inheriting a skip that doesn't
apply to it.

## Non-negotiable design rules

The repo's `CLAUDE.md` — 5 rules (deterministic arithmetic, evidence-first citations, versioned
prompts/schemas, blind-pass confirmation-bias guard, untrusted document text) plus git/status-honesty/
secrets discipline. Sprint 4 is the sprint where all 5 actually get exercised at once for the first
time: Rule 1 (price target from Python, not the LLM), Rule 2 (every schema section carries
`evidence_ids`, checked against the real packet), Rule 3 (schema/assumptions/prompts are all
versioned files), Rule 4 (a dedicated test proves the blind pass's prompt text never contains a
holding's notes), Rule 5 (both prompts explicitly frame evidence/notes as data, never instructions).

## Open checkpoints — all resolved

| # | Question | Decision |
|---|---|---|
| 1 | DB schema strategy | **Leave the existing Supabase schema and data exactly as-is.** No migration to strip non-equity tables/columns now. |
| 2 | LLM provider | **Reuse Google AI Studio (Gemini) + Mistral** via keys in `backend/.env`/Railway. Rate-limit resilience built in from day one — done. |
| 3 | Leftover GitHub branches | **Deleted** — confirmed gone from `origin`. |
| 4 | Portfolio position entry: require a real document, or allow manual entry? | **Require a real uploaded document.** |
| 5 | Sprint 2 research vendor | **Gemini + Google Search grounding**, reusing the Google AI Studio key/infra. |
| 6 | Portfolio CSV import: skip non-equity rows or import everything? | **Import every row, tagged with its real instrument type.** |
| 7 | Whisky/collectibles CSV in the same batch — support it too? | **No — skipped**, out of scope. |
| 8 | Portfolio delete UI: granular only, or add a bulk "delete everything"? | **Granular only**, superseded later — Faiz asked for a bulk wipe after real-world use; built. |
| 9 | Sprint 2 next-phase scope | **Finish Sprint 2: research UI.** |
| 10 | Sprint 3 market/FX/beta data source | **yfinance.** |
| 11 | Sprint 3 discount-rate methodology | **Live risk-free rate + a versioned equity-risk-premium assumption (CAPM).** |
| 12 | Sprint 3 session scope | **Backend only that session**, frontend as a follow-up (done). |
| 13 | Snapshot delete FK violation: block, cascade, or two-step force? | **Cascade-delete the legacy analysis_runs chain.** |
| 14 | Bulk portfolio wipe scope | **Accounts + snapshots + positions only** — Holdings/Documents untouched. |
| 15 | Sprint 4 session scope | **Full evidence packet + two-pass engine, backend only** (Recommended) — frontend deferred to a follow-up session, mirroring Sprint 3's split. |
| 16 | Sprint 4 user-notes input: build now or ship blind pass alone first? | **Build both passes now, notes optional** (Recommended) — an empty-notes holding still gets a reconciliation pass, just with less to weigh against the blind evidence-based view. |
| 17 | Sprint 4 document-extraction quality: fix now or defer? | **Defer** (Recommended) — ship the analysis engine against what Sprint 1's ingestion already extracts; revisit only if real runs show it's actually the bottleneck. |
| 18 | Deleting documents/holdings (2026-09-23, supersedes #14's "Documents untouched") | **Allowed, always `confirm=true`:** one document, all of a holding's data, cascade holding delete, and a holdings clean slate that requires the portfolio wiped first. Stored files removed after the DB commit. Spend history (`llm_usage_events`) and FX/rate reference data are never deleted. |
| 19 | Metric definitions (2026-09-23) | **Owner's view (Buffett/Munger):** hybrid capital is debt (net debt, D/E on ordinary equity); FCF = CFO − capex − decommissioning − financing-classified interest − lease payments − hybrid coupons; owner earnings also deduct decommissioning + lease payments (shared by panel, evidence packet and DCF); EBIT/EBITDA exclude biological fair-value changes; a ratio over a denominator ≤ 0 is *n/m*. See [owner-view-metrics-and-local-worker-plan-2026-09-23.md](owner-view-metrics-and-local-worker-plan-2026-09-23.md). |
| 20 | Using the local LLM from Railway (2026-09-23) | **Recommended: a worker on Faiz's PC pulls queued runs from the shared database** (no tunnel, no inbound port). Built in Sprint 5B (F8, with F5), `18e8a4e`. |
| 21 | Where research runs for a local run (2026-09-23) | **On the PC.** The worker does research (Gemini), the evidence packet and both passes (Ollama) in one place, so a run is never half-done across two machines. |
| 23 | Fund / ETF figures (2026-09-24) | **Typed in on a Fund facts form, each row citing an uploaded document (+ page), plus a deterministic holdings-file (CSV/XLSX) import** — no LLM reads a fund figure out of a PDF. First look-through: weights + holdings linked to the app's companies (with coverage %). Built in Sprint 8, `8847311`. See [fund-etf-analysis-sprint8-2026-09-24.md](fund-etf-analysis-sprint8-2026-09-24.md). |
| 24 | Numeric macro data (2026-09-24) | **Core set of 13 series (Norges Bank, SSB, FRED) + 3 derived, used on the Macro page, the dashboard and in the analysis** (evidence packet v5 / fund-v2, cited `macro_indicator` items). No prompt or schema change. Built `c4b2ed2`, `551a141`. See [macro-data-and-guardrails-sprint7-2026-09-24.md](macro-data-and-guardrails-sprint7-2026-09-24.md). |
| 22 | Sprint 6 evidence selection (2026-09-24) | **Deterministic keyword + section rules, ~4,000-token budget** (no embeddings). Uploaded document passages enter the evidence packet (v4) as quoted, cited `document_excerpt` items; prompts v2. Built `71ec23b`. See [evidence-quality-sprint6-2026-09-24.md](evidence-quality-sprint6-2026-09-24.md). |

## Actual current Supabase schema

No non-equity table exists — the old multi-asset design used a discriminator, not separate tables.
`holdings.asset_class`/`asset_class_raw` are the only non-equity-specific fields, both on otherwise-
shared tables.

| Table | From phase |
|---|---|
| `accounts`, `holdings`, `portfolio_positions`, `portfolio_snapshots`, `documents`, `document_pages`, `document_chunks`, `financial_line_items` | Phase 1 — fully built this rebuild |
| `market_observations`, `fx_observations` | Phase 2 — built in Sprint 3 |
| `risk_free_rate_observations` | New table + migration in Sprint 3 |
| `analysis_runs`, `holding_analyses`, `factor_assessments`, `evidence_references` | Phase 3 — legacy, mapped read/delete-only (`app/models/legacy_analysis.py`) so a snapshot delete can cascade-purge them. **Sprint 4 built its own fresh schema instead** (`equity_analysis_runs`, `equity_holding_notes`) rather than extending these, per CLAUDE.md Rule 3. |
| `research_runs`, `research_items` | Phase 4 — built in Sprint 2 |
| `macro_observations` | Phase 4 table, **used since 2026-09-24** for Norges Bank / SSB / FRED series (+ `source_series_id`, migration `a9b0c1d2e3f4`); new `macro_series_status` alongside |
| `investment_theses`, `valuation_cases`, `portfolio_risk_snapshots` | Phase 5 — still unused; `investment_theses`/`valuation_cases` are natural homes for a future "persist the reconciliation verdict over time" feature, not built this session |
| `llm_usage_events` | Not yet re-created this rebuild; `app/providers/budget.py`'s in-memory guard is still the placeholder. Sprint 4's LLM calls are not yet logged here either — a natural pairing with the Backlog's "LLM usage ledger" item |
| `equity_analysis_runs`, `equity_holding_notes` | **New this session (Sprint 4)** — see migration `b5e1a9c3d7f2` |

## Design & UX direction (researched 2026-09-21; tokens implemented in `frontend/tailwind.config.js`)

Unchanged this session (no frontend work) — see the Sprint 3 section below for the last time this
direction was exercised. Sprint 4's frontend, whenever it's built, is the next place it applies: a
holding's analysis view (moat/verdict/price-target cards) should follow the same card/table/chart,
one-quiet-accent-color conventions already established.

## Sprints

### Sprint 0 — Foundation — ✅ closed

All items done — see `progress.md`.

### Sprint 1 — Equity data model & deterministic calculations — ✅ closed

SQLAlchemy models, deterministic calculations module, document ingestion, minimal API, first
frontend pages — see `progress.md` for commit-level detail.

### Sprint 2 — Live research (evidence-first) — ✅ closed

Research data model, `GeminiResearchProvider`, versioned prompts, staleness-checked caching, `/research`
API, frontend UI — see `progress.md`. Numeric macro data and a background scheduler deliberately
deferred (Backlog).

### Portfolio CSV import + delete UI — ✅ done (pulled forward from Sprint 4)

Broker-CSV parser, instrument-type classifier, ingestion service, `POST /portfolio/import-csv`,
frontend Portfolio page — see `progress.md`.

### Portfolio delete fixes, page-load speed, first portfolio-level chart, whisky grouping — ✅ done (out-of-sequence)

Cascade-safe deletes, bulk wipe, 2N+1 query fixes, first chart, whisky grouping — see `progress.md`.

### Sprint 3 — Valuation engine — ✅ fully closed (backend + frontend)

Live market-data/risk-free-rate providers, staleness-cached services, versioned assumptions,
deterministic DCF/reverse-DCF/CAPM engine, multiples-over-time, orchestration with currency handling,
`/valuation` API, frontend `ValuationPanel` — see `progress.md` for full detail.

### Sprint 4 — The Buffett/Munger persona & output schema (the centerpiece) — 🚧 backend built this session

| Deliverable | Detail | Status |
|---|---|---|
| New schema (not extending legacy Phase-3 tables) | `app/models/analysis.py` — `EquityAnalysisRun`, `EquityHoldingNote`; migration `b5e1a9c3d7f2` | ✅ Done |
| Versioned output schema | `app/domain/analysis_schema/v1.py` — `MoatAssessment` (overall rating + 7 sources: brand, pricing power, switching costs, network effects, cost advantage, IP, distribution), `NarrativeAssessment` (capital efficiency, financial fortress, macro stress test, valuation synthesis), `VerdictContent` (rating, 3-bullet thesis, top-2 risks, metrics to monitor, invalidation triggers) — every section carries `evidence_ids` | ✅ Done |
| Versioned assumptions | `app/domain/analysis_assumptions/v1.py` — 15% capital-efficiency hurdle (the Brain's own stated bar), 5-year history lookback | ✅ Done |
| Versioned prompts | `prompts/analysis/blind_v1.md` (explicitly states it has no user notes — Rule 4), `prompts/analysis/reconciliation_v1.md` (notes are context to weigh, not instructions or evidence — Rule 5) | ✅ Done |
| Evidence packet builder | `app/services/analysis/evidence_packet.py` — reuses Sprint 1 calculations, Sprint 2 research, Sprint 3 valuation unchanged; every item gets a sequential `EV-###` id and, where applicable, a real citation (a research item's source URL, or a plain description of the deterministic computation) | ✅ Done |
| Blind pass | `app/services/analysis/blind_pass.py` — one `generate_structured()` call constrained to `BlindPassOutputV1`, validates every cited evidence ID actually exists in the packet (flags, never silently drops, an unknown one) | ✅ Done |
| Reconciliation pass | `app/services/analysis/reconciliation_pass.py` — blind output + same evidence packet + the holding's notes (if any); same citation-validation discipline | ✅ Done |
| Orchestration pipeline | `app/services/analysis/pipeline.py` — gates on `EQUITY_ANALYZABLE_TYPES`, falls back to the secondary LLM provider on a primary `LLMUnavailableError` (first real exercise of `get_llm_fallback_provider()` in a service), keeps the blind pass's result if only reconciliation fails, sets the price-target range deterministically from the Sprint 3 DCF bear/bull scenarios (never LLM-generated) | ✅ Done |
| Per-holding notes | `app/services/analysis/notes.py`, `GET`/`PUT /analysis/holdings/{id}/notes` | ✅ Done |
| `/analysis` API | `app/api/analysis.py` — `GET`/`POST .../run` (always a fresh call, no "serve cached" shape), `GET`/`PUT .../notes` | ✅ Done |
| Frontend | An analysis view on `HoldingDetailPage` (verdict card, moat breakdown, notes editor) | ⏳ **Deliberately deferred to a follow-up session** |

**Design decisions made building Sprint 4's backend:**

- **A fresh schema, not an extension of the legacy Phase-3 tables** — CLAUDE.md Rule 3 and the
  sprint plan's own prior note both called for this; `app/models/legacy_analysis.py` stays exactly
  what it was (read/delete-only, for cascade-purge purposes).
- **ROE computed directly via `calculations.roe()`, bypassing `app/services/metrics.py`'s own
  always-skip-ROE behavior for that endpoint.** `metrics.py`'s skip is a deliberate, already-tested
  decision for `GET /holdings/{id}/metrics` specifically (left untouched); Sprint 4 needs 3-5yr
  average ROE for the Brain's Step 1.3 and it's directly computable from extracted facts (unlike
  ROIC, which genuinely needs undeliverable NOPAT/invested-capital inputs and stays flagged
  not-computable).
- **The price-target range is Python, not the LLM** — set from the already-computed Sprint 3 DCF
  bear/bull intrinsic values in `pipeline.py`, never a number the model is asked to produce (the
  prompts say so explicitly).
- **No normalized `EvidenceItem` table.** The full evidence packet actually used by a run is stored
  as one JSON blob per run (`equity_analysis_runs.evidence_packet_json`) rather than one row per
  item — still fully auditable (CLAUDE.md Rule 2), simpler than Sprint 2's normalized `ResearchItem`
  table, and appropriate since a packet is rebuilt fresh per run rather than being a shared,
  independently-queried resource the way research items are.
- **`POST /analysis/holdings/{id}/run` always executes fresh** — unlike `/research/*`/`/valuation/*`'s
  GET-serves-cached-or-refreshes shape, there's no staleness concept for an LLM analysis verdict;
  every run is an explicit, real, cost-bearing call the caller asked for.

### Sprint 4 follow-up — agreed 2026-09-22 — ✅ built 2026-09-22

Both items below are built (commits `d646e06` backend, `3942745` frontend),
which closes Sprint 4. Readiness is advisory: `POST .../run` still only
hard-gates on instrument type; the UI disables Run on any readiness blocker.

- **F1 Analysis view** (the deferred Sprint 4 frontend): verdict card, moat breakdown, clickable
  evidence citations and notes editor on `HoldingDetailPage`.
- **F2 Analysis readiness check**: a per-holding checklist (ticker resolves, ≥3 yrs of financials,
  fresh price, research cached, analyzable type) shown before a Gemini call is spent. Also fixes the
  `asset_class_raw="equity"` default for manually created holdings.

### Sprint 5 — Portfolio roll-up & dashboard — ✅ closed 2026-09-23

Aggregate verdict/moat/valuation view across all holdings, single-purpose dashboard, deterministic
executive summary. Sprint 4's verdict schema now exists for this to aggregate over.
**+ F3 Margin-of-safety board** (agreed 2026-09-22): every holding ranked by price vs. its DCF
bear/base/bull range. **✅ Built 2026-09-22** (`2c415b8` backend, `ba3b71b` frontend):
`GET /valuation/board` + `/margin-of-safety` page. "Owned" = latest snapshot per account; only
stock/equity ETF rows; Sprint 3 valuation reused unchanged. Still open in Sprint 5: the aggregate
moat/verdict roll-up dashboard and the deterministic executive summary.
**✅ Closed 2026-09-23** (`bc4de0c`): `GET /portfolio/overview` (database-only: value, allocation by
sector/instrument/currency/account, HHI + effective holdings + top-1/5/10 share, value-weighted
verdict and moat roll-up, and a rule-based executive summary with named thresholds) and a new
**Dashboard** home page (`/`; Holdings moved to `/holdings`). Detail:
[dashboard-status-watchlist-journal-2026-09-23.md](dashboard-status-watchlist-journal-2026-09-23.md).

### Shipped alongside Sprint 5 (2026-09-23): F4 status page, F6 journal, F7 watchlist — ✅

| Feature | Commit | What |
|---|---|---|
| F4 System status (page only) | `4abaf3d` | `GET /system/status` + `/status` page. Configuration and DB only, no provider calls, secrets shown only as set/missing. The Playwright smoke test half stays in Sprint 7 |
| F7 Watchlist | `ebe4a49` | `watchlist_items` table (migration `c4d5e6f7a8b9`). An entry points at a Holding, so a watched company gets the full holding page. Buy-below price, status, DCF and margin of safety |
| F6 Decision journal | `bc28502` | `decision_journal_entries` table (migration `d5e6f7a8b9c0`). Action, price, why, what would prove it wrong, confidence, and the verdict at the time; outcomes from stored prices; 6/12-month reviews. Entries survive a holding delete (unlinked) |

Also fixed: a failed run hid an older verdict on the board; provider "unavailable" errors now return
503 with the reason instead of 500; a yfinance `KeyError` on an unreachable quote no longer 500s.

### Sprint 5B — Local LLM from Railway + overnight queue (F8 + F5) — ✅ built 2026-09-23 (`18e8a4e`, not pushed)

Goal: start an analysis from the Railway site and have it run on the PC's GPU (Ollama). No tunnel
and no port opened on the PC. If the PC is off, the run waits in a queue.
Decision at sprint start: **research runs on the PC** (decision 21).

| # | Story | Built |
|---|---|---|
| 1 | Queue columns | Migration `e6f7a8b9c0d1`: `engine`, `queued_at`, `claimed_by`, `claimed_at`, `attempts`; table `analysis_worker_heartbeats`; statuses `QUEUED`, `CANCELLED`. The lease lives on the heartbeat table (no `heartbeat_at` on the run — the pipeline holds the run row during LLM calls) |
| 2 | Queue from the UI | `POST /analysis/holdings/{id}/queue` → 202 (own endpoint, needs no server-side LLM), `POST /analysis/queue/ready-holdings` (F5), `POST /analysis/runs/{id}/cancel`, `GET /analysis/queue` |
| 3 | Worker on the PC | `python -m app.worker`: claim (CAS + `SKIP LOCKED`), heartbeat 30 s, lease 30 min, max 2 attempts, restart recovery, Ctrl+C re-queues, waits when Ollama is down or the Gemini budget can't cover research. `scripts/start-worker.ps1` |
| 4 | Status in UI | "Run on my PC", pending card with Cancel / Run in cloud instead, **Analysis queue** page, readiness + System status rows |
| 5 | Safety | No listener on the PC; the worker writes only what the run endpoint writes |
| 6 | Tests + guide | 29 new tests (586), Postgres migration + concurrency check, setup guide section |

Detail: [local-worker-queue-sprint5b-2026-09-23.md](local-worker-queue-sprint5b-2026-09-23.md).

### Sprint 6 — Evidence quality — ✅ built 2026-09-24 (`71ec23b`, not deployed)

Found at sprint start: uploaded document **text** never reached the evidence packet, only the figures.

| # | Item | Result |
|---|---|---|
| 1 | Section-aware chunking | Headings (known, ALL-CAPS, numbered; EN + NO) carried across pages, chunks ≤ 1,800 chars |
| 2 | Evidence budget | ~4,000 tokens, round-robin over 5 topics, max 3 per topic, max 60% per document, newest first |
| 3 | Evidence packet v4 + prompts v2 | `document_excerpt` items quoted as issuer-written data, cited to file + pages |
| 4 | Old uploads | Re-sectioned in memory; no re-upload needed |
| 5 | Tests | 33 new (619) |

Decision 22. Detail: [evidence-quality-sprint6-2026-09-24.md](evidence-quality-sprint6-2026-09-24.md).

### Sprint 8 — Fund & ETF analysis (F9) — ✅ built 2026-09-24 (`8847311`, not deployed)

Built before Sprint 7 at Faiz's request. A fund has no statements, so it gets its own path: the
businesses underneath (look-through), the steward and its cost, how the basket is built, and its
role in the portfolio. Decision 23.

| # | Item | Result |
|---|---|---|
| 1 | Types | `equity_fund` instrument type; `equity_etf` + `equity_fund` take the fund path; 5 fund document types |
| 2 | Fund facts | Migration `f8a9b0c1d2e3`: `fund_profiles`, `fund_return_periods`, `fund_exposures`, every row citing a document of the fund; `/funds/*` API |
| 3 | Holdings import | Deterministic CSV/XLSX parser, derived splits, auto-link by ticker / name, manual links kept |
| 4 | Metrics | Fee drag, excess return / tracking difference, concentration, splits, look-through, overlap (all Python) |
| 5 | Analysis | Evidence packet `fund-v1`, schema + prompts `fund_v1`, fund excerpt topics + umbrella filter, fund readiness |
| 6 | UI | Fund facts section, fund analysis view |
| 7 | Tests | 30 new (649), migration checked on Postgres 16 |

Detail: [fund-etf-analysis-sprint8-2026-09-24.md](fund-etf-analysis-sprint8-2026-09-24.md).

### Sprint 7 — Guardrail tooling — ✅ built 2026-09-24 (`f81a824`, not pushed)

| # | Item | Result |
|---|---|---|
| 1 | CI (`.github/workflows/ci.yml`) | Backend ruff + pytest; migrations up/down/up on Postgres 16; frontend tsc + eslint + vitest + build; gitleaks full history; dependency audit (report-only) |
| 2 | Pre-commit | File checks, ruff `--fix`, gitleaks, blocks `.env` files and document uploads |
| 3 | Secret scanning | `.gitleaks.toml`; 141 commits scanned, no leaks |
| 4 | Frontend test framework | vitest, first formatter tests |
| 5 | F4 smoke test | Read-only Playwright suite (16 checks) + `smoke.yml` after each Railway deploy, daily, on demand |

Detail: [macro-data-and-guardrails-sprint7-2026-09-24.md](macro-data-and-guardrails-sprint7-2026-09-24.md) §5.

### Numeric macro data (F10) — ✅ built 2026-09-24 (`c4b2ed2`, `551a141`, not pushed)

Pulled from the Backlog at Faiz's request (decision 24). Norges Bank policy rate, NOWA, 3m T-bill,
10y, USD/NOK, EUR/NOK; SSB CPI; FRED fed funds, 10y, 10y−2y, CPI, unemployment, HY spread; derived
real policy rates and NO−US 10y. Background refresh + refresh before each run; evidence packet v5 /
fund-v2; Macro page card and dashboard strip. Detail:
[macro-data-and-guardrails-sprint7-2026-09-24.md](macro-data-and-guardrails-sprint7-2026-09-24.md).

## Backlog — candidate future phases (all planned sprints now built)

| Candidate | What it would deliver | Why it's not scheduled yet |
|---|---|---|
| **Sprint 4 frontend** | A holding's analysis view (verdict card, moat breakdown, evidence citations, notes editor) on `HoldingDetailPage` | Deliberately deferred this session, mirroring Sprint 3's backend/frontend split |
| **Numeric macro data & scheduler** | FRED/Norges Bank central-bank series ingestion, a `MacroDataProvider` interface, optional background scheduler | **✅ Built 2026-09-24** (F10, decision 24) |
| **Portfolio risk & regime intelligence** | Correlation/factor exposure, drawdown scenarios, rebalancing flags, populating `portfolio_risk_snapshots` | Builds naturally on Sprint 3's valuation numbers, now also Sprint 4's verdicts |
| **Investment thesis tracking over time** | Persist reconciliation verdicts into `investment_theses`/`valuation_cases` (currently unused tables) and flag when new research/financials suggest an invalidation trigger fired | Sprint 4's verdict schema now exists to build this on top of — the natural next step once real runs validate the schema |
| **Historical price/FX & performance tracking** | Daily P&L, benchmark comparison, position-level return | Sprint 3 built the ingestion path; historical backfill is still unscheduled |
| **LLM usage ledger & cost observability** | Persist real `llm_usage_events` rows (including Sprint 4's own blind/reconciliation calls, which aren't logged there yet) instead of the in-memory placeholder guard | Low-risk, pullable any time; now slightly more valuable since Sprint 4 adds real LLM spend |
| **Alerts & notifications** | Notify when a thesis-invalidation trigger fires or research goes stale | Needs thesis tracking built first |
| **Reporting & export** | One-holding or whole-portfolio PDF/print view of an analysis run | Sprint 4's analysis output now exists to export |
| **More primary sources** | Brønnøysund accounts register (Norwegian financials), VFF fund NAVs, Newsweb announcement body text | SEC EDGAR + Newsweb built 2026-09-22 (see `primary-sources-sec-edgar-newsweb-2026-09-22.md`); these are the next-cheapest gaps |
| **F5 Overnight analysis queue** (agreed 2026-09-22) | Queue holdings and run them within the daily Gemini budget, resuming the next day | **✅ Built 2026-09-23 in Sprint 5B** (`18e8a4e`), together with F8 |
| **F6 Decision journal** (agreed 2026-09-22) | Record buy/sell reasoning, price and "what would prove me wrong"; show the outcome after 6/12 months | **✅ Built 2026-09-23** (`bc28502`), see Sprint 5 |
| **F7 Watchlist** (agreed 2026-09-22) | Analyze non-held companies; flag when the price drops below a buy-below level | **✅ Built 2026-09-23** (`ebe4a49`), see Sprint 5 |
| **Fund annual-report holdings parser** | Deterministic parser for the schedule of investments in a fund report PDF | Gives the full holdings list for funds with no CSV download (Sprint 8 follow-up) |
| **Fund look-through valuation** | Weighted P/E / earnings yield over linked holdings | Needs a price per linked holding (Sprint 8 follow-up) |
| **Fix GitHub push credentials** (ops, not a feature) | A PAT/credential-helper so sessions can push directly | Needs a decision/action from Faiz outside the repo — hit identically in every session |

## Changes / history

| Date | Summary |
|---|---|
| 2026-09-24 | **Sprint 7 built: guardrail tooling + F4 smoke test.** CI (ruff, pytest, migrations on Postgres 16, tsc/eslint/vitest/build, gitleaks, dependency audit), pre-commit hooks, `.gitleaks.toml`, read-only Playwright smoke test + `smoke.yml`. `f81a824`, not pushed. See [macro-data-and-guardrails-sprint7-2026-09-24.md](macro-data-and-guardrails-sprint7-2026-09-24.md). |
| 2026-09-24 | **Numeric macro data built (F10, decision 24).** 13 Norges Bank / SSB / FRED series + 3 derived; migration `a9b0c1d2e3f4` (additive); evidence packet v5 / fund-v2; Macro page + dashboard. 678 tests (29 new). `c4b2ed2`, `551a141`, not pushed. |
| 2026-09-24 | **Sprint 8 built (decision 23): fund & ETF analysis (F9).** `equity_fund` type; Fund facts typed in with citations or imported from a holdings file; deterministic fee drag, benchmark gap, concentration, look-through and overlap; evidence packet `fund-v1`, schema + prompts `fund_v1`. Migration `f8a9b0c1d2e3` (additive). 649 tests (30 new). `8847311`, not pushed. See [fund-etf-analysis-sprint8-2026-09-24.md](fund-etf-analysis-sprint8-2026-09-24.md). |
| 2026-09-24 | **Sprint 6 built (decision 22).** Uploaded document text now reaches the analysis: section-aware chunking, deterministic topic scoring within a ~4,000-token budget, evidence packet v4 (`document_excerpt`), prompts v2. No migration. 619 tests (33 new). `71ec23b`, not pushed. See [evidence-quality-sprint6-2026-09-24.md](evidence-quality-sprint6-2026-09-24.md). |
| 2026-09-23 | **Sprint 5B built (F8 + F5), decision 21: research runs on the PC.** "Run on my PC" queues a run in the shared DB; `python -m app.worker` claims it and runs research + both passes on Ollama. Migration `e6f7a8b9c0d1` (additive), 4 new endpoints, Analysis queue page. 586 tests (29 new). `18e8a4e`, not pushed. See [local-worker-queue-sprint5b-2026-09-23.md](local-worker-queue-sprint5b-2026-09-23.md). |
| 2026-09-23 | **Sprint 5 closed; F4 status page, F6 journal, F7 watchlist shipped.** Dashboard with `GET /portfolio/overview` (database-only roll-up and a rule-based executive summary); `/system/status`; `watchlist_items` + `decision_journal_entries` (additive migrations `c4d5e6f7a8b9`, `d5e6f7a8b9c0`). Fixes: a failed run hid an older verdict on the board; provider errors now return 503 instead of 500; yfinance `KeyError`. 557 tests (41 new). Not pushed. See [dashboard-status-watchlist-journal-2026-09-23.md](dashboard-status-watchlist-journal-2026-09-23.md). |
| 2026-09-23 | **Owner's-view metric definitions (decision 19) + Sprint 5B planned (decision 20).** Hybrid capital as debt; FCF and owner earnings net of decommissioning, leases, financing-classified interest and hybrid coupons; EBIT/EBITDA without biological fair value; *n/m* for negative denominators; the DCF uses the same owner earnings; evidence packet v3. 5 new extracted facts, 12 new tests (514/516, 2 pre-existing local-only). Sprint 5B: local worker pulls queued runs from the shared DB (F8 + F5). See [owner-view-metrics-and-local-worker-plan-2026-09-23.md](owner-view-metrics-and-local-worker-plan-2026-09-23.md). |
| 2026-09-23 | **Upload validation + deletes.** Vår Energi's FY2025 ESEF filing was checked figure by figure: every tag was read correctly, but net income, revenue, capex, EBIT/EBITDA and interest are now mapped the way a shareholder needs them. Statement integrity checks, a hybrid-equity warning, a mixed-currency guard and per-figure provenance were added. New document/holding delete endpoints and UI (decision 18). `be4b7e7`, not pushed. See [upload-validation-var-energi-and-deletes-2026-09-23.md](upload-validation-var-energi-and-deletes-2026-09-23.md). |
| 2026-09-23 | **Reverted LLM-assisted PDF figure extraction** (`8e1c1fb` reverts `9a0db96`) — Faiz decided against it. PDFs stay text-only; ESEF `.xhtml`/CSV uploads are the figure sources for non-US holdings. |
| 2026-09-23 | **Financial-statement uploads: ESEF `.xhtml` + CSV.** Inline-XBRL parser (tagged annual facts → canonical metrics via the EDGAR concept map, readable pages, tagged-facts evidence page) and a shared statement-table parser for IR CSV/Excel (annual columns only, scale/currency from the unit line). First source wins per metric/year; differences reported. Fixes a latent `GET /documents` 500. 486 tests (63 new). See [financial-statement-uploads-xhtml-csv-2026-09-23.md](financial-statement-uploads-xhtml-csv-2026-09-23.md). |
| 2026-09-23 | **Local LLM engine (Ollama) + ticker convention + UI tweaks.** `OllamaProvider` behind the factory (`LLM_PROVIDER=ollama`): analysis passes on the local RTX 3060, research stays on Gemini. Readiness gains a "Local LLM" check. Ticker rule: home-exchange Yahoo symbol (`VAR.OL`), never an unsponsored OTC ADR. Primary sources collapsible at the bottom; darker palette (Design & UX tokens updated). 423 tests (20 new). See [local-llm-tickers-ui-2026-09-23.md](local-llm-tickers-ui-2026-09-23.md). |
| 2026-09-22 | **F3 Margin-of-safety board built.** `GET /valuation/board` ranks owned equities by base-case margin of safety with zone, value, weight and latest verdict; `/margin-of-safety` page. yfinance beta cached 24h. 403 tests (11 new). Sprint 5 otherwise still open. |
| 2026-09-22 | **Sprint 4 closed: F1 Analysis view + F2 Readiness check.** `GET /analysis/holdings/{id}/readiness` (instrument type, provider config, ticker/price, financial history, sector, research cache, Gemini quota; no side effects). Run output gains `evidence_items` + `user_notes_snapshot`. Manual holdings now classified by name instead of `equity`. `AnalysisPanel` on the holding page. 392 tests (28 new). Not yet run against a real LLM. |
| 2026-09-22 | **Feature plan F1–F7 agreed.** F1/F2 attached to the Sprint 4 follow-up, F3 to Sprint 5, F4 to Sprint 7, F5–F7 added to the Backlog. Docs only. |
| 2026-09-22 | **Primary sources: SEC EDGAR + Oslo Børs Newsweb.** EDGAR XBRL annual facts → `financial_line_items` (traceable to accession numbers, never overwrites uploaded periods); Newsweb announcements cached via the research tables (no migration); evidence packet v2 cites both; new `/sources/*` API and a Primary sources section on the holding page. 364/364 tests. Not yet run against the live SEC/Newsweb hosts. See `primary-sources-sec-edgar-newsweb-2026-09-22.md`. |
| 2026-09-21 | **Sprint 4 backend: the two-pass Buffett/Munger analysis engine.** Built the evidence packet (reusing Sprints 1-3 unchanged), versioned output schema/assumptions/prompts, the blind pass, the reconciliation pass (notes-aware, notes optional), the orchestration pipeline (equity-type gating, LLM fallback, deterministic DCF-derived price target, blind-result preserved if only reconciliation fails), per-holding notes CRUD, and the `/analysis` API. New tables via migration `b5e1a9c3d7f2` — a fresh schema, not an extension of the legacy Phase-3 tables. 19 new tests (307 total), ruff clean. Discovered: manually-created holdings default to a non-analyzable `asset_class_raw` (flagged, not fixed); `MARKET_DATA_PROVIDER`/`RESEARCH_PROVIDER` are still `stub` in `backend/.env`, now blocking the analysis engine specifically. Frontend deliberately deferred. Not run against a real LLM call, real market data, or real holdings this session. |
| 2026-09-21 | Portfolio delete fixes, page-load speed, first portfolio-level chart, whisky grouping (out-of-sequence). See `progress.md`. |
| 2026-09-21 | Sprint 3 fully closed: frontend valuation UI. See `progress.md`. |
| 2026-09-21 | Sprint 3 backend closed: valuation engine. See `progress.md`. |
| 2026-09-21 | Sprint 2 closed: frontend research UI. See `progress.md`. |
| 2026-09-21 | Portfolio CSV import + delete UI, pulled forward from Sprint 4. See `progress.md`. |
| 2026-09-21 | Sprint 2 started. See `progress.md`. |
| 2026-09-21 | Sprint 1 closed. See `progress.md`. |
| 2026-09-21 | Document ingestion built (Sprint 1's 3rd deliverable). See `progress.md`. |
| 2026-09-21 | Sprint 0 closed, Sprint 1 started. See `progress.md`. |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research. See `progress.md`. |
| 2026-09-21 | Sprint 0 skeletons built. See `progress.md`. |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped. See `progress.md`. |
| 2026-09-21 | Full repo reset + rebuild plan written. See `progress.md`. |

*Earlier entries in this table were condensed 2026-09-21 (this session) to keep this doc's own
history section from growing unbounded — `progress.md`'s "Changes / history" table retains the same
level of condensation; the original full-detail entries remain in this doc's git history.*
