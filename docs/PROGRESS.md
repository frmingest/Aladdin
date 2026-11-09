# Aladdin — Progress

**Last updated:** 2026-11-09 (4f merged #318; spread-dial history and temperament game voice in a PR). Rolling log: active status only, under 100 lines, at most 7 tasks (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Plans consolidated (#301, merged).** One open-work list, [`sprints/remaining-work-2026-11-06.md`](sprints/remaining-work-2026-11-06.md), replaces the game design plan (parked), the hardening sprint (closed) and the Sprint 15 plan (closed); all three moved to `archive/`. Now building the 3D polish pass in small PRs ([audit](game/game3d-polish-audit-2026-11-06.md)): PRs 1 to 4 are merged (the last was sky and soft shadows, #305). The Weather Tower (macro room) is merged (#315) and live; polish 5 (opt-in sound) and stall plates are merged (#317).

State: `main` at `e37f94e` (#318). S21 to S31 and A1 to A8 are merged; S29 and the asset batch have not been seen in a browser by Claude and deploy is not checked, say if Railway has redeployed. Database is Railway Postgres, files on Cloudflare R2 (Supabase retired 2026-10-14). Migration head `z1b2c3d4e5f6` (none added). Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Text pass 4 (Claude):** 4a to 4f merged (#312 to #318). 4g (temperament event sentences, summary and rule names in game voice, `temperWordsV1.ts`) is in a PR, written and tested, not deployed. Still open: Council and standing labels, frame-change lines with numbers, the remodelling counts line, and the Realm verdict "Buy/Sell" decision (Faiz). Faiz decides what "Last verdict" says ([4g note](game/game3d-dials-and-text-4g-2026-11-09.md), [review](game/game3d-text-review-2026-11-03.md))
- [ ] **3D text T5 look and judge (Claude, half done):** first look at the live site on 2026-11-09: Siege Field banners and chalked losses read well; the four north-wall dials had no needle; cause found (spreads had no stored history), fix in a PR, see the 4g note. Not yet seen: Library, Town Hall, Town at night, Battlefield, holding land, desktop width, fps ([note](game/game3d-text-4f-and-t5-look-2026-11-09.md), [plan](game/game3d-text-legibility-sprint-plan-2026-11-08.md))
- [ ] **Weather Tower (Claude):** merged (#315), live. The north-wall ("gaps") dials get a needle and trace once the spread-history fix (PR, `build_derived`) is deployed. Faiz: after deploy press Refresh data on the Macro page and look at the north wall; check `ACTIVE_MACRO_SERIES_VERSION` in Railway if set ([build](game/game3d-weather-tower-2026-11-08.md), [4g note](game/game3d-dials-and-text-4g-2026-11-09.md))
- [ ] **Rate sensitivity per holding, then the PDF memo (Claude):** neither exists on `main`. Rate sensitivity has no data to stand on: the app stores no floating/fixed split or debt maturity schedule per company, so it first needs a way to read that from filings. The PDF memo needs a PDF writer (only `pymupdf` is installed). Both are bigger than one sprint; need a plan first.
- [ ] **Look-over in `/game3d` (Faiz):** S29 battlefield; press M (sound) in the courtyard and walk into the Town Hall; press P for fps.
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
