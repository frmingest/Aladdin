# Nightly tripwire check (Sprint 15 #5, F29) — 2026-09-29

> **Status update 2026-10-04 (housekeeping review):** the code described here is merged to `main` (checked in the repo at `07cf9fb`). The "not merged / PR open" wording below was true when written and is kept as history. Whether it is deployed or behaves correctly live was not checked in that review.

**Status:** written and tested on branch `feature/nightly-tripwire-check`, PR for review — not merged, not deployed, not checked live. No migration.

## Problem
A tripwire's `fired_at` was only set when someone opened a thesis page (evaluation happens on read, from stored data). A price that crossed a threshold on Tuesday stayed "not firing" until Faiz happened to look.

## What it does
Once per UTC day (first worker poll after 03:00 UTC) the PC worker:
1. finds every holding with at least one **active** tripwire;
2. refreshes that holding's share price (best effort — a failure is reported and the stored price is used instead);
3. evaluates the tripwires with the existing `evaluate_holding_tripwires` (same firing rule as the pages — deterministic, no LLM);
4. reports which tripwires **newly fired** or **cleared** in this pass, and stores the run time plus a one-line summary in `app_settings` (`tripwire_check_last_run`, `tripwire_check_last_summary`).

One holding failing never stops the rest. A paused tripwire is skipped. "No data" never clears a firing (unchanged rule).

## Where it shows
| Place | What |
|---|---|
| System status → Thesis tripwires | "…· nightly check last ran <time>: N tripwire(s) on M holding(s), X newly fired, Y cleared" |
| `GET /thesis/monitor` | new `last_check_at`, `last_check_summary` |
| `POST /thesis/check` | run the check now; returns what newly fired/cleared (blocked in demo mode) |

## Settings
`TRIPWIRE_CHECK_ENABLED` (default `true`), `TRIPWIRE_CHECK_HOUR_UTC` (default `3`).

## Files
`backend/app/services/thesis/nightly.py` (new), `worker/runner.py` (`maybe_check_tripwires`), `api/thesis.py`, `schemas/thesis.py`, `services/system_status.py`, `config/settings.py`, `tests/unit/test_thesis_nightly.py` (9 tests).

## Tests
Backend 1031 pass / 2 fail — the same 2 pre-existing failures as unmodified `main` (`test_demo_mode_api…blocked_outright`, `test_factory…shares_the_primary_budget_guard`). `ruff check .` clean.

## Frontend (added later the same day)
Thesis page: **Check now** button + last-run text. Dashboard: red banner while any tripwire fires (holding links, Open Thesis, Check now). Same branch/PR.

## Not built (deliberate)
- No push/e-mail notification — the result is visible in the app; a delivery channel is a separate backlog item.
- Only the **share price** is refreshed; fundamentals-based tripwires (margins, leverage…) change only when a new filing is uploaded, which already re-evaluates on read.
- Runs only while the PC worker is running. Railway does not run it (its IP is often blocked by Yahoo).

## For Faiz
After merge + restart of the PC worker: System status should show the nightly-check text after 03:00 UTC, or call `POST /thesis/check` once to see it immediately.
