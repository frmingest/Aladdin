# Aladdin — Progress

**Last updated:** 2026-10-20 (The Printer planned; plan only). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**The Printer (new Game-mode room, plan only, nothing built):** a Royal Mint with 13 central-bank levers and a STAMP button; the effect on your holdings shows as ranges with confidence tags. Kingdom Mint won a three-team design contest; sprints P1 to P5 and the Stitch picture list are in the [plan](game/the-printer-sprint-plan-2026-10-20.md).

**Circle page removed from Game mode (PR `feature/remove-circle-page`, not merged, not deployed, not seen in a browser).** Faiz said it did not fit the design. The page, its tab, its three `/game/competence` endpoints, the competence service and model, and the ring-map components are gone, with their tests and the two Circle-only docs. The Map's "Circle marked" check went with it, so the survey is now four facts (`survey-v2`). Stitch pictures and the `competence_marks` table stay. Write-up: [remove-circle-page-2026-10-19.md](game/remove-circle-page-2026-10-19.md).

State: `main` is at `4d0ce8b` (#185). **No PR was open on 2026-10-19** (GitHub API); everything listed in earlier versions of this file as "not merged" has merged ([archive](archive/progress-archive.md)). Repo migration head `x1f2a3b4c5d6` (the unused `winter_orders`). Deploy not checked; say if Railway has redeployed. Supabase is retired (decision 2026-10-14): database is Railway Postgres, files are on Cloudflare R2. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Records shelf, after the next deploy (PR `fix/records-uniform-books`):** on a wide screen all books must be exactly the same height (long names used to stretch their book)
- [ ] **Review and merge the Map scene-dive PR (`feature/map-zoom-into-scene`, Faiz).** Written and tested in a clean clone, not yet deployed; after deploy press a gold, defence, energy, food and bank holding on the Map and check the dive on desktop and phone. [Doc](game/map-scene-dive-2026-10-19.md)
- [ ] **Review and merge the Circle removal PR (Faiz).** After deploy, open the Map: each tower should show four fog patches, and `/fortress/circle` is gone (an old bookmark shows an empty page). [Doc](game/remove-circle-page-2026-10-19.md)
- [ ] **After the latest deploy, look at Game mode on desktop and phone:** Records (one large book per record, long names fit the cover), Map (picture fills the box, fog patches readable on each sector picture), Siege Simulator (towers backdrops follow the slider, opens at 5%), Fortress "Walls on the rise", Market Street (half-size stalls: are the names still readable?). Docs: [records](game/records-hall-polish-2026-10-17.md), [map](game/map-image-prototype-2026-10-15.md), [siege](game/siege-towers-backdrops-2026-10-17.md), [walls](game/walls-on-the-rise-2026-10-18.md), [market](game/market-street-redesign-2026-10-17.md)
- [ ] **After #150 is deployed:** Refresh Margin of safety, open "Can't be ranked yet" then "Why" on Vend Marketplaces, Salmon Evolution and Vår Energi and sanity-check the owner-earnings figure (if wrong, check share count and price currency first). [Doc](valuation/loss-making-price-assumes-2026-10-14.md)
- [ ] **The Printer (Faiz):** questions answered 2026-10-20; **still to generate in Stitch:** the 7 Printer MUST pictures (press, brass lever, STAMP button, coin pile, single coin, Mint Master bust, Mint crest), a barometer picture without text and a larger copy of the map picture ([doc](game/game-art-dde-2026-10-16.md)). Sprint P1 (numbers first, no art) needs none of them and is next for Claude
- [ ] **Next backend change:** clear the Supabase leftovers (`backend/.env.example`, the `config/database.py` docstring) and commit the Supabase-to-Railway runbook that only exists in the local checkout ([list](architecture.md#11-known-gaps-and-loose-ends))

## Recent Blockers / Open Questions

- **Kongsberg P/S jump at FY2024:** a data question, not a task (needs the stored revenue and net income for FY2023-25); "Multiples over time" likely pairs one recent price with every year (from the code, not checked live) ([doc](valuation/kongsberg-multiples-display-2026-10-14.md))
- **Hit rate (C2):** the analyst half stays "too few so far" for months and counts every run, so repeat runs on one holding weigh more
- **Legacy tables stay until Faiz asks (CLAUDE.md):** `portfolio_risk_snapshots` and `llm_usage_events` still have foreign keys into them, so they cannot just be dropped
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Backend mypy:** 166 findings (measured 2026-10-14); the report-only job shows them, and it becomes blocking only at zero
- **Not re-checked:** the Dashboard macro chart showing only the original six series; ECON-007 (regime-aware risk bands) is out of scope
- **Not re-checked in the housekeeping pass:** the live Railway services (docs describe them from the code and Faiz's decisions)

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-19 everything merged #155 to #185 (Map, Records, Siege, Market Street, removals of Blindfold/Winter/Hearth and Council/Chronicle), 2026-10-14 loss-making view, endpoints and mypy merged, Siege World merged and checked live, open items closed by Faiz, C2 hit rate, D2 Camera, Pareto Bank and D1 Plain lens and Prompt log, 2026-10-13 C1 Siege back-test and design plan, 2026-10-12 Design Master Sprints, 2026-10-11 design passes, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
