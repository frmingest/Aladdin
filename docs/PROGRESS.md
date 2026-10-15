# Aladdin — Progress

**Last updated:** 2026-10-15 (E1 Blindfold Years written, PR open; Map sector towers #155 and the Contest 3 plan #156 are merged). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Blindfold Years (E1) is merged (#157) and live; a wording pass (PR `feature/blindfold-copy`) is written and tested, not merged, not deployed.** Faiz found the copy too wordy; same numbers, shorter game-style words. A new Fortress room: a holding rolled back to a past year with its name masked, you stake a low and a high figure for the next year's owner earnings, then the stored figure is shown. Read-only, no migration, answers kept in the browser ([write-up](game/blindfold-years-2026-10-15.md)). Seen only on mock data in a built copy of the page.

State: `main` is at `30f0cb9` (#156), which includes #155 (Map towers as sector pictures); deploy not checked, say if Railway has redeployed. Repo migration head `w1e2f3a4b5c6` (forecasts, C2); E1 adds none. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review and merge the Blindfold Years PR (Faiz), then open Blindfold with Game mode on** (desktop and phone) and check how many puzzles the real data gives (the plan guessed 20 to 30; the strict rule may give fewer) and that the scene reads
- [ ] **Once the Map towers (#155) are deployed, look at the live Map with Game mode on:** fog patches readable on each sector picture, wide pictures not too small ([doc](game/map-sector-landmarks-2026-10-14.md))
- [ ] **After #150 is deployed (Faiz):** Refresh Margin of safety, open "Can't be ranked yet" then "Why" on Vend Marketplaces, Salmon Evolution and Vår Energi and sanity-check the owner-earnings figure (if wrong, check share count and price currency first). [Doc](valuation/loss-making-price-assumes-2026-10-14.md)
- [ ] **Contest 3 plan: D1 to D8 ruled 2026-10-15 (all as recommended: lanterns and ravens, no figures; teal ribbon; browser-first state; journal note for E2; Norwegian copy by Claude, reviewed by Faiz; one backdrop per sprint; order E1 to E5).** E2 Winter Rehearsal is next but needs the E2 Stitch pictures first (icicles, winter-order tablet, war-table; none in `art/` yet) ([plan](sprints/game-design-sprint-plan-2026-10-15.md))
- [ ] **Optional, visual:** with Game mode on, look at the World banner crop on the Siege Simulator (Claude could not judge it)

## Recent Blockers / Open Questions

- **Siege World yardstick (#149) is live, checked by Claude 2026-10-14** in the built-in browser: the Oslo | World toggle works, World reads 7 of 7 holdings modelled, a 20% world fall costs the book 6.3% (Oslo 9.4%), funds fall more and Norwegian stocks less than under Oslo (e.g. Vår Energi -0.5% vs -43.6%, L&G Gold Mining -15.7% vs +10.7%), as the doc expects. Not checked: the lookout-tower banner crop (a screenshot did not refresh). ACWI is US-listed, so day alignment with Oslo-listed holdings is looser than with OSEBX (the Fit figure shows it); the back-test card still uses Oslo only
- **Kongsberg P/S jump at FY2024:** a data question, not a task (needs the stored revenue and net income for FY2023-25); "Multiples over time" likely pairs one recent price with every year (from the code, not checked live) ([doc](valuation/kongsberg-multiples-display-2026-10-14.md))
- **Hit rate (C2):** the analyst half stays "too few so far" for months and counts every run, so repeat runs on one holding weigh more
- **Housekeeping:** the legacy analysis tables stay until Faiz asks (CLAUDE.md)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Backend mypy:** 166 findings (measured 2026-10-14); the report-only job (#152, merged) shows them, and it becomes blocking only at zero
- **Not re-checked in the hardening sprint:** the Dashboard macro chart showing only the original six series; ECON-007 (regime-aware risk bands) is out of scope

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-14 loss-making view, endpoints and mypy merged, 2026-10-14 Siege World merged and checked live, 2026-10-14 open items closed by Faiz, 2026-10-14 C2 hit rate merged and checked, D2 Camera checked, Pareto Bank closed and D1 Plain lens and Prompt log, 2026-10-13 C1 Siege back-test and review tasks, 2026-10-13 design plan, 2026-10-13 review tasks closed by Faiz, 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
