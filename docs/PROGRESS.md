# Aladdin — Progress

**Last updated:** 2026-11-06 (polish pass PR 4). Rolling log: active status only, under 100 lines, at most 7 tasks (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Plans consolidated (#301, merged).** One open-work list, [`sprints/remaining-work-2026-11-06.md`](sprints/remaining-work-2026-11-06.md), replaces the game design plan (parked), the hardening sprint (closed) and the Sprint 15 plan (closed); all three moved to `archive/`. Now building the 3D polish pass in small PRs ([audit](game/game3d-polish-audit-2026-11-06.md)): PRs 1 and 2 are merged, PR 3 (doors, #304) and PR 4 (sky and soft shadows, #305) are open for review. Hall of Records design note is next.

State: `main` at `b9203f4` (#303). S21 to S31 and A1 to A8 are merged; S29 and the asset batch have not been seen in a browser by Claude and deploy is not checked, say if Railway has redeployed. Database is Railway Postgres, files on Cloudflare R2 (Supabase retired 2026-10-14). Migration head `z1b2c3d4e5f6` (none added). Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Hall of Records, design note (Claude):** a 3D place for interest-rate and macro data; relate it to the Town Hall Macro board and the Records Hall, list the series, give a visual verb and scene line. No code until you approve the note.
- [ ] **3D polish pass (Claude):** PR 1 outlines and PR 2 smoke and sparks merged, PR 3 doors (#304) and PR 4 sky gradient and soft shadows open. Then opt-in sound ([audit](game/game3d-polish-audit-2026-11-06.md)). Faiz: press P in the town to check draw calls.
- [ ] **Rate sensitivity per holding, then the PDF memo (Claude):** neither exists on `main`; the rate work feeds the Hall of Records.
- [ ] **Text pass 4 (Claude):** Vault, Night Watch, ravens, Realm panel, store gates, backend text, Sal and Hype Booth speech, Where-to names, `stormDrillWordsV1`. Faiz decides what "Last verdict" on the Land shelf says ([review](game/game3d-text-review-2026-11-03.md))
- [ ] **Look-over in `/game3d` (Faiz):** S29 battlefield (west strip scorch and chalk bars, war table on the east flank, bluer river); press P for fps.
- [ ] **Data chores (Faiz):** Newsweb watch job green (#195); *Fetch all reports* on JAREN.OL (#194); The Printer amounts call ([plan](game/the-printer-sprint-plan-2026-10-20.md))

## Recent Blockers / Open Questions

- **Backend loose end:** clear the Supabase leftovers (`backend/.env.example`, the `config/database.py` docstring) and commit the Supabase-to-Railway runbook ([list](architecture.md#11-known-gaps-and-loose-ends))
- **3D ideas not built** (calibration in 3D is in the [discovery plan](game/game3d-discovery-sprint-plan-2026-11-02.md)): Storm Drill camp following the siege level, an Oracle line pointing at the drill post; on a phone the green "Done!" pill in the Quest log wraps into a fat oval
- **Parked:** flat Game mode ideas (E4, E5, B1 to B13), see [archive](archive/game-design-sprint-plan-2026-10-15.md). Hardening leftovers (mypy, Fortress performance, ECON-007) are in [remaining-work](sprints/remaining-work-2026-11-06.md) section 4
- **Owner-earnings check (#150):** Refresh Margin of safety, "Can't be ranked yet" then "Why" on Vend, Salmon Evolution and Vår Energi ([doc](valuation/loss-making-price-assumes-2026-10-14.md))
- **Kongsberg P/S jump at FY2024:** a data question, not a task ([doc](valuation/kongsberg-multiples-display-2026-10-14.md))
- **Hit rate (C2):** the analyst half stays "too few so far" for months and counts repeat runs on one holding more
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): [overview](valuation/data-gaps-overview-2026-10-03.md)
- **Agentic-coding audit 2026-11-01** ([doc](ops/agentic-coding-audit-2026-11-01.md)): no branch protection on `main` (35 of 97 PRs merged before CI finished, 3 with a red secret scan); game pages shipped unseen in a browser; project docs out of sync; 9 rule contradictions to decide
- **Legacy tables stay until Faiz asks** (CLAUDE.md); **backend mypy** 166 findings, report-only job

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-11-06 #264 to #300, S21 to S31 and A1 to A8; 2026-11-02 late night #262; 2026-11-02 night #260, #261; 2026-11-02 afternoon #253, #255, #256, the Town Hall; 2026-11-02 #249 to #252, S16 and S17; 2026-11-01 late #248, the Vault chest; 2026-11-01 evening #238 to #246, the town kit, Market Street and the Town; 2026-11-01 everything merged #187 to #237, including the 3D courtyard and Standing levels 1 to 4; 2026-10-19 #155 to #186; then older snapshots). Oldest: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
