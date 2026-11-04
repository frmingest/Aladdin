# Aladdin — Progress

**Last updated:** 2026-11-04 (S31 PR 3, the holdings step out, opened). Rolling log: active status only, under 100 lines, at most 7 tasks (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**S31 (holdings step out of the fortress): PR 1 (plots, #289) and PR 2 (river, lanes, fields, #290) are merged; PR 3 (the move itself) is open on `feature/game3d-s31-holdings-out`: every holding now stands on its outdoor plot, as its own building from its land (windmill, watermill, farm, fountain, mine, quarry) or a plain tower on a plinth where there is no art yet, with a door post and name sign on the lane side. The fortress yard is empty. Tests, type-check, lint and build pass locally; never opened in a browser, not deployed** ([write-up](game/game3d-s31-holdings-out-2026-11-04.md), [plan](game/game3d-outdoor-holdings-sprint-plan-2026-11-04.md)). Next: look at it in a browser, then PR 4 (the freed yard) if wanted.

State: `main` at `281f6cd` (#290, S31 PR 2, merged). S21 to S26 (ladder, mills, mine, fountain, farm), text passes 1 to 3 and S31 PR 1 and 2 are merged (#264 to #290). Deploy not checked, say if Railway has redeployed. Database is Railway Postgres, files on Cloudflare R2 (Supabase retired 2026-10-14). Migration head `z1b2c3d4e5f6` (none added). Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **S31 outdoor holdings (Faiz decided H1 to H3 on 2026-11-04): review and merge the PR 3 pull request, then walk out of the south gate in `/game3d`.** Do all eight holdings stand on the meadow with their building and a door post? Does E at the door take you into the land and back out in front of it? Is the river and lane look right (PR 2)? Press P and send the fps (six buildings now stand in the open scene). Tell Claude if a spot is bad or a walk is too long; quick travel stays deferred until you say so.
- [ ] **Text pass 4 (Claude):** Vault, Night Watch, ravens, Realm panel, store gates, backend-written text, the failed look-back save, Sal and Hype Booth speech, Where-to names, `stormDrillWordsV1`. Faiz decides what "Last verdict" on the Land shelf should say ([review](game/game3d-text-review-2026-11-03.md))
- [ ] **3D look-over in `/game3d` (Faiz, merged, never seen in a browser):** the S26 buildings (ladder #281, mills #284, mine and quarry #285, fountain #286, farm #287: run the theme readout on your real holdings), the S25 land and its lanterns, the Quest log, Siege Yard panel and advisor words (#282), the Records Hall and Town Hall boards, S16/S17 (Realm post, lamp, Storm Drill), the Town and Market Street, the Standing torches. Press P for fps and tell Claude if a spot is bad or a word is off ([S25](game/game3d-s25-holding-land-2026-11-03.md), [S26 farm](game/game3d-s26-farm-2026-11-03.md))
- [ ] **Flat Game mode look-over after the deploy (Faiz, merged #187 to #197):** Fortress section art, Map scene dive, Records books, Circle page gone, on desktop and phone ([section art](game/fortress-section-art-2026-10-29.md), [map](game/map-scene-dive-2026-10-19.md))
- [ ] **Data chores (Faiz):** Newsweb watch job should be green on System status (#195); press *Fetch all reports* on JAREN.OL (#194); The Printer needs your call on how to get amounts ([plan](game/the-printer-sprint-plan-2026-10-20.md))

## Recent Blockers / Open Questions

- **Backend loose end:** clear the Supabase leftovers (`backend/.env.example`, the `config/database.py` docstring) and commit the Supabase-to-Railway runbook ([list](architecture.md#11-known-gaps-and-loose-ends))
- **3D ideas not built** (siege tower, ram, backtest and calibration in 3D are now in the [discovery plan](game/game3d-discovery-sprint-plan-2026-11-02.md)): Storm Drill camp following the siege level, an Oracle line pointing at the drill post; on a phone the green "Done!" pill in the Quest log wraps into a fat oval
- **Owner-earnings check (#150):** Refresh Margin of safety, "Can't be ranked yet" then "Why" on Vend, Salmon Evolution and Vår Energi ([doc](valuation/loss-making-price-assumes-2026-10-14.md))
- **Kongsberg P/S jump at FY2024:** a data question, not a task ([doc](valuation/kongsberg-multiples-display-2026-10-14.md))
- **Hit rate (C2):** the analyst half stays "too few so far" for months and counts repeat runs on one holding more
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): [overview](valuation/data-gaps-overview-2026-10-03.md)
- **Agentic-coding audit 2026-11-01** ([doc](ops/agentic-coding-audit-2026-11-01.md)): no branch protection on `main` (35 of 97 PRs merged before CI finished, 3 with a red secret scan); game pages shipped unseen in a browser; project docs out of sync; 9 rule contradictions to decide
- **Legacy tables stay until Faiz asks** (CLAUDE.md); **backend mypy** 166 findings, report-only job

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-11-02 late night #262; 2026-11-02 night #260, #261; 2026-11-02 afternoon #253, #255, #256, the Town Hall; 2026-11-02 #249 to #252, S16 and S17; 2026-11-01 late #248, the Vault chest; 2026-11-01 evening #238 to #246, the town kit, Market Street and the Town; 2026-11-01 everything merged #187 to #237, including the 3D courtyard and Standing levels 1 to 4; 2026-10-19 #155 to #186; then older snapshots). Oldest: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
