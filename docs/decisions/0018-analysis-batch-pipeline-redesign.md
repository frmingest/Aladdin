# 18. Analysis batch pipeline redesign — per-security jobs + portfolio synthesis

## Status

Proposed — design only, not built. Recorded 2026-09-17 at Faiz's request: a specification for
restructuring how "Run Analysis" works, specifically to manage the Google AI Studio (Gemini) API's
rate/budget limits.

## Context

Today `POST /analysis/snapshots/{snapshot_id}/runs` (`app/api/analysis.py`) calls `run_analysis()`
(`app/services/analysis/runner.py`) synchronously, inside the HTTP request: it loops over every
requested `holding_id`, running a blind pass (+ reconciliation pass once a holding has notes/thesis)
against Gemini for each one — already paced to ≤5 RPM (`gemini_retry.py`) and pre-flighted against a
20 requests/day budget (`get_usage_summary`, ADR 0013). `runner.py`'s own docstring already names the
natural next step: "a background job queue (APScheduler, §4) is a natural addition once analysis
runs take long enough... the architecture explicitly warns against premature infrastructure (§2.9,
§29)." Three sessions of incremental fixes on top of the synchronous design (retry/pacing
2026-09-15, daily-budget guard + fallback provider 2026-09-16/17, live-failure fallback 2026-09-17)
have addressed *how each call behaves*, not the structural fact that a run big enough to hit any of
these limits also risks the request itself timing out (≥12s pacing between calls) and, when the
daily cap is genuinely hit, its remaining holdings are recorded as failed for that request —
Faiz has to notice and manually re-run them, and re-running re-attempts the whole batch rather than
resuming just what's left.

Separately: results ARE already persisted per holding (`HoldingAnalysis`, one row per successful
holding, FK'd to the parent `AnalysisRun`) — but failures are not. `AnalysisRunOutcome.failures`
only lives in memory for that one request/response, then gets flattened into a single
semicolon-joined string on `AnalysisRun.error_message`. Fetching a completed run later
(`GET /analysis/runs/{run_id}`) reconstructs a failure list by diffing `requested_holding_ids`
against succeeded ones, but every failed holding shows the *same* generic `error_message` string —
the specific reason for which holding failed on what is lost after the original request completes.

Faiz's ask: restructure "Run Analysis" into three phases — (1) on click, detect portfolio
composition and create one batch job per security; (2) each security's analysis runs, is scored,
and stored independently; (3) once every job is done, a single executive-summary pass stitches the
per-security results into one cohesive portfolio assessment. This is architecturally exactly the
backgrounded-job-queue step the current code already anticipates, applied specifically to the
Google API budget problem: a persisted job per holding turns the daily 20-request cap from "some
holdings fail this run, re-click tomorrow" into "unfinished jobs resume automatically once the
budget resets," and decouples the trigger (fast, sub-second) from the compute (can safely take
minutes or span days).

## Decision

Adopt a two-table job model, kept underneath the existing per-holding analysis logic rather than
replacing it.

**`analysis_batch_run`** (one row per "Run Analysis" click) — id, portfolio_snapshot_id, status
(`PENDING`/`RUNNING`/`COMPLETED`/`COMPLETED_WITH_ERRORS`), requested_at, started_at, finished_at,
total_jobs, completed_jobs, failed_jobs, executive_summary (nullable, filled by phase 3),
prompt_version, scoring_version, macro_regime (the same portfolio-wide provenance fields
`AnalysisRun` already records today, moved up one level since they apply once per run, not per job).

**`analysis_batch_job`** (one row per holding within a batch run) — id, batch_run_id (FK),
holding_id (FK), status (`PENDING`/`RUNNING`/`COMPLETED`/`FAILED`/`SKIPPED_BUDGET`), attempt_count,
queued_at, started_at, finished_at, holding_analysis_id (FK to the existing `HoldingAnalysis` row,
set on success), error_reason (nullable, structured **per job** — fixes the flattened-string gap
above), llm_calls_used.

**Phase 1 — decomposition.** `POST /analysis/batches` reads the current portfolio composition (the
same `_holdings_with_evidence` holding-set logic `analysis.py` already applies as the default),
creates one `analysis_batch_job` row per holding (`PENDING`), returns `batch_run_id` immediately
(202, no LLM calls in this request — this is what removes the request-timeout risk).

**Phase 2 — job processing.** A background worker (APScheduler, per the existing docstring's own
recommendation — no new infrastructure class, matches ADR 0017's stated bias against it) claims
`PENDING` jobs oldest-first across all batch runs and, for each, runs *exactly the existing
per-holding logic* from today's `run_analysis()` loop body (context build → daily-budget pre-flight
→ primary/fallback provider → `run_two_pass_analysis` → scoring → persistence) unchanged — just for
one job instead of inside someone else's for-loop. On success: job → `COMPLETED`, linked to the new
`HoldingAnalysis` row. On failure: job → `FAILED` with its own specific `error_reason` (no more
flattening). When the daily-budget guard would skip a job today, the job now stays `PENDING` (not
permanently failed) — the worker's own next tick, after the UTC-midnight reset, picks it back up
automatically. This is the concrete mechanism that closes the daily-budget-guard doc's own stated
limitation ("doesn't raise the ceiling... spread large batches across multiple days" — today that's
a manual re-click; this makes it automatic).

