# Aladdin — Progress

**Last updated:** 2026-10-08. Rolling log: active status only, under 100 lines (rules in [CLAUDE.md](../CLAUDE.md), "Progress file rules"). Architecture: [architecture.md](architecture.md).

## Current Objective

Phase 11, the Buffett/Munger rebuild, is in a stable, merged state. Game mode sprint plan v2 is approved ([plan](game-mode-sprint-plan-v2-2026-10-08.md)); #72 (scroll reader) is merged. **In flight: PR #73** (quarterly-wording cleanup) **and one PR, `feature/scrolls-library-g30`** (G30 Scrolls library: the Documents tab becomes "Scrolls", three shelves, sealed scrolls; annual XHTML reports keep the side-by-side reader). Written and tested, **not merged, not deployed, seen only on headless Chromium test pages, never on real documents.** **Also in flight: PR #76** (own-year fact ownership: each fiscal year is owned by the report that reports it; written and tested, not merged, not deployed; [doc](own-year-fact-ownership-2026-10-08.md)). Next: your walkthrough (Sprint 26a), then raven-to-scroll (G31) and Sprint 28.

State (checked against git 2026-10-08): `main` = `3304026` (#75). Repo migration head `t1f2a3b4c5d6`; last head **confirmed on Supabase** was `r1d9e0f1a2b3` (2026-10-05). **Deploy of everything since is not verified** ("merged, not checked live"). Live URLs: frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`.

## Active Tasks

- [ ] **Deploy check (Faiz):** confirm Railway deployed `main`; run `select version_num from alembic_version;` in Supabase, expect `t1f2a3b4c5d6` (adds `s1e0f1a2b3c4` tag rules and `t1f2a3b4c5d6` instrument facts)
- [ ] **Quarterly reports (Faiz):** the probe showed Newsweb category 1002 already carries Q1/Q2/Q3 results, so re-press *Fetch reports* on each Oslo holding to pull any missing quarterly PDFs (already-fetched ones are skipped); no setting needed
- [ ] **PC (Faiz):** `git pull` in `E:\Aladdin`, restart backend and worker (needed for #51 and #66 worker fixes). **Siege PR (#71) is merged:** wait for More, System, System status to show "Siege Simulator price history" has run, then reload `/fortress/siege` ([doc](siege-instrument-sensitivity-2026-10-07.md))
- [ ] **First look at merged, never-seen work:** holding currency Edit and `≈ NOK` ([#68](currency-edit-and-nok-equivalent-2026-10-07.md)), Background jobs card ([#65](background-jobs-status-2026-10-07.md)), tag review inbox ([#60–62](tag-review-inbox-2026-10-07.md)), game-mode noise pass ([#64](game-mode-noise-audit-2026-10-07.md)), game mode G1–G20 walkthrough ([doc](game-mode-fortress-2026-10-01.md))
- [ ] **Enter figures for the 3 non-equity holdings** (Alfred Berg Nordic High Yield II R, Heimdal Høyrente Pluss B, Xetra-Gold), Macro → Refresh data, run the three analyses ([#67](all-instrument-analysis-2026-10-07.md))
- [ ] **Re-check valuation v4** after deploy: Margin of safety → Refresh; Aker Solutions, Equinor, Telenor, Sparebanken Øst, Storebrand ([doc](valuation-v4-normalised-base-certificates-2026-10-07.md)); also re-fetch reports for Aker BP, Orkla, Salmon Evolution, Subsea 7; **after #76 deploys: Tag review → Re-extract each company with several annual reports** (fixes which report holds which year; then reopen the DNO FY2021 report)
- [ ] **Rotate credentials pasted into chat** (Supabase DB password and storage keys, Google AI Studio, Mistral, FRED; the FRED key is also in the worker log)
- [ ] **Decide the next build:** Sprint 21 (rate sensitivity, PDF report), Sprint 22 (alerts, Newsweb flags), or a method for loss-making companies

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
