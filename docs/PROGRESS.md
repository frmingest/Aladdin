# Aladdin — Progress

**Last updated:** 2026-10-11 (Design Master Sprint 0 written). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Design Master Sprint 1 (tower kit) is written, on branch `feature/design-sprint-1-tower-kit`, PR #104 open for Faiz's review; not merged, not deployed.** Sprint 0 is merged (#103). Plan: [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md) (Sprint 1 result at the end of Part 6). Behind the Settings "Object art" switch (off by default), a keep is drawn as a Stitch spire (great, medium) or bastion (small, tiny, unknown) in the tower's wall material; `unsurveyed` stays the code ghost keep; outposts, granaries and gold stores stay SVG until Sprint 2. Light in windows and at the door, cracks, ivy, scaffolding, breaches and ladders stay code, restyled with the ink outline, and a per-weather grade sits the pictures in the sky. Spike verdict: go (baked pennants stay, freshness is the light). Next: **Sprint 2** (outpost, granary, gold store, shack, Great Keep).

Phase 11 (the Buffett/Munger rebuild) is stable. Game mode follows the [team review](game-mode-team-review-2026-10-09.md) order. Merged on `main` (checked against git 2026-10-11, head `02fa1f4`): #84-#87 (integrity, Fortress art pass, Long Memory, Knife-edge), #88-#93 (identity and the game design challenge), #97-#100 (Stitch design passes), #101 (Stitch objects, Phase A), #102 (design plan), #103 (Design Master Sprint 0). Deploy of any of them is not verified. Nothing else in flight. Next mechanics in order: C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now; also the rest of Sprint 29 (G40 tour, G38 sounds) and Sprint 26a (game pages in the smoke test, word budgets).

State: the local checkout `E:\Aladdin` is stale (on `feature/currency-edit-and-nok-equivalent`, uncommitted edits, and 103 MB of untracked art under `frontend/public/art/`, now git-ignored by the Sprint 0 PR); build from fresh `main`. Repo migration head `t1f2a3b4c5d6`, confirmed on Supabase by Faiz. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review the Sprint 1 PR on real data (Faiz):** Settings, Object art on; Fortress in calm, gathering and besieged; look at a fresh, a weathered and an overgrown tower, a breached one and one with ladders; phone width
- [ ] **Build Sprint 2 (Claude):** outpost, granary, gold store (vault-1/2/3), shack, Great Keep with the realm-verdict banner as code
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
