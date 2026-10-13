# Aladdin — Progress

**Last updated:** 2026-10-13 (Circle drag-to-place and Siege short rows built on a branch, not merged). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**The hardening sprint is finished and merged to `main` as PR #125 (deploy not verified); the next phase is the trust slice, starting with C1 Siege back-test. The Circle and Siege redesign is on its own branch first.** PRs #121 to #125 (Sprint 11, hardening baseline, master toggle and art pass, docs reorganization, map and Fortress fixes) are merged to `main`; deploy not verified. Results and what was left: [docs/sprints/hardening-sprint-2026-10-12.md](sprints/hardening-sprint-2026-10-12.md). Decided 2026-10-13: a knife-edge tower stays off the Council agenda for now (the agenda lists real gaps; a near-threshold flag would be noise at this data size). Plan for the art: [docs/game/design-master-sprint-plan-2026-10-11.md](game/design-master-sprint-plan-2026-10-11.md).

State: local checkout `E:\Aladdin` was 8 commits behind `main` on 2026-10-13 and is now on `feature/design-sprint-14-circle-and-siege`, branched from `main` at `500ea0e` (the hardening PR #125 is merged there); masters live in git-ignored `art-masters/`. Repo migration head `t1f2a3b4c5d6`. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review the Circle and Siege redesign (Faiz):** Circle: drag a sector marker onto Inside, On the edge or Outside and it saves on the drop (fog = clear, Undo offered); tap a marker for its note and a keyboard choice; no per-row buttons; sector names no longer collide. Siege: each tower is one short row, beta/fit/days and the stress case behind Details, with Rough guide and Differs from stress case badges. Not merged, not deployed, not tried by hand on a phone
- [ ] **Confirm the hardening deploy (Faiz):** PR #125 is merged, and a merge deploys. What it holds: friendly load errors with Try again on all 8 game pages, plain-language LLM failure reasons, upload filename guard, accessibility fixes (Lighthouse a11y 100 on the pages re-run), Night Watch no longer pushes the scene down. A merge is a production deploy
- [ ] **After the deploy, run the browser specs on the live site (Faiz or Claude):** `SMOKE_FRONTEND_URL`, `SMOKE_API_URL`, then `npm run smoke` and `npx playwright test e2e/game-pages.spec.ts`. Both game specs passed only against a local demo stack (33 of 33 and 16 of 16), never against the live site
- [ ] **C1 Siege back-test (Claude):** with the `siege_scenarios_v3` fix so the unmodelled share shows in the headline (finding 3 of [the team review](game/game-mode-team-review-2026-10-09.md)); read the C1 spec first, new versioned file, no migration
- [ ] **D1 Plain lens, then D2 Camera (Claude):** trust and first-glance legibility, after C1
- [ ] **Sprint 7 close-out (Claude):** re-score identity with screenshots (scores are inferred from code), phone performance at 4x throttle on real data, colour-blind pass, update the visual-identity standard

## Recent Blockers / Open Questions

- **Pareto Bank FY2025:** the `.xhtml` is untagged; re-attach the report so Claude can prepare the FY2025 + FY2024 CSV ([doc](ingestion/pareto-gigante-and-fund-constituents-2026-10-04.md))
- **Siege benchmark:** the Siege Simulator measures against OSEBX only; a global ETF such as XDEF is understated by it. Decide whether to add a global benchmark option ([doc](game/siege-instrument-sensitivity-2026-10-07.md))
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi) cannot rank with an owner-earnings DCF; method undecided
- **Possible price/split data errors:** Equinor stored price 41.95 USD; Kongsberg 5:1 split not restated ([diagnosis](valuation/valuation-data-diagnosis-2026-10-06.md))
- **Holding currency:** whether any holding was saved with a wrong currency is unchecked; if the Holdings column shows USD/EUR for a NOK holding, the CSV "Valuta" import is the cause
- **Housekeeping decisions:** remove 4 unused manual snapshot/position endpoints; drop the legacy analysis tables (empty since the wipe; CLAUDE.md says leave them until Faiz asks)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Fortress scene cost:** Lighthouse mobile on demo data scores Fortress performance 73 to 82 (total blocking time 140 to 280 ms, React drawing the 1,400-line scene); the other seven pages score 95 to 100. Not fixed; look at it before the default art is judged on a phone
- **Backend mypy:** 169 errors, not in CI; proposal (report-only job, stubs for pandas, openpyxl, fitz, yfinance, boto3, apscheduler) still open
- **Not re-checked in the hardening sprint:** the Dashboard macro chart showing only the original six series; ECON-007 (regime-aware risk bands) is out of scope


## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-13 review tasks closed by Faiz, 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
