# Aladdin — Progress

**Last updated:** 2026-10-12 (game-mode master toggle and map pass). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Hardening sprint is under way (2026-10-12), before any new graphics.** Branch `hardening-sprint` (cut from `feature/design-sprint-11-circle`, tagged `pre-hardening`); merge order Sprint 9, Sprint 11, hardening. Baseline: backend 1797 tests pass (2 local-`.env` failures fixed), ruff and tsc clean, lint 0 errors, vitest 654 of 655 (the one failure is local-only art masters), build OK. Added: test isolation from `backend/.env`, `demo.py` type imports, `e2e/game-pages.spec.ts`, [docs/reference/GRAPHICS_GUIDELINES.md](reference/GRAPHICS_GUIDELINES.md). Not yet done: error and empty states, LLM-failure messages, upload edge cases, Lighthouse, visual baselines. Results: [docs/sprints/hardening-sprint-2026-10-12.md](sprints/hardening-sprint-2026-10-12.md). Design Master Sprint 9 (#115) and Sprint 14 Siege art (#117, #118) are merged to `main`; Sprint 11, the hardening sprint and the game-mode master toggle / art pass (#116, #119, #120) are merged only into branches below `main` and reach `main` through PR #121; the rest of the design sprints are merged on `main` (head `32be2dd` on 2026-10-11, deploy not verified). Plan: [docs/game/design-master-sprint-plan-2026-10-11.md](game/design-master-sprint-plan-2026-10-11.md).

State: local checkout `E:\Aladdin`; masters live in git-ignored `art-masters/`. Repo migration head `t1f2a3b4c5d6`. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review and merge the docs reorganization PR (Faiz):** `docs/` regrouped into topic folders with an index at `docs/README.md`; all references updated; written, not merged. Untracked clutter left alone for you to keep or delete: `docs/zioa0Vh0`, `docs/drawing-code-export*`, `docs/game-identity-2026-10-09/`, `sprint29.patch`, `.s5tmp/`, `.sync-backup-2026-10-11/`, root `game-mode-noise-audit-2026-10-07.local-copy.md`
- [ ] **Review the game-mode master toggle and map pass (Faiz):** merged into `hardening-sprint` (#120), reaching `main` via PR #121, written, not merged, not deployed. The top Game mode switch now also turns the pictures on (Settings "Object art" card and every "Plain view" button removed); resolution scaling (root font 16px up to 1920 wide, 21px at 2560, 32px at 3840); map taller, province names painted on the ground (IM Fell English SC), holding names cut to 15 characters, bluer sea. New pictures (packed with `scripts/art`, 2098 KB of the 2800 KB budget): the stocked vault on the Fortress Vault card (only for a stocked or deep vault), the two advisers each sitting on a chair in the Council chamber, and the new main building with smaller booths in the Fortress market square
- [ ] **Review the map name and corner fix (Faiz):** PR `fix/map-labels-and-corners`, written, not merged, not deployed. Sector names on the Map tab now stay fully on land (shrinking from 17 to 12 before crossing a coast or border); the brass corner pieces scale with the map width. Look at Map with Game mode on at laptop and at 2560 wide
- [ ] **Finish the hardening sprint (Claude):** error and empty states, LLM-failure messages, upload edge cases, Lighthouse and phone-width pass; then open the PR
- [ ] **Merge PR #121 (Faiz):** brings Sprint 11, hardening and the master toggle / art pass to `main`; a merge is a production deploy
- [ ] **Run `npm ci` in `frontend/` on Windows (Faiz):** the local `node_modules` lacks `@types/node`, so a local `tsc` shows false errors
- [ ] **Run the game-pages smoke test on the live site:** a manual check of all 8 pages at 375 px (game mode off and on) found no problems; the Playwright spec itself, desktop width and Object art are still unchecked (`SMOKE_FRONTEND_URL`, `SMOKE_API_URL`, then `npm run smoke`)
- [ ] **Review the Siege Simulator art on real data (Faiz):** Game mode on, `/fortress/siege`: does the fire read as damage at 10%, 30% and 50% falls (and still on a phone, and with reduced motion on); is the camp right for calm, storm and siege; towers still readable at 18 holdings and at phone width
- [ ] **Review the Sprint 1 to 4 art on real data (Faiz):** Game mode on. Fortress in calm, gathering and besieged: a fresh, a weathered and an overgrown tower, an outpost, granary, gold store, the Great Keep with its verdict flag, shacks, the siege camp, causeways, pines and the raven. Cartographer's table: each settlement's picture and fog patches, the keep and its commission flag, pines, rocks, ships, the port, island and palms; phone width
- [ ] **Review Sprints 5 and 6 on real data (Faiz):** Sprint 6: Fortress wall and corner bastions (both rows, besieged weather), terraces, the Genie, Cartographer mountains/hills/serpent/compass, Council busts, Sal cheer, store shopkeeper faces. Sprint 5: Game mode on; Marketplace street (stall picture and tone edge on each plate, phone width), Talk to Sal and Hype Booth (busts)
- [ ] **Review the room art on real data (Faiz):** Game mode on. Council (table, advisors on chairs, seals: does the broken seal still read as a warning at 33 px, candles), Records (caskets), Chronicle (strata blocks, sconce), Map table (frame)
- [ ] **Generate what is still missing in Stitch (Faiz, optional):** a smiling shopkeeper (the \"ready\" face), curtain-wall variants if the single tile looks repetitive; see Part 8 of the plan
- [ ] **Generate the rest of the room set in Stitch (Faiz, optional):** the five room crests (the tower medallion that arrived fits the Fortress, not a room) and a second advisor chair in a different shape (the high-backed one arrived as a lectern); see the plan, "Still missing for the rooms"
- [ ] **Look at the merged game PRs on real data (Faiz):** Records, Circle, Map, Night Watch seal, Chronicle spine, Marketplace plates and Phase A (Game mode on); dark and light, phone, reduced motion
- [ ] **Check Knife-edge and Long Memory after deploy (Faiz):** click a stock tower on Fortress (distance to the next tier, thin crack within 10%); Chronicle shows days the worker was off under "What the record cannot show" ([knife-edge](game/knife-edge-a1-2026-10-09.md), [long memory](game/long-memory-b1-2026-10-09.md))
- [ ] **Decide (Faiz):** next mechanics slice (C1 Siege back-test, D1 Plain lens or D2 Camera) and whether a knife-edge tower may appear on the Council agenda
- [ ] **Re-score identity with screenshots:** page scores are inferred from code, not seen in a browser (first step of Sprint 7)

## Recent Blockers / Open Questions

- **Pareto Bank FY2025:** the `.xhtml` is untagged; re-attach the report so Claude can prepare the FY2025 + FY2024 CSV ([doc](ingestion/pareto-gigante-and-fund-constituents-2026-10-04.md))
- **Siege benchmark:** the Siege Simulator measures against OSEBX only; a global ETF such as XDEF is understated by it. Decide whether to add a global benchmark option ([doc](game/siege-instrument-sensitivity-2026-10-07.md))
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi) cannot rank with an owner-earnings DCF; method undecided
- **Possible price/split data errors:** Equinor stored price 41.95 USD; Kongsberg 5:1 split not restated ([diagnosis](valuation/valuation-data-diagnosis-2026-10-06.md))
- **Holding currency:** whether any holding was saved with a wrong currency is unchecked; if the Holdings column shows USD/EUR for a NOK holding, the CSV "Valuta" import is the cause
- **Housekeeping decisions:** remove 4 unused manual snapshot/position endpoints; drop the legacy analysis tables (empty since the wipe; CLAUDE.md says leave them until Faiz asks)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
