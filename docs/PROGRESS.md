# Aladdin — Progress

**Last updated:** 2026-10-11 (Design Master review and sprint plan). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Design Master sprint plan approved** (all nine decisions, 2026-10-11): the 52 new Stitch objects replace the drawn ones behind `?art=stitch|svg`, in Sprints 0-7. Sprint 0 (foundation) is next; nothing from it is built; the plan covers 41 of 56 object slots on the pages that can use pictures (73%) and lists what to generate next. Plan: [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md); style, rules and prompts for the missing objects: [stitch-master-object-art-2026-10-11.md](stitch-master-object-art-2026-10-11.md).

Phase 11 (the Buffett/Munger rebuild) is stable. Game mode follows the [team review](game-mode-team-review-2026-10-09.md) order. Merged on `main` (checked against git 2026-10-11, head `e939577`): #84-#87 (integrity, Fortress art pass, Long Memory, Knife-edge), #88-#93 (identity and the game design challenge), #97-#100 (Stitch design passes), #101 (Stitch objects, Phase A). Deploy of any of them is not verified. Nothing else in flight. Next mechanics in order: C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now; also the rest of Sprint 29 (G40 tour, G38 sounds) and Sprint 26a (game pages in the smoke test, word budgets).

State: the local checkout `E:\Aladdin` is stale (on `feature/currency-edit-and-nok-equivalent`, uncommitted edits, and 103 MB of untracked art under `frontend/public/art/`, not git-ignored); build from fresh `main`. Repo migration head `t1f2a3b4c5d6`, confirmed on Supabase by Faiz. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Build Sprint 0 (Claude):** masters out of `public/`, manifest and batch `pack.py`, Settings toggle, real S13; then Sprint 1 tower kit
- [ ] **Generate the missing objects in Stitch (Faiz, any time; needed by Sprint 6):** batch 1 (wall segment, corner bastion, genie, well, haystack, bush) and batch 2 (map pieces, Oracle, Partner, Sal cheer, shopkeeper faces); prompts in the master doc, Part 6
- [ ] **Clean up art folders (Faiz or Claude with delete permission):** `frontend/public/art/stitch_master` and `new` are retired copies; masters move out of `public/` in Sprint 0
- [ ] **Look at the merged game PRs on real data (Faiz):** Records, Circle, Map, Night Watch seal, Chronicle spine, Marketplace plates and Phase A (`?art=stitch`); dark and light, phone, Plain view, reduced motion
- [ ] **Check Knife-edge and Long Memory after deploy (Faiz):** click a stock tower on Fortress (distance to the next tier, thin crack within 10%); Chronicle shows days the worker was off under "What the record cannot show" ([knife-edge](knife-edge-a1-2026-10-09.md), [long memory](long-memory-b1-2026-10-09.md))
- [ ] **Decide (Faiz):** next mechanics slice (C1 Siege back-test, D1 Plain lens or D2 Camera) and whether a knife-edge tower may appear on the Council agenda
- [ ] **Re-score identity with screenshots:** page scores are inferred from code, not seen in a browser (first step of Sprint 7)

## Recent Blockers / Open Questions

- **Pareto Bank FY2025:** the `.xhtml` is untagged; re-attach the report so Claude can prepare the FY2025 + FY2024 CSV ([doc](pareto-gigante-and-fund-constituents-2026-10-04.md))
- **Siege benchmark:** the Siege Simulator measures against OSEBX only; a global ETF such as XDEF is understated by it. Decide whether to add a global benchmark option ([doc](siege-instrument-sensitivity-2026-10-07.md))
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi) cannot rank with an owner-earnings DCF; method undecided
- **Possible price/split data errors:** Equinor stored price 41.95 USD; Kongsberg 5:1 split not restated ([diagnosis](valuation-data-diagnosis-2026-10-06.md))
- **Holding currency:** whether any holding was saved with a wrong currency is unchecked; if the Holdings column shows USD/EUR for a NOK holding, the CSV "Valuta" import is the cause
- **Housekeeping decisions:** remove 4 unused manual snapshot/position endpoints; drop the legacy analysis tables (empty since the wipe; CLAUDE.md says leave them until Faiz asks)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/` and are linked above.
