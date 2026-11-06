# Aladdin — Progress

**Last updated:** 2026-11-06 (3D S29: the old battlefield and war table written, river bluer; A1 to A8 merged). Rolling log: active status only, under 100 lines, at most 7 tasks (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**3D S29, the old battlefield (PR open on `feature/game3d-s29-battlefield`):** the Siege Field gets a scorched strip with a scorch bar (what happened) and a chalk bar (what the page said) per holding from the stored back-test, plus a war table pinning your newest three Storm Drill notes; the river outside is bluer. Tests, type-check, lint and build pass; never seen in a browser, not deployed ([doc](game/game3d-s29-battlefield-2026-11-06.md)). Asset plan A1 to A8 and S31 outdoor holdings are merged and were looked over by Faiz (OK, 2026-11-05).

State: `main` at `590896a` (#299, A8, merged). S21 to S26, text passes 1 to 3, S31 PR 1 to 3 and A1 to A8 are merged (#264 to #299). Deploy not checked, say if Railway has redeployed. Database is Railway Postgres, files on Cloudflare R2 (Supabase retired 2026-10-14). Migration head `z1b2c3d4e5f6` (none added). Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **S29 old battlefield: review the PR, then ride out to the Siege Field in `/game3d`.** Walk the west strip: do the scorch and chalk bars read, do twelve plates overlap? Check the war table on the east flank and the bluer river outside the wall. Press P for fps and tell Claude if a spot is bad.
- [ ] **Text pass 4 (Claude):** Vault, Night Watch, ravens, Realm panel, store gates, backend-written text, the failed look-back save, Sal and Hype Booth speech, Where-to names, `stormDrillWordsV1`. Faiz decides what "Last verdict" on the Land shelf should say ([review](game/game3d-text-review-2026-11-03.md))
- [ ] **Data chores (Faiz):** Newsweb watch job should be green on System status (#195); press *Fetch all reports* on JAREN.OL (#194); The Printer needs your call on how to get amounts ([plan](game/the-printer-sprint-plan-2026-10-20.md))

## Recent Blockers / Open Questions

- **Backend loose end:** clear the Supabase leftovers (`backend/.env.example`, the `config/database.py` docstring) and commit the Supabase-to-Railway runbook ([list](architecture.md#11-known-gaps-and-loose-ends))
- **3D ideas not built** (calibration in 3D is in the [discovery plan](game/game3d-discovery-sprint-plan-2026-11-02.md)): Storm Drill camp following the siege level, an Oracle line pointing at the drill post; on a phone the green "Done!" pill in the Quest log wraps into a fat oval
- **Owner-earnings check (#150):** Refresh Margin of safety, "Can't be ranked yet" then "Why" on Vend, Salmon Evolution and Vår Energi ([doc](valuation/loss-making-price-assumes-2026-10-14.md))
- **Kongsberg P/S jump at FY2024:** a data question, not a task ([doc](valuation/kongsberg-multiples-display-2026-10-14.md))
- **Hit rate (C2):** the analyst half stays "too few so far" for months and counts repeat runs on one holding more
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): [overview](valuation/data-gaps-overview-2026-10-03.md)
- **Agentic-coding audit 2026-11-01** ([doc](ops/agentic-coding-audit-2026-11-01.md)): no branch protection on `main` (35 of 97 PRs merged before CI finished, 3 with a red secret scan); game pages shipped unseen in a browser; project docs out of sync; 9 rule contradictions to decide
- **Legacy tables stay until Faiz asks** (CLAUDE.md); **backend mypy** 166 findings, report-only job

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-11-02 late night #262; 2026-11-02 night #260, #261; 2026-11-02 afternoon #253, #255, #256, the Town Hall; 2026-11-02 #249 to #252, S16 and S17; 2026-11-01 late #248, the Vault chest; 2026-11-01 evening #238 to #246, the town kit, Market Street and the Town; 2026-11-01 everything merged #187 to #237, including the 3D courtyard and Standing levels 1 to 4; 2026-10-19 #155 to #186; then older snapshots). Oldest: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
