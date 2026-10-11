# Aladdin — Progress

**Last updated:** 2026-10-11 (Design Master Sprint 3 written). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Design Master Sprint 3 (siege camp and scene life) is written, on branch `feature/design-sprint-3-siege-and-life`, PR open for Faiz's review; not merged, not deployed.** Sprints 0 (#103), 1 (#104) and 2 (#105) are merged. Plan: [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md) (Sprint 3 result at the end of Part 6). Behind the Settings "Object art" switch (off by default): the siege camp is built from the sprites by the same counts as the code camp (nothing in calm or unsurveyed weather), fire arrows are rotated along their arcs, terrace pines and rocks and the "new report" raven use the pictures. Also fixed in art mode: the dark plank drawbridge under each tower read as a stake the tower stood on; it is now a stone causeway that widens towards the viewer. The lamp swap is cut (see plan). Next: **Sprint 4** (map).

Phase 11 (the Buffett/Munger rebuild) is stable. Game mode follows the [team review](game-mode-team-review-2026-10-09.md) order. Merged on `main` (checked against git 2026-10-11, head `27df200`): #84-#87 (integrity, Fortress art pass, Long Memory, Knife-edge), #88-#93 (identity and the game design challenge), #97-#100 (Stitch design passes), #101 (Stitch objects, Phase A), #102 (design plan), #103 (Design Master Sprint 0), #104 (Sprint 1, tower kit), #105 (Sprint 2, structures and Great Keep). Deploy of any of them is not verified. Nothing else in flight. Next mechanics in order: C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now; also the rest of Sprint 29 (G40 tour, G38 sounds) and Sprint 26a (game pages in the smoke test, word budgets).

State: the local checkout `E:\Aladdin` was synced to `main` (`d7c6e5d`) on 2026-10-11; the old uncommitted edits of `feature/currency-edit-and-nok-equivalent` (already merged as #68) are in `git stash`, masters live in git-ignored `art-masters/`. Repo migration head `t1f2a3b4c5d6`, confirmed on Supabase by Faiz. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review the Sprint 1 to 3 art on real data (Faiz):** Settings, Object art on; Fortress in calm, gathering and besieged; look at a fresh, a weathered and an overgrown tower; an outpost, granary and gold store; the Great Keep with its verdict flag; shacks in a shantytown; Settings, Object art on; Fortress in calm, gathering and besieged; look at a fresh, a weathered and an overgrown tower, a breached one and one with ladders; phone width; also the siege camp (gathering and besieged), the stone causeways under towers, the pines, and a raven
- [ ] **Build Sprint 4 (Claude):** map settlements, props and landmarks per the plan
- [ ] **Generate the missing objects in Stitch (Faiz, any time; needed by Sprint 6):** batch 1 (wall segment, corner bastion, genie, well, haystack, bush) and batch 2 (map pieces, Oracle, Partner, Sal cheer, shopkeeper faces); prompts in the master doc, Part 6
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
