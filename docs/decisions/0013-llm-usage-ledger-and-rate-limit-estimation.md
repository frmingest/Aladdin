# 13. LLM usage ledger & free-tier rate-limit estimation

## Status

Accepted

## Context

Faiz asked three questions after running the app's first real analysis against Vår Energi (3
uploaded documents — a 208-page annual report, a 55-page quarterly report, a 17-page transaction
presentation — analyzed in a single blind-pass call, since no thesis/notes existed yet for that
holding to trigger a reconciliation pass): can the app build a token-consumption indicator, will it
be reliable, and can it instead integrate with Google AI Studio's own usage dashboard — attaching
that Vår Energi run as a baseline for estimating how many more analyses the free tier has left.
Google AI Studio's own dashboard (screenshotted) showed, for that one run: 1 API request, 5.87K
input tokens, 1.484K output tokens, and free-tier limits for the configured model
(`gemini-3.6-flash`) of 5 requests/minute, 250K tokens/minute, and 20 requests/day.

This is exactly the gap the Phase 8 status review already flagged under Observability: "token/cost/
latency tracking is half-built — computed per analysis run, never persisted or surfaced."
Confirmed by re-reading the code: `app.services.analysis.llm_analysis.run_two_pass_analysis`
computes `total_input_tokens`/`total_output_tokens` on every call (Gemini returns exact
`usage_metadata` — `prompt_token_count`/`candidates_token_count` — with every response, already
captured into `LLMResponse` by `GoogleAIStudioProvider`), and `app.services.analysis.runner.
run_analysis` never persists it anywhere — it's computed, returned, and dropped before the
`HoldingAnalysis` row is even built. `app.providers.gemini_research_provider.GeminiResearchProvider`
(macro/sector research) didn't even read `usage_metadata` at all. ADR 0005's Consequences already
called this out too: "Free-tier rate limits are not modeled anywhere in the application."

**On integrating with Google AI Studio directly:** not practical, and not actually better than
building this from the app's own data. The Rate Limits/Usage pages Faiz screenshotted are a Cloud
Console UI backed by Cloud Monitoring metrics for the `generativelanguage.googleapis.com` service —
there is no documented public API that returns a free-tier AI Studio key's quota/usage numbers
directly. Reaching the same numbers programmatically would mean enabling the Cloud Monitoring API
on a GCP project tied to the key, provisioning service-account credentials, and querying
`serviceruntime.googleapis.com/quota/...` metrics — real setup for a single-user personal app, and
the result would still only be aggregate request/token counts with no way to tell which holding or
document triggered them. This application already receives the exact same `usage_metadata` on every
call it makes; capturing that is strictly simpler, exact rather than approximate, and gives
per-holding/per-document granularity the Cloud Monitoring numbers never could.

## Decisions

- **New `llm_usage_events` table** (`app/models/llm_usage.py`, migration `c7e2f9a1b8d3`, chained
  after `a1b2c3d4e5f7`) — one append-only row per real Gemini call, across both roles that make one:
  `GoogleAIStudioProvider` (analysis — `ANALYSIS_BLIND`/`ANALYSIS_RECONCILIATION`) and
  `GeminiResearchProvider` (research — `RESEARCH_MACRO`/`RESEARCH_SECTOR`). Populated straight from
  each provider's vendor `usage_metadata`, never independently estimated (§28 rule 10). Optional
  `holding_id`/`analysis_run_id`/`holding_analysis_id`/`sector` columns record provenance only for
  the call types that have it — a macro call sets none of them, a sector call sets only `sector`.
- **`app.providers.base.LLMUsageMetrics`** — a new vendor-agnostic dataclass (`input_tokens`,
  `output_tokens`, `latency_ms`) both providers fill from their own SDK's usage fields, keeping
  `ResearchProvider`'s abstract interface itself vendor-agnostic (§28 rule 8). Exposed as a plain
  `last_usage: LLMUsageMetrics | None = None` instance attribute on `ResearchProvider` (default
  `None`, so `StubResearchProvider` needs no change) rather than widening `get_macro_snapshot`/
  `get_sector_research`'s return type — `app.services.research.macro`/`sector` read it right after
  calling either method and record a usage row before their own `db.commit()`, in the same
  transaction as everything else that call produced. `GoogleAIStudioProvider`'s analysis path didn't
  need this: `LLMResponse` already carried token counts, so `app.services.analysis.llm_analysis.
  LLMAnalysisResult` was simply extended with per-pass fields (`blind_input_tokens`,
  `reconciliation_ran`, etc.) so `app.services.analysis.runner` can record one row for a single
  blind-pass analysis or two once a holding has thesis/notes to reconcile against.
- **Three new settings** (`llm_rate_limit_rpm`/`tpm`/`rpd`, defaulted to 5/250,000/20 — exactly what
  Faiz's screenshots showed for `gemini-3.6-flash`'s free tier) plus two calibration settings
  (`llm_baseline_input_tokens`/`llm_baseline_output_tokens`, defaulted to 5,870/1,484 — the Vår
  Energi run's own numbers). All five are plain config (§4), not fetched from anywhere, since (see
  Context) nothing exposes them programmatically — Faiz keeps them in sync by hand if the account's
  tier or model changes.
