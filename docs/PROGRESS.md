# Aladdin — Progress

**Last updated:** 2026-10-09. Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

Phase 11, the Buffett/Munger rebuild, is in a stable, merged state. Game mode sprint plan v2 is approved ([plan](game-mode-sprint-plan-v2-2026-10-08.md)); the scroll reader (G28), the Scrolls library (G30), the raven *Read the report* button (G31, #77) and own-year fact ownership (#76) are merged on `main`. Sprint 28 (survey level, Cartographer's table at Fortress → Map, Codex, time capsules; [write-up](fog-of-war-sprint28-2026-10-08.md)) is merged (#79); it and PR #80 (walkthrough polish items 3–6) were looked at and judged OK by Faiz on 2026-10-09. The art pass (#85: raven position bug fixed, visible siege army, weight-scaled tower height, softer grain, moat ripples, terrace life; [write-up](fortress-art-pass-2026-10-09.md)) and the integrity fixes (#84: the sky cannot read calm on a partial book via game mapping v2, stress shocks are never gains, back-dated journal entries record the verdict in force then; [write-up](game-integrity-fixes-2026-10-09.md)) are merged and were reviewed and confirmed OK by Faiz on 2026-10-09 (with the deploy check). **In flight: `feature/long-memory-b1`** (B1 Long Memory from the [team review](game-mode-team-review-2026-10-09.md): nightly frames thinned by `retention_v1` instead of deleted, Chronicle names days the worker recorded nothing; [write-up](long-memory-b1-2026-10-09.md); written and tested, **not merged, not deployed**). Also merged: `feature/ravens-recent-and-game-feel` (ravens lead with the last 48 hours, older ones folded per company with a Portfolio/Watchlist filter; Sprint 29 first slice: scene animation pauses when the tab is hidden or the scene is off screen, arrow keys move between towers; [write-up](sprint29-ravens-recent-and-feel-2026-10-08.md); merged (#81) and judged OK by Faiz on 2026-10-09). **The G1–G20 walkthrough is done: all 20 gates confirmed on the live app** ([results](game-mode-walkthrough-g1-g20-2026-10-08.md)). Next in the team-review order: A1 Knife-edge, C1 Siege back-test, D1 Plain lens, D2 Camera, B2 Then and Now. Also: the rest of Sprint 29 (G40 first-run tour, G38 sounds), the rest of Sprint 26a (game pages in the smoke test, word budgets).

State (checked against git 2026-10-09): `main` = `528021d` (#85). Repo migration head `t1f2a3b4c5d6`; migration head **confirmed on Supabase** as `t1f2a3b4c5d6` (Faiz, 2026-10-08), and he ran game mode G1–G20 on the live frontend that day. Faiz confirmed on 2026-10-09 that the Railway deploy of `main` and the review/first-look tasks are done and OK. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Review the Long Memory PR (Faiz):** after #86 deploys open Fortress → Chronicle; any day since 2026-10-07 the worker was off should appear under "What the record cannot show" ([write-up](long-memory-b1-2026-10-09.md))

Earlier tasks (art-pass, integrity, #80, deploy check, quarterly reports, PC pull, first looks, non-equity figures, valuation v4, ravens, credentials, docs PR) were all checked OK by Faiz on 2026-10-09 and are in the [archive](archive/progress-archive.md).

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
