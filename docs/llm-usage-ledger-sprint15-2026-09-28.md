# LLM usage ledger — Sprint 15 #1 (F27), 2026-09-28

**Status:** written and tested on branch `feature/llm-usage-ledger`, PR #10 open for review. Not merged, not deployed, not checked live.

## Why
The Gemini daily-request guard (`DailyBudgetGuard`) lived in process memory. It reset on every restart or redeploy, and the web server and the PC worker each kept their own count, so nobody could say how much of today's ~20 calls was really left. F22's side-by-side mode roughly doubles LLM calls, which made a trustworthy count a prerequisite.

## What was built

| Piece | Where | What it does |
|---|---|---|
| Ledger table | existing `llm_usage_events` (from `c7e2f9a1b8d3`) | Reused, not replaced. One row per **real request that reached the vendor**; a retried 429 is its own row |
| Migration | `l1d2e3f4a5b6` | Additive: `outcome` (success / error / blocked_by_budget, existing rows backfill as success), `error_detail`, index on `(provider, occurred_at)` |
| Model | `app/models/llm_usage.py` | `LlmUsageEvent` moved out of the legacy file; delete/unlink behaviour unchanged |
| Writer / reader | `app/services/llm_ledger.py` | `record_event`, `count_calls_today`, `build_usage_summary`. Every function fails soft, so a DB blip never breaks an LLM call |
| Persistent guard | `app/providers/ledger_budget.py` | `LedgerBudgetGuard`: remaining = limit − today's counted rows (UTC day), shared by server and worker, survives restarts |
| Gemini wiring | `gemini_retry.call_with_retry` | Records every attempt with call type, latency, token counts, error text; a refused call is logged as `blocked_by_budget` and never counted |
| Mistral / Ollama | `app/providers/ledger_recording.py` mixin | One row per call, with tokens. These never touch the Gemini budget |
| API | `GET /usage/summary?days=7` | Per-day, per-provider rollup, by-call-type breakdown, recent errors, Gemini used/remaining. Read-only, DB only; empty in demo mode |
| UI | System status page | New "LLM usage, last 7 days" card; the budget tile no longer says "resets on restart" |

## Behaviour to know
- **Fallback:** if the ledger can't be read, the guard falls back to the old in-process count. If a write was lost, the guard takes the smaller of ledger and in-process remaining (conservative).
- **Only this app's calls are counted.** If the same Google key is used elsewhere, the real quota is lower than the ledger shows. `LLM_RATE_LIMIT_RPD` is still set by hand.
- **Not attributed yet:** `holding_id` / `analysis_run_id` stay empty. Threading a holding id through every provider call is a separate change. Tavily research calls are not logged either.

## Verification
- Backend: 1011 pass, 2 fail. The 2 failures are the same pre-existing ones as on unmodified `main`. 15 new tests (unit tests for the ledger, guard, retry wiring, provider mixin and summary; API tests for `/usage/summary`). `ruff check .` clean.
- Migration: up / down / up clean on a local Postgres 16; single alembic head. Guard + summary also exercised against that Postgres (a fresh guard saw the earlier guard's calls).
- Frontend: tsc 0 errors, eslint 0 errors (2 pre-existing warnings), vitest 22/22, build clean.

## Faiz's checklist after merge
1. Railway redeploys; confirm migration `l1d2e3f4a5b6` ran.
2. System status → the new card appears; the Gemini tile counts from the ledger.
3. Trigger one Gemini call (e.g. refresh macro research); the count drops by 1 and stays after a redeploy.
4. Restart the PC worker so it uses the shared count.

## Follow-ups (backlog)
Per-holding / per-run attribution, per-persona split for F22 side-by-side, Tavily call logging, a cost-per-token estimate, pruning old rows.
