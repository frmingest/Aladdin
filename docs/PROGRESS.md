# Aladdin — Progress

**Last updated:** 2026-11-01. Rolling log: active status only, under 100 lines, at most 7 tasks (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**3D courtyard Standing 4, "The Ledger" (level 5, the fifth and last torch): PR `feature/game3d-standing-4-ledger`, written and tested, not merged, not deployed.** The torch burns while no 6- or 12-month look-back in your journal is overdue; seen only in a headless browser on a test database ([write-up](game/game3d-standing-4-ledger-2026-11-01.md)).

State: `main` at `32377f2` (#237); no other PR open (GitHub API, 2026-11-01). Everything up to #237 is merged ([archive](archive/progress-archive.md)); deploy not checked, say if Railway has redeployed. Database is Railway Postgres, files on Cloudflare R2 (Supabase retired 2026-10-14). Migration head `z1b2c3d4e5f6`. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Standing 4, The Ledger (Faiz): review and merge the PR; after deploy** open `/game3d`, press Q. Your journal is young, so expect "Too soon to look back: the first opens in N days" and four torches at most (three if the night watch has not run). Roll back with `ACTIVE_STANDING_VERSION=v2` in Railway
- [ ] **3D courtyard look-over after the deploy (Faiz, all merged #198 to #237):** keep and corner towers, wider horseshoe of towers, marketplace corner, nameplates over the doors, a tower's library (E at the little door, E at a shelf, E at the table opens the latest report), the writing desk, the Storm Drill post in the south-west (the deploy runs migration `z1b2c3d4e5f6`), and Q for the Standing; press P for 60 fps. Docs: [library](game/game3d-tower-library-2026-11-01.md), [drill](game/game3d-storm-drill-2026-11-01.md), [nameplates](game/game3d-tower-nameplates-2026-11-01.md), [Standing 3](game/game3d-standing-3-look-2026-10-31.md)
- [ ] **Flat Game mode look-over after the deploy (Faiz, merged #187 to #197):** Fortress section art (Spread skyline, Reports pictures, Study lamp), Map scene dive (gold, defence, energy, food, bank), Records same-size books, Circle page gone (four fog patches per tower), on desktop and phone ([section art](game/fortress-section-art-2026-10-29.md), [map](game/map-scene-dive-2026-10-19.md))
- [ ] **Newsweb watch (merged #195):** open System status, check the "Newsweb announcements watch" job turns green, then `/sources/newsweb/new`. Next: a small frontend (unread badge, acknowledge button)
- [ ] **Jæren Sparebank (merged #194):** press *Fetch all reports* on JAREN.OL; the 2024 and 2025 annual reports should move to Annual reports. Figures still need the tagged ESEF `.xhtml` or a statement CSV; set name and sector (Financials)
- [ ] **The Printer (Faiz): decide how to get amounts** (measured sensitivities as P1.5, or direction only). The 12 Stitch pictures in `frontend/public/art/printer` are not packed or wired; still to generate: a barometer without text and a larger map ([plan](game/the-printer-sprint-plan-2026-10-20.md))
- [ ] **Next backend change:** clear the Supabase leftovers (`backend/.env.example`, the `config/database.py` docstring) and commit the Supabase-to-Railway runbook ([list](architecture.md#11-known-gaps-and-loose-ends))

## Recent Blockers / Open Questions

- **3D ideas not built:** Storm Drill camp following the siege level, an Oracle line pointing at the drill post, siege tower and ram; deeper library shelves; calibration and track-record lines in 3D; on a phone the green "Done!" pill in the Quest log wraps into a fat oval
- **Owner-earnings check (#150):** Refresh Margin of safety, "Can't be ranked yet" then "Why" on Vend, Salmon Evolution and Vår Energi ([doc](valuation/loss-making-price-assumes-2026-10-14.md))
- **Kongsberg P/S jump at FY2024:** a data question, not a task ([doc](valuation/kongsberg-multiples-display-2026-10-14.md))
- **Hit rate (C2):** the analyst half stays "too few so far" for months and counts repeat runs on one holding more
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): [overview](valuation/data-gaps-overview-2026-10-03.md)
- **Legacy tables stay until Faiz asks** (CLAUDE.md); **backend mypy** 166 findings, report-only job

## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-11-01 everything merged #187 to #237, including the 3D courtyard and Standing levels 1 to 4; 2026-10-19 #155 to #186; then older snapshots). Oldest: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
