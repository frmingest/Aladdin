# Worker: background jobs on their own thread (2026-10-07)

**Status: written and tested on branch `fix/worker-nonblocking-housekeeping` (PR #66, off `main` `9059f36`). Not merged, not deployed, not run on the real worker.**

## Symptom

After a full batch (holdings + watchlist) finished, Faiz added a holding from Yahoo Finance to the
watchlist and pressed "Local LLM" on the holdings page. The run went into the queue but was not
picked up for 15 minutes. Restarting the local uvicorn and the worker made it start.

## Cause (read from `backend/app/worker/runner.py`; no worker log was available to confirm)

`run_forever` was one loop on one thread. When the queue drained, the next pass ran the five
housekeeping jobs **inline**: tripwire check, snapshot refresh, Fortress history frame, holding
warm-up, keep-warm page rebuild. A snapshot refresh forces live price / FX / FRED fetches for the
whole portfolio and took 13+ minutes on 2026-10-05. Nothing was claimed until it returned.

PR #51 (2026-10-05) stopped these jobs running between two queued runs, but they still ran
whenever the queue drained, which is the moment a new item arrives. A finished batch also makes the
stored pages stale, so keep-warm has work right then, and a newly added watchlist item makes
warm-up and keep-warm due.

The heartbeat set the state to `idle` before the jobs started and a separate thread kept beating,
so the Queue page showed "Idle, waiting for work" for the whole stall. Restarting killed the job,
which is why it cleared.

## Fix

**Worker**
- The five jobs run on a second thread (`worker-background`). The main loop polls the queue every
  `worker_poll_seconds` (30 s) whatever the jobs are doing.
- The 10-05 rule is kept: a job starts only while no run is active (`_analysis_active`) and the last
  loop outcome was not a finished run. A pass stops starting jobs once a run is claimed. A running
  job is not interrupted; it no longer blocks anything.
- Heartbeat: new state `background_job`, detail `Background job: <name> (since HH:MM UTC)`. Reported
  only when the loop's own state is idle; a running analysis wins. State column is a free string, so
  no migration.
- Each job is timed; one over 60 s is logged by name.
- `python -m app.worker --once` and the loop tests still run the jobs inline.

**Frontend**
- Queue page: worker row says "Background job (still checking the queue)".
- Stalled-run warning (`lib/queueStall.ts`): a run QUEUED for 3+ minutes while an online worker is
  not running, waiting for Gemini quota or without an LLM. With a background job it names the job;
  otherwise it says the worker is online but has not claimed the run and to restart it. Shown as a
  banner on the Queue page and inside the "Queued on PC" card on the holding page.
- The server still never calls the PC (by design: the worker opens no port), so the frontend can only
  show the state; the fix that prevents the stall is in the worker.

## Checks

Backend: Ruff clean; 1,700 passed, 2 skipped (7 new in `tests/unit/test_worker_background.py`,
including a real-thread test that the queue is polled while a job is blocked, and that a running
analysis wins over a background job in the heartbeat). Frontend: tsc clean, ESLint 0 errors,
323 tests (8 new), build. **Not run against the real worker, Ollama, Yahoo or a browser.**

## After deploy

`git pull` in `E:\Aladdin`, then restart the worker (Ctrl+C, `python -m app.worker`). An old worker
still blocks; on it the new Queue-page warning appears after 3 minutes.

## Not done

- No per-job time limit and no explicit timeout on the Yahoo provider (none found in
  `yfinance_provider.py`); a hung vendor call would still hold up its job, though no longer the queue.
- Jobs and analysis now overlap in time (never two jobs at once). They share no LLM, but both use the
  database and the network.
- Warm-up for a holding added while a run is active waits until the worker is idle.