- **`app.services.usage`** — `record_llm_usage` (adds, doesn't commit, a ledger row) and
  `get_usage_summary`, which computes today's and the trailing-minute's request/token totals from
  the ledger, and estimates `estimated_analyses_remaining_today` as `(rpd_limit - today's requests)
  // avg_calls_per_analysis`. `avg_calls_per_analysis`/`avg_tokens_per_analysis` come from real
  historical `ANALYSIS_BLIND`/`ANALYSIS_RECONCILIATION` events once any exist (grouped by distinct
  `holding_analysis_id`, so a mix of one-pass and two-pass analyses averages correctly); before any
  history exists — true on the very first deploy of this feature, since it postdates every analysis
  run so far, including Vår Energi's own — it falls back to the `llm_baseline_*` settings as a
  single-call, single-analysis calibration point. `baseline_is_calibrated` on the summary tells the
  caller (and the Dashboard) which mode is active.
- **RPD, not TPM, is treated as the binding constraint for "how many more analyses today."** A
  single holding analysis costs on the order of 5-10K tokens total (Vår Energi's blind pass alone
  was ~7.35K); against a 250K-token-per-minute budget that's nowhere close to binding at this app's
  usage pattern (one analysis run at a time, not a burst), while the free tier's 20-requests/day
  ceiling is reached after 20 single-pass analyses regardless of how small each one is. TPM/RPM are
  still surfaced in the summary as live "this minute" gauges (useful if Faiz ever does batch multiple
  holdings back-to-back and starts hitting the 5 RPM ceiling), just not folded into the daily
  estimate.
- **New `GET /usage/summary` endpoint** (`app/api/usage.py`, `app/schemas/usage.py`) and a new
  "Gemini usage today" Dashboard section (`UsageSection.tsx`) — placed above the snapshot-scoped
  sections since usage/quota is a portfolio-wide, always-current concern, not something that depends
  on which snapshot or account filter is selected. Polls every 30s rather than only on mount, since
  usage changes from actions elsewhere in the app, not from anything on this page.
- **The "today" window uses UTC calendar-day boundaries** as an approximation of whatever reset
  window Google actually uses for the free tier (not itself published) — acceptable for a
  single-user app; the mismatch, if any, is self-evident the moment this page's count disagrees with
  `aistudio.google.com/usage`'s.

## Consequences

- **A failed holding analysis costs a real Gemini call but records no usage row.**
  `app.services.analysis.runner.run_analysis` only reaches `_record_analysis_usage` after a holding
  analysis has already been persisted; a call that raises `LLMUnavailableError` (bad API key, vendor
  outage, schema-validation failure) is caught earlier and never reaches that point. At single-user,
  low-failure-rate scale this is a minor undercount, not a correctness bug, but it does mean the
  ledger can read slightly lower than Google's own dashboard after a failed run. Recording usage for
  failed calls too is a reasonable follow-up but needs `LLMUnavailableError` to start carrying
  partial usage information, which it doesn't today (a deliberate scope cut for this pass, not an
  oversight).
- **This session's sandbox has no network path to a live Postgres or the Gemini API** (same
  standing limitation every ADR since 0004 has carried), and `device_bash` was unavailable again
  this session (the Windows-update mount issue tracked since 2026-09-08), so this pass went through
  the stage → edit → commit-back path with **no way to run `alembic upgrade head`, `pytest`, `tsc`,
  or `vite build`** against the real repo. Every file this touched was written by hand, matching
  existing patterns closely (the migration mirrors `b2ad6aca76c1`'s hand-written style; the
  `last_usage` attribute pattern deliberately avoids touching `ResearchProvider`'s abstract method
  signatures so `StubResearchProvider` and every existing call site keep compiling unchanged) but is
  **unverified until the migration is applied and the test suite runs** — see `docs/PROGRESS.md`'s
  "Open gaps" and "Manual to-do."
- **The RPD/TPM/RPM limits will silently go stale** if Google changes free-tier terms, Faiz upgrades
  to a paid tier, or the configured model changes again (as `gemini-2.5-flash` → `gemini-3.6-flash`
  already did once, ADR 0005's Update section) — nothing in this design detects that automatically,
  by construction (see Context: nothing exposes it to detect). The Dashboard section says outright
  that these are hand-entered and can drift.
- **The daily estimate assumes analyses run one at a time**, matching this app's actual synchronous,
  on-demand usage pattern (`app.services.analysis.runner`'s own docstring: "a background job queue
  ... is a natural addition once analysis runs take long enough ... but at single-user, on-demand
  scale a synchronous call is simpler"). If that ever changes (a batch "analyze every holding"
  button, background scheduling), the RPM ceiling could start binding before RPD does, and
  `get_usage_summary` would need to fold `last_minute` into the remaining-analyses estimate rather
  than reporting it as a separate gauge.
