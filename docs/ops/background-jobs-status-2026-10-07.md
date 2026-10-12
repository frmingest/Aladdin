# Background jobs on System status (2026-10-07)

**Status: written and tested on branch `feature/background-jobs-status`, off `main` `e668428`. Not merged, not deployed, not seen in a browser.**

Faiz asked whether the System status page shows the night / background jobs, and whether the app has such jobs. It had jobs, but the page showed only one of them (the tripwire check, as a line inside "Analysis runs"). This adds a **Background jobs** card.

## 1. The jobs

| Job | Runs on | Due | Last run comes from |
|---|---|---|---|
| Tripwire check | PC worker | daily after 03:00 UTC, queue idle | `tripwire_check_last_run` (existing) |
| Page snapshot refresh | PC worker | daily after 04:00 UTC, queue idle | `snapshots_last_run` (existing) |
| Fortress history frame | PC worker | daily after 05:00 UTC, queue idle | newest `game_state:*` row in `computed_snapshots` |
| Holding warm-up | PC worker | when a holding has no price yet | new run record `job_last_run:warmup` |
| Keep pages warm | PC worker | when inputs change, at most every 5 min | new run record `job_last_run:keepwarm` |
| Macro data refresh | Railway backend | every 12 h | newest `last_success_at` in `macro_series_status` |

The hours and on/off switches are the existing settings (`*_hour_utc`, `*_enabled`). The post-deploy smoke test (GitHub Actions, 05:30 UTC) is not listed: it is not visible to the database.

## 2. How a row's state is decided (`app/services/job_status.py`)

- **Daily job:** *OK* if it ran since its most recent due time. *OK, "waits for an idle queue"* during the first 3 hours after that time (the worker only runs these when the analysis queue is idle, and a full refresh has taken 13+ minutes). After that, *Check* with the cause: "PC worker is offline" or "online but did not finish: check the worker log". Switched off in settings: *Off*.
- **Warm-up and keep-warm:** event-driven, so there is no deadline and they never warn. They show when they last did work and a one-line summary, or "Has not needed to do any work yet".
- **Macro refresh:** *Check* if there has been no successful fetch for twice the interval; *Off* when the interval is 0 or the macro provider is not live.
- **Needs attention:** a *Check* job is added to the page's "Needs attention" box only if it has run before, or if the worker is online and it still has not run. A never-run job on a fresh deployment (worker never started) stays a warning on its own row, so a new setup is not greeted by three issues.

## 3. Changes

- Backend: new `app/services/job_status.py`; `jobs` added to `build_system_status` and to `GET /system/status` (`JobItemOut`); the worker records warm-up and keep-warm runs (`record_job_run`, generic `app_settings` keys, no migration). The tripwire and snapshot jobs are untouched.
- Frontend: a **Background jobs** card between Providers and Data freshness (`JobRows`).
- Demo mode: the demo payload has no jobs, so the card is hidden there.

## 4. Verified

Backend 1,693 tests pass (13 new in `tests/unit/test_job_status.py`: due-time maths, never-run, offline vs online worker, grace period, switched off, game-state frame, event jobs, macro states, Needs-attention rules), Ruff clean. Frontend tsc, ESLint 0 errors, 315 tests (3 new), build. **Not run against the real database or worker, and not seen in a browser.**

## 5. After deploy

- The warm-up and keep-warm rows read "Has not needed to do any work yet" until the **restarted** worker does some. Restart the worker after `git pull` (Ctrl+C, `python -m app.worker`).
- If the worker is off, the three daily jobs turn to *Check* 3 hours after their hour. That is the intended signal, not a bug.
- Not built: a "run now" button for any job, a record of failed runs, and the GitHub smoke-test result.