**Phase 3 — portfolio synthesis.** Once a batch run has zero non-terminal jobs, one additional LLM
call — a new, small, versioned prompt (`prompts/portfolio_synthesis/v1.md`, same versioning
discipline as `persona/`/`synthesis/`) — reads the *structured* per-security outputs already
persisted (scores, factor breakdowns, key strengths/risks — not raw evidence, keeping this call
cheap and size-independent) and produces one cohesive narrative: portfolio-level read, cross-holding
themes, and an explicit call-out of any holdings that failed or came back low-confidence. Stored on
`analysis_batch_run.executive_summary`. This is new functionality — today's synchronous run has no
equivalent "stitch the batch together" step at all — and costs exactly one extra LLM call per batch
run regardless of portfolio size, negligible against even the 20/day cap.

This is explicitly **not** the same thing as the existing
`GET /portfolio/snapshots/{id}/executive-summary` (`app/services/executive_summary/builder.py`) —
that endpoint is a deterministic, no-LLM rollup of Composition/Risk/Macro dashboard data, already
built and shipped (architecture §19). The new phase-3 output is an LLM-narrative synthesis of
individual security analyses specifically. The two can be shown together on the Dashboard; they
should not be merged into one code path.

## Open questions for Faiz

| Question | Options | Recommendation |
|---|---|---|
| Worker mechanism | APScheduler polling loop / FastAPI `BackgroundTasks` fire-and-forget / a real task queue (Celery+Redis) | APScheduler — already anticipated in `runner.py`'s own docstring, no new infra class, same reasoning ADR 0017 used for the local-LLM topology decision |
| Where the phase-3 narrative lives in the UI | New standalone Analysis-tab section / merged into the existing Dashboard exec-summary widget | Standalone first — keeps the deterministic dashboard numbers and the LLM narrative visibly separate; revisit merging once both are live |
| Build now vs. wait for the Ollama migration (ADR 0017) | Gemini has the RPD cap this redesign targets; once local, that cap disappears | Build now — provider-agnostic (works unchanged once/if ADR 0017 lands), and it's what gets a >20-holding batch fully analyzed at all while the bake-off gate is still open |
| Re-clicking "Run Analysis" | Always start a new `analysis_batch_run` / reuse a still-open one | New run each click — matches the existing per-holding score-trend/comparison UI, which already expects a history of runs |

## Recommended verification before building

- Confirm `_holdings_with_evidence` (today's default holding set — every holding with at least one
  document or financial fact on record) is still the right default job set for a batch run, or
  whether "detect portfolio composition" should mean every holding in the snapshot regardless of
  document/fact coverage.
- Decide the worker mechanism (table above) before the migration is written — it determines whether
  `analysis_batch_job` needs a worker-heartbeat/lock column (needed for APScheduler-with-concurrent-
  ticks safety) or not.

## Consequences

- New migration: `analysis_batch_run` + `analysis_batch_job` tables. Existing `AnalysisRun`/
  `HoldingAnalysis` tables and relationships are unchanged — a batch job's success still produces a
  normal `HoldingAnalysis` row, so every other feature that reads analysis results (score trend,
  Dashboard detail view, thesis divergence) needs no changes.
- New dependency: APScheduler (not yet in `requirements.txt`).
- `POST /analysis/snapshots/{snapshot_id}/runs` (today's synchronous whole-portfolio endpoint) is
  superseded for the "Run Analysis" button specifically, but can stay available for a single-holding
  "re-run this one" action if the frontend still wants a fast synchronous path for that narrower
  case — not a breaking removal.
- Backgrounding a Gemini-calling loop outside the request lifecycle means the process needs to stay
  alive to finish it (same general shape Railway already runs) — no new deployment topology, unlike
  ADR 0017's "run analysis locally" decision. This redesign is provider-agnostic: equally valid after
  the Ollama migration lands (no RPD cap then, but persistence/resumability/a real progress UI stay
  valuable), so it isn't wasted effort relative to ADR 0017.
- Frontend: "Run Analysis" becomes a fire-and-poll flow (create batch → poll status → per-job
  progress list → summary once ready) instead of one blocking spinner. New API surface:
  `POST /analysis/batches`, `GET /analysis/batches/{id}`, `GET /analysis/batches/{id}/summary`,
  `GET /analysis/batches` (history).
- Noticed in passing, unrelated to this design: `backend/app/services/analysis/runner.py` currently
  has a same-sized sibling file `runner-1.py` next to it on `E:\Aladdin` — looks like a stray copy
  from an earlier stage/write step, not source-controlled functionality. Worth a quick check/delete
  next time that folder is touched; not acted on here.
