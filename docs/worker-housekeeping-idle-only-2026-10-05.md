# Worker: daily jobs only when the queue is idle (2026-10-05)

**Status:** written and tested on branch `fix/worker-housekeeping-idle-only`; **not merged, not on Faiz's PC yet.**

## Symptom

Faiz started the local worker and it picked up the next queued analysis, finished it, and then did
not start the next holding right away. The log showed only FRED requests for 10 to 15 minutes
after "run … finished: COMPLETED".

## Cause (read from `backend/app/worker/runner.py` and the log)

`run_forever` ran these passes inline after every `run_once()`, finished run or not:

```
maybe_check_tripwires()     # once per UTC day, after 03:00 UTC
maybe_refresh_snapshots()   # once per UTC day, after 04:00 UTC
maybe_store_game_state()    # once per UTC day, after 05:00 UTC
```

They share the analysis thread, so nothing was claimed until they returned. The worker was started
at about 05:00 UTC (07:00 Berlin), after all three cut-off hours, so all three were due on the
first pass.

`refresh_all_snapshots` forces a live refresh of prices, FX and FRED rates for the whole portfolio
and rebuilds four pages. In the log it started right after run 1 (07:03:02), made FRED calls until
07:16:31 and was still running when Faiz pressed Ctrl+C at 07:17:15. Yahoo calls do not appear in
the log, so the real duration is unknown but at least 13 minutes.

It writes `snapshots_last_run` only at the very end. The Ctrl+C therefore left it "never run today",
and it ran again after the second analysis (FRED calls from 07:22:50).

## Fix (option 1 of 3 discussed)

The five housekeeping passes (the three above plus `maybe_warm_cold_holdings` and
`maybe_keep_snapshots_warm`) now run only when `run_once()` did not just finish a run, i.e. the queue
is idle, waiting for Gemini quota, or the local LLM is unavailable. After a finished run the loop
goes straight back to claiming the next run.

Effect: a queue of holdings is worked through back to back. The daily jobs still run once a day,
when the queue drains. If the queue is never empty, they wait.

Changed: `backend/app/worker/runner.py` (`run_forever`), and the two loop tests in
`backend/tests/unit/test_sprint20_speed.py` (an idle loop runs all five passes in order; a loop
after a finished run runs none).

## Checks

- Full backend suite: 1,521 passed (cloud workspace, `MACRO_DATA_PROVIDER=none`, Postgres driver not
  installed there; the tests use SQLite).
- Ruff 0.16.8 clean on the changed files.
- Not run against the real worker, Ollama or Yahoo.

## Not done (optional follow-ups)

- Make the snapshot refresh resumable (a marker per snapshot) so an interrupted refresh does not
  start over.
- Hide the FRED `api_key` from the httpx log line (set the `httpx` logger to WARNING). The key is in
  the worker log in plain text; rotate it (see Progress, §2 D).

## After merge

`git pull` in `E:\Aladdin`, then restart the worker. Let the first daily refresh finish once.
