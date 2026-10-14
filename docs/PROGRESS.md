# Aladdin — Progress

**Last updated:** 2026-10-14 (C2 hit rate merged as #147 and checked OK; Faiz closed the other open items; Siege global benchmark written, PR open). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Siege Simulator World yardstick (PR `feature/siege-global-benchmark`): written and tested, not merged, not deployed.** A toggle "Measured against: Oslo | World" on the Siege page; World is ACWI (a fund standing in for a world index) converted to NOK; Oslo stays the default. Scenarios `v4`, `GET /game/siege?benchmark=`, the worker also stores ACWI and USD/NOK. No migration ([doc](game/siege-global-benchmark-2026-10-14.md)).

State: `main` is at `fc4e2a1` (#148). Repo migration head `w1e2f3a4b5c6` (forecasts, C2); this PR adds none. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review and merge the Siege World-yardstick PR (Faiz), then check it live:** restart the PC worker (or wait a pass) so it stores ACWI and USD/NOK; open the Siege Simulator and press World. Funds should read higher than under Oslo, Norwegian stocks lower. Steps in the [doc](game/siege-global-benchmark-2026-10-14.md)
- [ ] **Next (Claude, decided 2026-10-14), in order:** "can't be ranked yet" plus a no-score "what the price assumes" view for loss-making companies; remove the 4 unused manual snapshot/position endpoints; report-only mypy job in CI

## Recent Blockers / Open Questions

- **Siege World yardstick:** ACWI is US-listed, so day alignment with Oslo-listed holdings is looser than with OSEBX (the Fit figure shows it). The back-test card still uses Oslo only. Until the worker has stored ACWI, World shows towers as "not modelled" with the reason. Not checked in a browser or on real holdings
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi): decided not to force a score; show "can't be ranked yet" with the reason, plus what the price assumes, as information only
- **Kongsberg P/S jump at FY2024:** a data question, not a task (needs the stored revenue and net income for FY2023-25); "Multiples over time" likely pairs one recent price with every year (from the code, not checked live) ([doc](valuation/kongsberg-multiples-display-2026-10-14.md))
- **Hit rate (C2):** the analyst half stays "too few so far" for months and counts every run, so repeat runs on one holding weigh more
- **Housekeeping:** the legacy analysis tables stay until Faiz asks (CLAUDE.md)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Backend mypy:** 169 errors, not in CI; decided on a report-only job with stubs for pandas, openpyxl, fitz, yfinance, boto3, apscheduler
- **Not re-checked in the hardening sprint:** the Dashboard macro chart showing only the original six series; ECON-007 (regime-aware risk bands) is out of scope

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-14 open items closed by Faiz, 2026-10-14 C2 hit rate merged and checked, D2 Camera checked, Pareto Bank closed and D1 Plain lens and Prompt log, 2026-10-13 C1 Siege back-test and review tasks, 2026-10-13 design plan, 2026-10-13 review tasks closed by Faiz, 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
