# Aladdin — Progress

**Last updated:** 2026-10-09 (game visual identity review). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

Phase 11, the Buffett/Munger rebuild, is stable and merged; game mode follows the [team review](game-mode-team-review-2026-10-09.md) order. Merged on `main` (through `d4d0a70`, #87): the scroll reader, Scrolls library, Sprint 28 fog of war (#79, #80), ravens (#81), integrity fixes (#84), the Fortress art pass (#85), Long Memory B1 (#86; [write-up](long-memory-b1-2026-10-09.md)) and Knife-edge A1 (#87; [write-up](knife-edge-a1-2026-10-09.md)). Faiz confirmed the earlier review and deploy tasks OK on 2026-10-09 ([archive](archive/progress-archive.md)). Nothing else in flight. Next in order: C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now; also the rest of Sprint 29 (G40 tour, G38 sounds) and Sprint 26a (game pages in the smoke test, word budgets).

**Game visual identity (2026-10-09, proposed, nothing built):** Faiz noticed Circle and Council look like normal mode. Code audit confirms 5 of 8 fortress rooms score 0–1 on game identity; causes are process (only the home scene was ever scoped as art, the noise audit made the plain pages the benchmark, no reviewer asks "does it feel like the game"). Quick wins, a shared page-scene kit and drafted agent/standard/checklist changes: [overview](game-visual-identity-2026-10-09.md), [Circle and Council design](circle-council-design-2026-10-09.md), [Map design](map-design-2026-10-09.md), [page audit](game-pages-identity-audit-2026-10-09.md), [process changes](game-identity-process-changes-2026-10-09.md).

State (checked against git 2026-10-09): `origin/main` = `d4d0a70` (#87 Knife-edge merged); the local checkout `E:\Aladdin` is stale (on `feature/currency-edit-and-nok-equivalent`, with uncommitted edits), so build from fresh `main`. Repo migration head `t1f2a3b4c5d6`, confirmed on Supabase by Faiz. Whether #84–#87 are deployed is not verified. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Decide (Faiz):** go-ahead to build the identity slice (Map decisions D1, D4, D7 and smaller calls approved 2026-10-09) (page-scene kit + header, Council chamber, Circle ring map, Map wins 1–4; about 3–4 days) and merge the agent-team PR plus the identity standard/checklist first; five decisions are listed in the [overview](game-visual-identity-2026-10-09.md), section 5
- [ ] **Review the Knife-edge result (Faiz):** merged as #87 (git log checked 2026-10-09), still never seen in a browser; after deploy click a stock tower on Fortress: the Walls block lists the distance to the next tier and a tower within 10% of a weaker line shows a thin crack ([write-up](knife-edge-a1-2026-10-09.md))
- [ ] **Review the Long Memory result (Faiz):** open Fortress → Chronicle; any day since 2026-10-07 the worker was off should appear under "What the record cannot show" ([write-up](long-memory-b1-2026-10-09.md))
- [ ] **Decide (Faiz):** next mechanics slice from the team review: C1 Siege back-test, D1 Plain lens or D2 Camera; and whether a knife-edge tower may appear on the Council agenda
- [ ] **Re-score identity with screenshots:** the page scores are inferred from code, not seen in a browser

## Recent Blockers / Open Questions

- **Pareto Bank FY2025:** the `.xhtml` is untagged; re-attach the report so Claude can prepare the FY2025 + FY2024 CSV ([doc](pareto-gigante-and-fund-constituents-2026-10-04.md))
- **Siege benchmark:** the Siege Simulator measures against OSEBX only; a global ETF such as XDEF is understated by it. Decide whether to add a global benchmark option ([doc](siege-instrument-sensitivity-2026-10-07.md))
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi) cannot rank with an owner-earnings DCF; method undecided
- **Possible price/split data errors:** Equinor stored price 41.95 USD; Kongsberg 5:1 split not restated ([diagnosis](valuation-data-diagnosis-2026-10-06.md))
- **Holding currency:** whether any holding was saved with a wrong currency is unchecked; if the Holdings column shows USD/EUR for a NOK holding, the CSV "Valuta" import is the cause
- **Housekeeping decisions:** remove 4 unused manual snapshot/position endpoints; drop the legacy analysis tables (empty since the wipe; CLAUDE.md says leave them until Faiz asks)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Manual:** the claude.ai project instructions still hold the older, shorter progress rules; paste the new ones in by hand

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (full 2026-10-07 snapshot: needs, known issues, roadmap, feature index and the dated change history, verbatim). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/` and are linked above.
