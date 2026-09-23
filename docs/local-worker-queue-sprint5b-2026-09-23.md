# Sprint 5B — Local LLM from Railway + overnight queue (F8 + F5)

**Date:** 2026-09-23 · **Commit:** `18e8a4e` (committed locally, **not pushed, not deployed**)
**Plan:** [owner-view-metrics-and-local-worker-plan-2026-09-23.md](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §3 (option C)

---

## 1. What it does

Start an analysis from the Railway site (or phone) and have it run on the PC's GPU.

```
Railway UI: "Run on my PC"  ──►  equity_analysis_runs row, status QUEUED, engine local
                                        │  (shared Supabase DB)
PC: python -m app.worker  ──── polls every 30 s, heartbeats every 30 s
     claims oldest QUEUED run  ──►  RUNNING
     research (Gemini) → evidence packet → blind pass → reconciliation (Ollama)
     writes the result to the same row  ──►  COMPLETED / BLIND_ONLY / FAILED
Railway UI polls /analysis/queue every 15 s, then shows the new verdict
```

- **No tunnel, no inbound port.** Railway never learns the Ollama URL.
- **PC off → the run waits.** Nothing is lost or spent.
- **Decision at sprint start (Faiz, 2026-09-23):** research runs **on the PC**, so one run happens
  in one place with no half-finished state.

---

## 2. Stories

| # | Story | Status | Notes |
|---|---|---|---|
| 1 | Queue columns | ✅ | Migration `e6f7a8b9c0d1` (additive): `engine`, `queued_at`, `claimed_by`, `claimed_at`, `attempts` + table `analysis_worker_heartbeats`. New statuses `QUEUED`, `CANCELLED` |
| 2 | Queue from the UI | ✅ | `POST /analysis/holdings/{id}/queue` → 202 (separate endpoint instead of `?engine=local`, so queueing needs no LLM provider on the server). **Queue all ready holdings** (F5) |
| 3 | Worker | ✅ | `python -m app.worker`, `backend/scripts/start-worker.ps1` (auto-restart), Task Scheduler steps in the guide |
| 4 | Status in UI | ✅ | "Run on my PC" button, pending card (Cancel / **Run in cloud instead**), **Analysis queue** page, "Local worker" readiness check, System status rows |
| 5 | Safety | ✅ | Worker reads inputs, writes research caches + the run, like the web server's own run endpoint. No listener on the PC |
| 6 | Tests + guide | ✅ | 29 new tests; [setup guide](local-llm-ollama-setup.md) → "Run analyses queued from Railway" |

---

## 3. Design choices

| Topic | Choice | Why |
|---|---|---|
| Claiming | Compare-and-set `UPDATE … WHERE status='QUEUED'` + `FOR UPDATE SKIP LOCKED` | Never two workers on one run. Checked on Postgres 16: 4 workers, 20 runs, 0 duplicates |
| Lease | On `analysis_worker_heartbeats.last_seen_at`, **not** a column on the run | The pipeline keeps the run row dirty in its transaction during the LLM calls; a heartbeat UPDATE on that row would block on its lock |
| Silent worker | Re-queued after 30 min; **FAILED after 2 attempts** | Plan values; `WORKER_LEASE_MINUTES`, `WORKER_MAX_ATTEMPTS` |
| Worker restart | Its own RUNNING runs are released at start-up | No 30-min wait after a crash/reboot |
| Ctrl+C mid-run | Run goes back to QUEUED, attempt not counted | A deliberate stop isn't a failure |
| Crash in the pipeline | Run marked FAILED with the error; worker keeps going | Fail visibly |
| Ollama down | Worker waits (state `llm_unavailable`); run stays queued | Don't burn a run on a known failure |
| Gemini budget (F5) | If today's budget can't cover the next run's research refreshes, wait until 00:00 UTC (state `waiting_quota`) | Better than a run on missing research. Budget is still counted in-process (known issue) |
| Which LLM | `WORKER_LLM_PROVIDER` (default `ollama`), whatever `LLM_PROVIDER` says | The shared `.env` shouldn't decide where the worker runs |
| Versions | The worker overwrites schema/prompt/packet versions when it executes | They describe the code that actually ran |
| "Latest analysis" | `GET /analysis/holdings/{id}` skips QUEUED / RUNNING / CANCELLED runs | A pending run never hides the previous verdict |

---

## 4. API

| Method | Path | Returns |
|---|---|---|
| POST | `/analysis/holdings/{id}/queue` | 202, the queued run (or the existing pending one) |
| GET | `/analysis/queue` | workers (online?), pending runs, last 20 finished local runs |
| POST | `/analysis/queue/ready-holdings` | queued / already queued / skipped (with reason) |
| POST | `/analysis/runs/{id}/cancel` | 200 cancelled · 409 already started · 404 |

"Ready" for the queue = no block on instrument type, ticker or financial history. Provider/quota
checks are Railway's config, not the worker's, so they're ignored.

---

## 5. Verification

| Check | Result |
|---|---|
| Backend tests | 586 (29 new), 584 pass on the PC; the 2 `test_factory` failures are the known local-only ones (`.env` selects Ollama) |
| Frontend | tsc, eslint, vite build clean |
| Migration | up / down / up on Postgres 16 |
| Concurrency | 4 threads × Postgres: 20 runs claimed exactly once |
| Live | ❌ Not run against Supabase/Railway or a real Ollama yet |

---

## 6. What Faiz needs to do

1. Push `main` and redeploy (Railway runs the migration on start).
2. On the PC: `backend\.env` has Railway's `DATABASE_URL` (+ Gemini/FRED keys,
   `MARKET_DATA_PROVIDER=yfinance`, `RESEARCH_PROVIDER=gemini_search`).
3. Start the worker: `python -m app.worker` (or `scripts\start-worker.ps1`).
4. On the Railway site: a holding → **Run on my PC**; watch **Analysis queue**.
