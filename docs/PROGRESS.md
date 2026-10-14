# Aladdin — Progress

**Last updated:** 2026-10-14 (price and split data fixes written, PR open; B2 Then and Now and Game-mode-on-by-default merged as #142 and #140; hit-rate view approved with limits). Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

**Equinor beta fix (#144) is merged, so deployed once Railway finished (Faiz to confirm on the live page).** Yahoo's beta for Equinor was -0.66; assumptions v5 rejects betas outside 0 to 3, uses the default 1.0 and says so on the page ([doc](valuation/equinor-beta-fix-2026-10-14.md)). The Kongsberg display fix (#145) was merged into the Equinor branch after #144 had already merged, so it never reached `main`; it is re-opened as a new PR against `main` (written, not merged, not deployed). The price/split fixes (#143) are live (Kongsberg restated x5).

State: `main` is at `3f54fa5` (#144 merged). Repo migration head `v1d2e3f4a5b6` (stock_splits); the beta fix adds none. Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Merge the new Kongsberg display PR into `main` (Faiz):** #145 landed on the Equinor branch, not `main`. Then press Refresh on Equinor: the amber note names the rejected beta and the discount rate becomes about 9.7%
- [ ] **Compare the Equinor price (Faiz):** stored 402.80 NOK; check it against the live Oslo quote
- [ ] **Run the currency check (Faiz) after deploy:** open `/system/holding-currency-check` on the backend; an empty list means all holdings match
- [ ] **Confirm the prompt-log migration ran (Faiz):** #137 added `u1a2b3c4d5e6`; merging deploys, so check System status loads the Prompt log card
- [ ] **Then, in order (Claude, decided 2026-10-14):** global benchmark option in the Siege Simulator; "can't be ranked yet" plus a no-score "what the price assumes" view for loss-making companies; remove the 4 unused endpoints; report-only mypy job
- [ ] **Check B2 and the default-on Game mode on the live site (Faiz) after deploy:** open a record, press Then and now (steps in the [doc](game/then-and-now-b2-2026-10-14.md)); no browser check was done by Claude
- [ ] **Next design slice (Faiz to pick):** B2 was the last item of the original order ([team review](game/game-mode-team-review-2026-10-09.md)); C2 hit rate waits for enough data (see Blockers)

## Recent Blockers / Open Questions

- **Hit rate (C2), decided 2026-10-14 (Faiz left it to Claude): yes, with limits.** Shown only once there are enough decisions (opens at 8 with a 6- or 12-month outcome), always with the count beside it and a "too few so far" state before that; the Oracle's range versus later price counts the same way; no score, streak or reward, and it never changes a verdict or a tower. This amends the Sprint 25 "no hit rate" rule. Needs the small `forecasts` table so the clock starts now, which is a database change to approve when the slice starts
- **Siege benchmark:** decided to add a global option (stand-in index fund, labelled as such on screen); OSEBX stays for Norwegian stocks ([doc](game/siege-instrument-sensitivity-2026-10-07.md))
- **Loss-making valuation** (Vend Marketplaces, Salmon Evolution, Vår Energi): decided not to force a score; show "can't be ranked yet" with the reason, plus what the price assumes, as information only
- **Price/split data (live per screenshot, #143):** Equinor 41.95 USD is the NOK price converted (not a bug); Kongsberg 5:1 split is now restated in the multiples history once splits are stored; jump flag added ([doc](valuation/price-split-data-fixes-2026-10-14.md)). Other splits only appear after a price refresh
- **Kongsberg multiples (screenshots 2026-10-14):** EV/EBITDA reason fixed in `fix/kongsberg-multiples` (written, not deployed; the card now names the newest period and the real cause, no EBITDA). Still open: the P/S jump at FY2024 needs Faiz's stored revenue and net income for FY2023-25 ([doc](valuation/kongsberg-multiples-display-2026-10-14.md)); "Multiples over time" likely pairs one recent price with every year (from the code, not checked live)
- **Holding currency:** the check exists but has not been run on real data; if a NOK holding shows USD/EUR, the CSV "Valuta" import is the cause
- **Housekeeping:** decided to remove the 4 unused manual snapshot/position endpoints; the legacy analysis tables stay until Faiz asks (CLAUDE.md)
- **Known data gaps** (Kongsberg/Bouvet D&A, Salmon FY2020–21 scale, duplicate market observations, stale EUR rate, Risk and Performance cover 5 of 8 holdings): see [overview](valuation/data-gaps-overview-2026-10-03.md); fund yearly returns still to be typed in
- **Fortress scene cost (Sprint 7, merged #131):** cut Fortress blocking time (lab, demo data, 4x CPU) from 130-160 ms to 30-50 ms and the score from 87-89 to 88-91; the rest is waiting for the page chunk and the data to arrive one after the other (largest paint about 3 s on simulated slow 4G). Not measured on a real phone or the live site
- **Backend mypy:** 169 errors, not in CI; decided on a report-only job with stubs for pandas, openpyxl, fitz, yfinance, boto3, apscheduler
- **Not re-checked in the hardening sprint:** the Dashboard macro chart showing only the original six series; ECON-007 (regime-aware risk bands) is out of scope


## Archive Pointer

Completed milestones moved to [`/docs/archive/progress-archive.md`](archive/progress-archive.md) (newest first: 2026-10-14 Pareto Bank closed and D1 Plain lens and Prompt log, 2026-10-13 C1 Siege back-test and review tasks, 2026-10-13 design plan, 2026-10-13 review tasks closed by Faiz, 2026-10-12 Design Master Sprints 8, 10, 12, 13, 2026-10-11 Design Master Sprints 0 to 5, 2026-10-11 design passes and Phase A, 2026-10-09 review tasks, then the full 2026-10-07 snapshot). Older: [`archive/PROGRESS-full-2026-09-30.md`](archive/PROGRESS-full-2026-09-30.md). Per-topic write-ups live in `docs/<topic>/`; index at [`docs/README.md`](README.md).
