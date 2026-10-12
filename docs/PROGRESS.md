# Aladdin — Progress

**Last updated:** 2026-10-12 (game-mode master toggle and map pass). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Hardening sprint is under way (2026-10-12), before any new graphics.** Branch `hardening-sprint` (cut from `feature/design-sprint-11-circle`, tagged `pre-hardening`); merge order Sprint 9, Sprint 11, hardening. Baseline: backend 1797 tests pass (2 local-`.env` failures fixed), ruff and tsc clean, lint 0 errors, vitest 654 of 655 (the one failure is local-only art masters), build OK. Added: test isolation from `backend/.env`, `demo.py` type imports, `e2e/game-pages.spec.ts`, [GRAPHICS_GUIDELINES.md](GRAPHICS_GUIDELINES.md). Not yet done: error and empty states, LLM-failure messages, upload edge cases, Lighthouse, visual baselines. Results: [hardening-sprint-2026-10-12.md](hardening-sprint-2026-10-12.md). Design Master Sprints 9 and 11 are written, not merged, not deployed; the rest of the design sprints are merged on `main` (head `32be2dd` on 2026-10-11, deploy not verified). Plan: [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md).

State: local checkout `E:\Aladdin`; masters live in git-ignored `art-masters/`. Repo migration head `t1f2a3b4c5d6`. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review the game-mode master toggle and map pass (Faiz):** branch `feature/game-master-toggle-map-art` (PR into `hardening-sprint`), written, not merged, not deployed. The top Game mode switch now also turns the pictures on (Settings "Object art" card and every "Plain view" button removed); resolution scaling (root font 16px up to 1920 wide, 21px at 2560, 32px at 3840); map taller, province names painted on the ground (IM Fell English SC), holding names cut to 15 characters, bluer sea. New pictures (packed with `scripts/art`, 2098 KB of the 2800 KB budget): the stocked vault on the Fortress Vault card (only for a stocked or deep vault), the two advisers each sitting on a chair in the Council chamber, and the new main building with smaller booths in the Fortress market square
- [ ] **Finish the hardening sprint (Claude):** error and empty states, LLM-failure messages, upload edge cases, Lighthouse and phone-width pass; then open the PR
- [ ] **Merge in order (Faiz):** Sprint 9, Sprint 11, then the hardening PR
- [ ] **Run `npm ci` in `frontend/` on Windows (Faiz):** the local `node_modules` lacks `@types/node`, so a local `tsc` shows false errors
- [x] **Art budget raised (2026-10-12):** limit 2000 to 2800 KB in `artAssets.test.ts` (set was at 1996 KB); next step is a phone check of the heaviest page with Lighthouse
- [ ] **Run the game-pages smoke test on the live site:** a manual check of all 8 pages at 375 px (game mode off and on) found no problems; the Playwright spec itself, desktop width and Object art are still unchecked (`SMOKE_FRONTEND_URL`, `SMOKE_API_URL`, then `npm run smoke`)
- [ ] **Review the art on real data (Faiz):** Game mode on; Fortress (all weathers), Cartographer, Marketplace, Council, Records, Chronicle, Circle; phone width, dark and light, reduced motion. Optional Stitch gaps: smiling shopkeeper, curtain-wall variants, five room crests, second advisor chair (plan, Part 8)
- [ ] **Decide the next mechanics slice (Faiz):** C1 Siege back-test, D1 Plain lens or D2 Camera; and whether a knife-edge tower may appear on the Council agenda

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
