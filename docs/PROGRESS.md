# Aladdin — Progress

**Last updated:** 2026-10-14 (B2 Then and Now written, PR open and stacked on #140; Game mode on by default, PR #140; hit-rate view approved with limits). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**B2 Then and Now is written (2026-10-14, `feature/b2-then-and-now`, stacked on #140, not merged or deployed).** Press **Then and now** on a record in the Hall of Records (painted or Plain) and it shows what the analyst's blind view said on the decision day next to today's, changed lines only, no judgement words ([doc](game/then-and-now-b2-2026-10-14.md)). Game mode now starts ON for a fresh browser (#140). D2 Camera is merged and checked OK by Faiz.

State: `main` is at `72637c7` (#139 merged; Claude has not checked which build the live site serves). Repo migration head `u1a2b3c4d5e6` (B2 adds none; if #137's migration was not run on deploy, run it). Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review and merge #140 first, then the B2 PR (Faiz):** #140: a fresh browser (or private window) opens in Game mode; anyone who chose "off" before stays off; the Settings toggle is unchanged
- [ ] **Confirm the prompt-log migration ran (Faiz):** #137 added `u1a2b3c4d5e6`; merging deploys, so check System status loads the Prompt log card
- [ ] **Next build (Claude, decided 2026-10-14, waits for a go):** fix the Equinor price (41.95 USD) and the Kongsberg 5:1 split, add a flag for sudden price jumps, and run a one-time holding-currency check; one feature branch, one PR
- [ ] **Then, in order (Claude, decided 2026-10-14):** global benchmark option in the Siege Simulator; "can't be ranked yet" plus a no-score "what the price assumes" view for loss-making companies; remove the 4 unused endpoints; report-only mypy job
- [ ] **Check B2 on the live site (Faiz) after deploy:** open a record, press Then and now (steps in the [doc](game/then-and-now-b2-2026-10-14.md)); no browser check was done by Claude
- [ ] **Next design slice (Faiz to pick):** B2 was the last item of the original order ([team review](game/game-mode-team-review-2026-10-09.md)); C2 hit rate waits for enough data (see Blockers)

## Recent Blockers / Open Questions

- **Hit rate (C2), decided 2026-10-14 (Faiz left it to Claude): yes, with limits.** Shown only once there are enough decisions (opens at 8 with a 6- or 12-month outcome), always with the count beside it and a "too few so far" state before that; the Oracle's range versus later price counts the same way; no score, streak or reward, and it never changes a verdict or a tower. This amends the Sprint 25 "no hit rate" rule. Needs the small `forecasts` table so the clock starts now, which is a database change to approve when the slice starts
- **Siege benchmark:** decided to add a global option (stand-in index fund, labelled as such on screen); OSEBX stays for Norwegian stocks ([doc](game/siege-instrument-sensitivity-2026-10-07.md))
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi): decided not to force a score; show "can't be ranked yet" with the reason, plus what the price assumes, as information only
- **Possible price/split data errors:** Equinor stored price 41.95 USD; Kongsberg 5:1 split not restated; decided to fix first ([diagnosis](valuation/valuation-data-diagnosis-2026-10-06.md))
- **Holding currency:** whether any holding was saved with a wrong currency is unchecked; if the Holdings column shows USD/EUR for a NOK holding, the CSV "Valuta" import is the cause; one-time check planned
- **Housekeeping:** decided to remove the 4 unused manual snapshot/position endpoints; the legacy analysis tables stay until Faiz asks (CLAUDE.md)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Fortress scene cost (Sprint 7, merged #131):** cut Fortress blocking time (lab, demo data, 4x CPU) from 130-160 ms to 30-50 ms and the score from 87-89 to 88-91; the rest is waiting for the page chunk and the data to arrive one after the other (largest paint about 3 s on simulated slow 4G). Not measured on a real phone or the live site
- **Backend mypy:** 169 errors, not in CI; decided on a report-only job with stubs for pandas, openpyxl, fitz, yfinance, boto3, apscheduler
- **Not re-checked in the hardening sprint:** the Dashboard macro chart showing only the original six series; ECON-007 (regime-aware risk bands) is out of scope


## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-14 Pareto Bank closed and D1 Plain lens and Prompt log, 2026-10-13 C1 Siege back-test and review tasks, 2026-10-13 design plan, 2026-10-13 review tasks closed by Faiz, 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
