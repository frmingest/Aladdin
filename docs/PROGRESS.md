# Aladdin — Progress

**Last updated:** 2026-10-14 (D2 Camera written on `feature/d2-camera`, PR to review; D1 and the prompt log merged; Pareto Bank closed; blocker decisions recorded). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Trust slice: D2 Camera is written and waits for review.** Branch `feature/d2-camera` (PR to review, not merged, not deployed): the painted Fortress gets zoom, fit and a **Read labels** step that makes the smallest label 11 px, mouse-drag pan and Ctrl + wheel zoom, scroll-to-selected, and on screens of 1280 px and up the survey docks beside the scene ([doc](game/camera-d2-2026-10-14.md)). The phone Fortress keeps its sideways scroll. D1 Plain lens (#136) and the Prompt log (#137) are merged.

State: `main` is at `3f34597` (#137 merged; Claude has not checked which build the live site serves). Repo migration head `u1a2b3c4d5e6` (D2 adds none; if #137's migration was not run on deploy, run it). Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review and merge the D2 PR (Faiz):** then open the Fortress Scene, press Read labels, zoom, drag, select a far tower, and on a wide screen check the survey sits beside the scene (steps in the [doc](game/camera-d2-2026-10-14.md)); merging is a production deploy. No browser or phone check was done by Claude
- [ ] **Confirm the prompt-log migration ran (Faiz):** #137 added `u1a2b3c4d5e6`; merging deploys, so check System status loads the Prompt log card
- [ ] **Next build (Claude, decided 2026-10-14, waits for a go):** fix the Equinor price (41.95 USD) and the Kongsberg 5:1 split, add a flag for sudden price jumps, and run a one-time holding-currency check; one feature branch, one PR
- [ ] **Then, in order (Claude, decided 2026-10-14):** global benchmark option in the Siege Simulator; "can't be ranked yet" plus a no-score "what the price assumes" view for loss-making companies; remove the 4 unused endpoints; report-only mypy job
- [ ] **Next design slice (Faiz to pick):** after D2 nothing is queued; options are in the review's remaining items ([team review](game/game-mode-team-review-2026-10-09.md)); B2 Then and Now is the only item left of the original order

## Recent Blockers / Open Questions

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
