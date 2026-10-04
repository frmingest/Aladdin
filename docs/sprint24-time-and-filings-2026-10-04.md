# Sprint 24: Time and filings (game mode G14a, G14, G15, G16)

**Date:** 2026-10-04 · **Branch:** `feature/game-mode-sprint-24-time-and-filings` · **Status:** written and tested, not merged, **not deployed**

## What was built

| Id | Feature | What it does |
|---|---|---|
| G14a | Nightly game-state snapshot | The worker stores one `game_state:YYYY-MM-DD` frame per UTC day at 05:00 UTC (after the 04:00 page snapshots). Kept 540 days. Demo mode is never stored. |
| G14 | Chronicle (`/fortress/chronicle`) | Scrub or play the fortress through time. *Stored* frames show real walls, moats and weather. Days before the first stored frame are rebuilt from old portfolio uploads as *positions only*: towers drawn as ghosts, wall/moat/thesis marked unsurveyed. No wall, moat, thesis or weather change is reported across such a frame. |
| G15 | Ravens | A raven lands on a tower whose newest period was captured within 45 days: figures compared with the previous period (ROIC, ROE, margins, leverage, coverage, owner earnings, FCF). Annual or quarterly reports captured without line items give a text-only raven. Banks skip meaningless measures. "Seen" is per browser. |
| G16 | Night Watch | Card at the top of the Fortress: what the nightly checks did overnight (last tripwire check, last snapshot refresh, tripwires fired, frame-to-frame changes, new ravens). A watch that never ran or is older than 36 h is **unknown**, never "quiet". |

## Design choices

- **No migration.** History reuses `computed_snapshots`.
- **Versioned rules:** `app/domain/game_mapping/time_and_filings_v1.py`, setting `active_time_and_filings_version`.
- **Read-only, deterministic.** All comparisons are application code; no LLM. No points, streaks or rewards; nothing says buy/sell/add/trim.
- **Unknown stays unknown;** demo mode wins on all three routes (`GET /game/chronicle`, `/game/ravens`, `/game/night-watch`).

## Verification

- Backend: 1,496 tests pass (40 new), Ruff clean.
- Frontend: 249 tests pass (20 new), `tsc --noEmit` clean, ESLint 0 errors (2 existing warnings), build OK.
- Not run against real data or the live deploy.

## Needs from Faiz after merge

1. `git pull`, deploy, **restart the worker** so G14a starts storing frames (first frame appears after 05:00 UTC; until then the Chronicle shows positions-only history).
2. Walk Fortress → Night Watch, Ravens, **Chronicle**; tell me what reads wrong, alarmist or missing.
