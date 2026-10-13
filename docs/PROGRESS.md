# Aladdin — Progress

**Last updated:** 2026-10-13 (design plan closed: Sprint 7 merged as #131, the last three backdrops merged as #132). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Trust slice: C1 Siege back-test next.** The design plan is closed: every sprint and picture is merged (#131, #132). Decided by Faiz 2026-10-13: the art default stays opt-in, the phone Fortress keeps its sideways scroll, no more feature contest until C1 is done, and a knife-edge tower stays off the Council agenda. Plans: [design-remaining-objects-2026-10-13.md](game/design-remaining-objects-2026-10-13.md), [design-master-sprint-plan-2026-10-11.md](game/design-master-sprint-plan-2026-10-11.md).

State: `main` is at `00ff4e4` (#132 merged by Faiz 2026-10-13; #131 redeployed per Faiz; the live site answers but Claude could not confirm which build it serves); masters live in git-ignored `art-masters/`. Repo migration head `t1f2a3b4c5d6`. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Look at the Council banner on the live site (Faiz):** the darkest of the five backdrops under the wash; Game mode on, open Council
- [ ] **Run the live browser specs (Claude):** `SMOKE_FRONTEND_URL`, `SMOKE_API_URL`, then `npm run smoke` and `npx playwright test e2e/game-pages.spec.ts` (both passed only against a local demo stack)
- [ ] **C1 Siege back-test (Claude):** with the `siege_scenarios_v3` fix so the unmodelled share shows in the headline (finding 3 of [the team review](game/game-mode-team-review-2026-10-09.md)); new versioned file, no migration
- [ ] **D1 Plain lens, then D2 Camera (Claude):** trust and first-glance legibility, after C1

## Recent Blockers / Open Questions

- **Pareto Bank FY2025:** the `.xhtml` is untagged; re-attach the report so Claude can prepare the FY2025 + FY2024 CSV ([doc](ingestion/pareto-gigante-and-fund-constituents-2026-10-04.md))
- **Siege benchmark:** the Siege Simulator measures against OSEBX only; a global ETF such as XDEF is understated by it. Decide whether to add a global benchmark option ([doc](game/siege-instrument-sensitivity-2026-10-07.md))
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi) cannot rank with an owner-earnings DCF; method undecided
- **Possible price/split data errors:** Equinor stored price 41.95 USD; Kongsberg 5:1 split not restated ([diagnosis](valuation/valuation-data-diagnosis-2026-10-06.md))
- **Holding currency:** whether any holding was saved with a wrong currency is unchecked; if the Holdings column shows USD/EUR for a NOK holding, the CSV "Valuta" import is the cause
- **Housekeeping decisions:** remove 4 unused manual snapshot/position endpoints; drop the legacy analysis tables (empty since the wipe; CLAUDE.md says leave them until Faiz asks)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Fortress scene cost (Sprint 7, merged #131):** cut Fortress blocking time (lab, demo data, 4x CPU) from 130-160 ms to 30-50 ms and the score from 87-89 to 88-91; the rest is waiting for the page chunk and the data to arrive one after the other (largest paint about 3 s on simulated slow 4G). Not measured on a real phone or the live site
- **Backend mypy:** 169 errors, not in CI; proposal (report-only job, stubs for pandas, openpyxl, fitz, yfinance, boto3, apscheduler) still open
- **Not re-checked in the hardening sprint:** the Dashboard macro chart showing only the original six series; ECON-007 (regime-aware risk bands) is out of scope


## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-13 review tasks closed by Faiz, 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
