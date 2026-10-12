# Aladdin — Progress

**Last updated:** 2026-10-12 (Siege Simulator art written). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Design Master Sprint 14 (Siege Simulator art) is written, not merged, not deployed:** `feature/siege-simulator-art` (off `main` `608e830`). The Siege Simulator was left out of the room art passes (decision 10), so it still drew generic boxes. In art mode its tower row now uses the real tower pictures (wall material and size as on the Fortress), soot, fallen stones, stuck fire arrows and a flickering column of fire that climbs the wall as the share lost grows (a ragged hole and smoke where the wall is at risk of breach), a faded "?" for towers that are not modelled, the rampart tile along the foot, and the besieging camp for the same siege level the Fortress uses (none when calm). Behind the Settings "Object art" switch; the SVG strip stays as the fallback. Frontend only. Doc: [siege-simulator-art-2026-10-12.md](siege-simulator-art-2026-10-12.md).

Design Master Sprint 9 (Council) is merged (#115). Sprint 11 (Circle) follows on its own branch; Sprint 7 (default and hardening) is last, as Faiz asked. Plan: [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md).

Phase 11 (the Buffett/Munger rebuild) is stable. Game mode follows the [team review](game-mode-team-review-2026-10-09.md) order. Merged on `main` (checked against git 2026-10-11, head `32be2dd`): #84-#87 (integrity, Fortress art pass, Long Memory, Knife-edge), #88-#93 (identity and the game design challenge), #97-#100 (Stitch design passes), #101 (Stitch objects, Phase A), #102 (design plan), #103 (Design Master Sprint 0), #104 (Sprint 1, tower kit), #105 (Sprint 2, structures and Great Keep), #106 (Sprint 3, siege camp and scene life), #107 (Sprint 4, the map), #108 (Sprint 5, marketplace stalls and Sal busts), #109 (Sprint 6, second Stitch batch), #111 to #114 (Sprints 8, 10, 12, 13: room banners, Records, Chronicle, Map table). Deploy of any of them is not verified. Nothing else in flight. Next mechanics in order: C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now; also the rest of Sprint 29 (G40 tour, G38 sounds) and Sprint 26a (game pages in the smoke test, word budgets).

State: the local checkout `E:\Aladdin` is on `feature/design-sprint-6-second-batch`, cut from `main` (`a2f88b2`) on 2026-10-11; masters live in git-ignored `art-masters/` (the new Stitch folders, including `latest`, are copied there; the same folders also remain under `frontend/public/art/`, which is git-ignored too and safe to delete). Repo migration head `t1f2a3b4c5d6`, confirmed on Supabase by Faiz. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review the Siege Simulator art on real data (Faiz):** Settings, Object art on, `/fortress/siege`: does the fire read as damage at 10%, 30% and 50% falls (and still on a phone, and with reduced motion on); is the camp right for calm, storm and siege; towers still readable at 18 holdings and at phone width
- [ ] **Review the Sprint 1 to 4 art on real data (Faiz):** Settings, Object art on. Fortress in calm, gathering and besieged: a fresh, a weathered and an overgrown tower, an outpost, granary, gold store, the Great Keep with its verdict flag, shacks, the siege camp, causeways, pines and the raven. Cartographer's table: each settlement's picture and fog patches, the keep and its commission flag, pines, rocks, ships, the port, island and palms; phone width
- [ ] **Review Sprints 5 and 6 on real data (Faiz):** Sprint 6: Fortress wall and corner bastions (both rows, besieged weather), terraces, the Genie, Cartographer mountains/hills/serpent/compass, Council busts, Sal cheer, store shopkeeper faces. Sprint 5: Settings, Object art on; Marketplace street (stall picture and tone edge on each plate, phone width), Talk to Sal and Hype Booth (busts)
- [ ] **Review the room art on real data (Faiz):** Settings, Object art on. Council (table, advisors on chairs, seals: does the broken seal still read as a warning at 33 px, candles), Records (caskets), Chronicle (strata blocks, sconce), Map table (frame)
- [ ] **Generate what is still missing in Stitch (Faiz, optional):** a smiling shopkeeper (the \"ready\" face), curtain-wall variants if the single tile looks repetitive; see Part 8 of the plan
- [ ] **Generate the rest of the room set in Stitch (Faiz, optional):** the five room crests (the tower medallion that arrived fits the Fortress, not a room) and a second advisor chair in a different shape (the high-backed one arrived as a lectern); see the plan, "Still missing for the rooms"
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

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/` and are linked above.
