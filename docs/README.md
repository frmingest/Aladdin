# Aladdin docs index

Start here. Each doc keeps its original dated filename; only the folder changed (2026-10-12).
Find a doc by topic folder below, or `grep -ril <term> docs/`. Folder = topic, not date.

## Always-current (docs root)

- [PROGRESS.md](PROGRESS.md) — Current status, active tasks, blockers. Rolling log, under 100 lines.
- [architecture.md](architecture.md) — System diagram, analysis paths, deployment, background jobs, data model (ER diagram), game mode, frontend map, known gaps. Rewritten 2026-10-19.
- [buffett-munger-rebuild-sprint-plan-2026-09-21.md](buffett-munger-rebuild-sprint-plan-2026-09-21.md) — The active rebuild sprint plan and the analyst prompt ("the Brain").

## Topic folders

- **[reference/](reference/)** — Stable background: what is AI vs deterministic, tech overview, graphics rules, Ollama setup, data-source research.
- **[game/](game/)** — Game mode (Fortress): concept, sprint plans and reviews, visual identity, art passes, checklist.
- **[ingestion/](ingestion/)** — Getting data in: Newsweb/ESEF/XHTML filings, uploads, tag gaps, ETF holdings capture.
- **[valuation/](valuation/)** — Valuation and analysis numbers: DCF, ROIC/ROE, margin of safety, data gaps, fund look-through.
- **[llm-local/](llm-local/)** — Local LLM (Ollama), the worker and queue, evidence packets, LLM usage ledger.
- **[ops/](ops/)** — Running the app: hosting, auth gate, page-load, background jobs, audits, live checks.
- **[features/](features/)** — Feature and UI notes: dashboard, watchlist, thesis tracking, performance, reader, polish and noise audits.
- **[sprints/](sprints/)** — Cross-cutting sprint plans and the hardening sprint.
- **[archive/](archive/)** — Finished progress history. Move completed milestones here from PROGRESS.md.

### reference/

Stable background: what is AI vs deterministic, tech overview, graphics rules, Ollama setup, data-source research.

- [AI-VS-DETERMINISTIC.md](reference/AI-VS-DETERMINISTIC.md) — What is AI-generated and what is not
- [GRAPHICS_GUIDELINES.md](reference/GRAPHICS_GUIDELINES.md) — Graphics guidelines (written in the hardening sprint, 2026-10-12)
- [free-market-data-research-providers-2026-09-21.md](reference/free-market-data-research-providers-2026-09-21.md) — Free market-data & research provider sources (2026-09-21)
- [llm-and-technology-overview.md](reference/llm-and-technology-overview.md) — Aladdin: what we process, and with which technology
- [local-llm-ollama-setup.md](reference/local-llm-ollama-setup.md) — Local LLM setup — Ollama on the RTX 3060 12GB
- [primary-sources-sec-edgar-newsweb-2026-09-22.md](reference/primary-sources-sec-edgar-newsweb-2026-09-22.md) — Primary sources: SEC EDGAR + Oslo Børs Newsweb (2026-09-22)

### game/

Game mode (Fortress): concept, sprint plans and reviews, visual identity, art passes, checklist.

- [game3d-prototype-2026-10-30.md](game/game3d-prototype-2026-10-30.md) — 3D courtyard prototype (week 1): walkable walled courtyard at /game3d, WoW-style third-person controls, desktop only
- [game3d-towers-2026-10-30.md](game/game3d-towers-2026-10-30.md) — 3D courtyard (week 2): holdings stand as towers via stateToWorld(); weak looks weak, unknown stays fog; facts in a side panel
- [game3d-npcs-2026-10-30.md](game/game3d-npcs-2026-10-30.md) — 3D courtyard (week 3): the Oracle and the Partner to talk to (press E) and quest 1 "Unwritten Thesis", worked out from the journal
- [game3d-reckoning-2026-10-30.md](game/game3d-reckoning-2026-10-30.md) — 3D courtyard (week 4): quest 2 "Six-Month Reckoning", worked out from the journal's review-due flags; Oracle and Partner speak of it once every reason is written
- [game3d-billboards-2026-10-30.md](game/game3d-billboards-2026-10-30.md) — 3D courtyard (week 5 start): solid code-built models for hero, Oracle, Partner, fountain, lamps, board and perch (ink outline, Stitch palette) and a mountain backdrop
- [game3d-scenery-2026-10-31.md](game/game3d-scenery-2026-10-31.md) — 3D courtyard S6: KayKit torches, banners and camp clutter in one 187 KB GLB (written, not yet looked at in a browser)
- [game3d-horizon-2026-10-31.md](game/game3d-horizon-2026-10-31.md) — 3D courtyard S7: KayKit grove, boulders, foothills and mountains round the meadow in one 347 KB GLB, instanced; invisible edge at radius 74; deeper ground collider (written, not yet seen on a real GPU)
- [game3d-townsfolk-2026-10-31.md](game/game3d-townsfolk-2026-10-31.md) — 3D courtyard S8: guard and scout (KayKit Barbarian and Rogue, 0.5 MB each), the Oracle casts while talking, quest-1 cheer and confetti (real journal only, once per load)
- [game3d-kaykit-sprint-plan-2026-10-31.md](game/game3d-kaykit-sprint-plan-2026-10-31.md) — 3D courtyard (week 5 plan): free CC0 KayKit characters (rigged, animated) for hero, Oracle and Partner, sprints S0 to S5; plus S6 to S9 for scenery, horizon, townsfolk and bring-your-own packs (S6 to S9 plan only)
- [game3d-kaykit-models-2026-10-31.md](game/game3d-kaykit-models-2026-10-31.md) — 3D courtyard: free CC0 KayKit character models; S0 to S3 merged, S4 compression (fixed after it broke the scene) and S5 verify in PR
- [game3d-free-3d-packs-assessment-2026-10-31.md](game/game3d-free-3d-packs-assessment-2026-10-31.md) — which other free 3D packs fit Game mode (KayKit Hexagon/Dungeon verified on GitHub, Quaternius/Kenney/itch not reachable, Synty/Mixamo rejected)
- [game3d-progression-brainstorm-2026-10-31.md](game/game3d-progression-brainstorm-2026-10-31.md) — 3D courtyard: review against the app and a level 1 to 5 brainstorm; Faiz's decisions in section 9 (derived Standing, backend rules, no pennants)
- [game3d-standing-sprint-plan-2026-10-31.md](game/game3d-standing-sprint-plan-2026-10-31.md) — 3D courtyard next sprint "Standing 1": levels 1 to 3 as torches at the gate, `GET /game/standing`, empty-fortress first step (plan only)
- [game3d-standing-2026-10-31.md](game/game3d-standing-2026-10-31.md) — 3D courtyard Standing 1: levels 1 to 3 as torches on the road ahead and a Quest log card, `GET /game/standing`, Jæren as first named gap, Oracle's first step (written, tested, not merged)
- [game3d-standing-2-sprint-plan-2026-10-31.md](game/game3d-standing-2-sprint-plan-2026-10-31.md) — 3D courtyard next sprint "Standing 2": a writing desk by the keep door (write reason and wrong-if in the world), a shelf of books for written holdings, quest 1 v2; plan only
- [game3d-standing-2-2026-10-31.md](game/game3d-standing-2-2026-10-31.md) — 3D courtyard Standing 2 write-up: the writing desk and shelf, quest 1 v2, dialogue v3; written and tested, not merged
- [game3d-standing-3-sprint-plan-2026-10-31.md](game/game3d-standing-3-sprint-plan-2026-10-31.md) — 3D courtyard next sprint plan, Standing 3: Level 4 The Watch (watch reported in, no fired wire unseen; a fourth torch); plan only
- [game3d-standing-3-2026-10-31.md](game/game3d-standing-3-2026-10-31.md) — 3D courtyard Standing 3, T1: the Level 4 rule (standing_v2) in the backend; nothing visible yet
- [game3d-standing-3-wires-2026-10-31.md](game/game3d-standing-3-wires-2026-10-31.md) — 3D courtyard Standing 3, T2: fired, unseen wires in the Quest log with "I have looked"
- [game3d-standing-3-torch-2026-10-31.md](game/game3d-standing-3-torch-2026-10-31.md) — 3D courtyard Standing 3, T3: the fourth torch, v2 words, live Standing flipped to standing_v2
- [game3d-standing-3-look-2026-10-31.md](game/game3d-standing-3-look-2026-10-31.md) — 3D courtyard Standing 3, T4: look and judge in a real browser (empty, sample, fired wire acknowledged, quiet watch), tap counts, checklist section B
- [game/game3d-keep-and-towers-2026-11-01.md](game/game3d-keep-and-towers-2026-11-01.md): 3D courtyard keep and corner towers as KayKit models, with plain-shape fallback (not merged, not deployed)
- [game/game3d-tower-library-2026-11-01.md](game/game3d-tower-library-2026-11-01.md): 3D courtyard: walk into a tower and read its library, six shelves from the stored facts (not merged, not deployed)
- [game/game3d-marketplace-corner-2026-11-01.md](game/game3d-marketplace-corner-2026-11-01.md): 3D courtyard marketplace corner (KayKit stall, well, tables, crates, flags), decoration only, plain fallback (not merged, not deployed)
- [game/game3d-spread-layout-2026-11-01.md](game/game3d-spread-layout-2026-11-01.md): 3D courtyard tower pads spread out, ground reserved for marketplace and siege simulator (not merged, not deployed)
- [game/game3d-bigger-map-2026-11-01.md](game/game3d-bigger-map-2026-11-01.md): 3D courtyard spread 1.5x (walls, towers, market, horizon) and hotkeys no longer fire while typing (not merged, not deployed)
- [records-hall-polish-2026-10-17.md](game/records-hall-polish-2026-10-17.md) — Hall of Records: undistorted torches and arches, brass nameplates, tome cover that swings open into a book
- [siege-towers-backdrops-2026-10-17.md](game/siege-towers-backdrops-2026-10-17.md) — Siege Simulator: towers section moved to the top, backdrop that follows the "falls by" slider, four Stitch pictures
- [remove-circle-page-2026-10-19.md](game/remove-circle-page-2026-10-19.md) — Circle of Competence page removed from Game mode; survey drops to four facts (survey-v2)
- [game-art-dde-2026-10-16.md](game/game-art-dde-2026-10-16.md) — the 17 Stitch pictures from the design review: crests, sky badges, empty chest
- [design-master-sprint-plan-2026-10-11.md](game/design-master-sprint-plan-2026-10-11.md) — Design Master: review and sprint plan (2026-10-11)
- [fog-of-war-sprint28-2026-10-08.md](game/fog-of-war-sprint28-2026-10-08.md) — Game mode Sprint 28: fog of war (G34–G37) — 2026-10-08
- [fortress-art-pass-2026-10-09.md](game/fortress-art-pass-2026-10-09.md) — Fortress art pass — 2026-10-09
- [game-design-challenge-2026-10-09.md](game/game-design-challenge-2026-10-09.md) — Game design challenge: Records, Circle, Map, dispatch details (2026-10-09)
- [game-identity-kit-2026-10-09.md](game/game-identity-kit-2026-10-09.md) — Game identity: page-scene kit — 2026-10-09
- [game-identity-map-2026-10-09.md](game/game-identity-map-2026-10-09.md) — Game identity: Map fog patches, slate and commission seals — 2026-10-09
- [game-identity-process-changes-2026-10-09.md](game/game-identity-process-changes-2026-10-09.md) — Changes proposed (copy into the repo at these paths)
- [game-integrity-fixes-2026-10-09.md](game/game-integrity-fixes-2026-10-09.md) — Game mode integrity fixes (PR 1 of the team-review follow-ups) — 2026-10-09
- [game-mode-fortress-2026-10-01.md](game/game-mode-fortress-2026-10-01.md) — Game mode ("Fortress") — feasibility and plan — 2026-10-01
- [game-mode-next-ideas-2026-10-03.md](game/game-mode-next-ideas-2026-10-03.md) — Game mode: next ideas (proposed Sprints 23–26) — 2026-10-03
- [game-mode-noise-audit-2026-10-07.md](game/game-mode-noise-audit-2026-10-07.md) — Game-mode noise audit: end-user UX review (2026-10-07)
- [game-mode-sprint-plan-v2-2026-10-08.md](game/game-mode-sprint-plan-v2-2026-10-08.md) — Game mode: review and updated sprint plan (v2) — 2026-10-08
- [game-mode-team-review-2026-10-09.md](game/game-mode-team-review-2026-10-09.md) — Game mode: design-team review and new proposals — 2026-10-09
- [game-pages-identity-audit-2026-10-09.md](game/game-pages-identity-audit-2026-10-09.md) — Game-mode page identity audit (read-only, snapshot of origin/main)
- [game-sprint-checklist.md](game/game-sprint-checklist.md) — Game sprint checklist
- [game-visual-identity-2026-10-09.md](game/game-visual-identity-2026-10-09.md) — Game mode visual identity: why Circle and Council look plain, and the fix — 2026-10-09
- [knife-edge-a1-2026-10-09.md](game/knife-edge-a1-2026-10-09.md) — A1 Knife-edge — 2026-10-09
- [siege-backtest-c1-2026-10-13.md](game/siege-backtest-c1-2026-10-13.md) — C1 Siege back-test and the unmodelled share in the headline — 2026-10-13
- [plain-lens-d1-2026-10-13.md](game/plain-lens-d1-2026-10-13.md) — D1 Plain lens: the Fortress as labelled blocks, print form, light fallback — 2026-10-13
- [camera-d2-2026-10-14.md](game/camera-d2-2026-10-14.md) — D2 Camera: zoom, pan, fit and an 11 px label floor for the Fortress scene; survey docked beside it on wide screens — 2026-10-14
- [then-and-now-b2-2026-10-14.md](game/then-and-now-b2-2026-10-14.md) — B2 Then and Now: the analyst's blind view on the decision date beside today's, changed lines only, in the Hall of Records — 2026-10-14
- [c2-hit-rate-sprint-2026-10-14.md](game/c2-hit-rate-sprint-2026-10-14.md) — C2 hit rate: n-gated calibration ledger on the Hall of Records (your calls and the analyst's range), `forecasts` table, art slots for the four ledger pictures — 2026-10-14
- [long-memory-b1-2026-10-09.md](game/long-memory-b1-2026-10-09.md) — B1 Long Memory — 2026-10-09
- [map-design-2026-10-09.md](game/map-design-2026-10-09.md) — Map (Cartographer's table): making fog look like fog
- [map-image-prototype-2026-10-15.md](game/map-image-prototype-2026-10-15.md) — Map tab on the painted Stitch picture (default in Game mode, `?map=classic` for the old one): fixed sector regions, limits — 2026-10-15
- [map-scene-dive-2026-10-19.md](game/map-scene-dive-2026-10-19.md) — Map: press a settlement, fall into it, a round window opens on its scene (mines, forge, mill, farm, exchange) — 2026-10-19
- [map-sector-landmarks-2026-10-14.md](game/map-sector-landmarks-2026-10-14.md) — Map tab: the towers are Stitch pictures by sector (gold mine, farmhouse, vault...) — 2026-10-14
- [siege-global-benchmark-2026-10-14.md](game/siege-global-benchmark-2026-10-14.md) — Siege Simulator: a World yardstick (ACWI) next to Oslo — 2026-10-14
- [siege-instrument-sensitivity-2026-10-07.md](game/siege-instrument-sensitivity-2026-10-07.md) — Siege Simulator: a beta for every instrument (2026-10-07)
- [siege-simulator-art-2026-10-12.md](game/siege-simulator-art-2026-10-12.md) — Siege Simulator art (Design Master Sprint 14, 2026-10-12)
- [sprint23-hype-and-stress-2026-10-03.md](game/sprint23-hype-and-stress-2026-10-03.md) — Sprint 23: Hype and stress (game mode G12 + G13) — 2026-10-03
- [sprint24-time-and-filings-2026-10-04.md](game/sprint24-time-and-filings-2026-10-04.md) — Sprint 24: Time and filings (game mode G14a, G14, G15, G16)
- [sprint25-rituals-2026-10-04.md](game/sprint25-rituals-2026-10-04.md) — Sprint 25: game mode rituals (G17–G20) — 2026-10-04
- [sprint29-ravens-recent-and-feel-2026-10-08.md](game/sprint29-ravens-recent-and-feel-2026-10-08.md) — Ravens: newest first, and Sprint 29 first slice (feel) — 2026-10-08
- [stitch-design-pass-2026-10-10.md](game/stitch-design-pass-2026-10-10.md) — Stitch design pass (2026-10-10)
- [stitch-master-object-art-2026-10-11.md](game/stitch-master-object-art-2026-10-11.md) — Stitch Master object art: style, rules and prompts for what is missing
- [marketplace-landscape-2026-10-17.md](game/marketplace-landscape-2026-10-17.md) — Marketplace landscape: concept and Stitch object list (stalls placed on a street scene)
- [the-printer-sprint-plan-2026-10-20.md](game/the-printer-sprint-plan-2026-10-20.md) — The Printer (Royal Mint room, 13 central-bank levers): contest result, sprints P0 to P5, Stitch picture list, open questions
- [printer-p1-ledger-engine-2026-10-20.md](game/printer-p1-ledger-engine-2026-10-20.md) — The Printer Sprint P1: lever table with sources, deterministic engine, `/game/printer` endpoints, finding that amounts are direction-only until holding profiles are measured
- [market-street-redesign-2026-10-17.md](game/market-street-redesign-2026-10-17.md) — Market Street redesign: critique, lane layout spec, scale table, decisions (built on `feature/market-street`)
- [design-remaining-objects-2026-10-13.md](game/design-remaining-objects-2026-10-13.md) — Design: closing plan and last Stitch objects (closed 2026-10-13)
- [game-mode-design-review-2026-10-16.md](game/game-mode-design-review-2026-10-16.md) — Game mode: full design review and Stitch picture plan (review only, 2026-10-16)
- [market-street-strong-pick-2026-10-17.md](game/market-street-strong-pick-2026-10-17.md) — Market Street: the analyst's top mark (wax seal on the signboard), concepts and rules (built on `feature/market-street`)
- [market-street-strong-pick-motion-2026-10-17.md](game/market-street-strong-pick-motion-2026-10-17.md) — Market Street top mark: motion and performance spec from game-feel-engineer (the seal design won; its glow and loop were not used)
- [walls-on-the-rise-2026-10-18.md](game/walls-on-the-rise-2026-10-18.md) — Walls on the rise: how far each wall stands from the next rung, on the Fortress page; the Siege slider now starts at 5%
- [fortress-section-art-2026-10-29.md](game/fortress-section-art-2026-10-29.md) — More graphics for the Fortress sections (whole-fortress verdict, Walls on the rise, Night Watch, Vault, then Spread, Reports, legend): design-team brief, Stitch prompts, what shipped
- [remove-council-chronicle-2026-10-18.md](game/remove-council-chronicle-2026-10-18.md) — Council and Chronicle removed from Game mode: what went, what was kept (Stitch pictures, Night Watch, stored frames), how to restore
- [records-shelf-books-2026-10-18.md](game/records-shelf-books-2026-10-18.md) — Records: shelf books as wide as their nameplates

### ingestion/

Getting data in: Newsweb/ESEF/XHTML filings, uploads, tag gaps, ETF holdings capture.

- [csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md](ingestion/csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md) — CSV-import ticker/sector fixes, manual-edit UI, and full data wipe — 2026-09-21
- [esef-history-import-large-uploads-sprint10-2026-09-25.md](ingestion/esef-history-import-large-uploads-sprint10-2026-09-25.md) — Sprint 10: ESEF history import + large .xhtml uploads (2026-09-25)
- [etf-etc-annual-report-sources-investigation-2026-09-27.md](ingestion/etf-etc-annual-report-sources-investigation-2026-09-27.md) — Can we fetch ESEF/XHTML annual reports for ETF/ETC holdings the way we do from Newsweb? (2026-09-27)
- [etf-etc-holdings-data-capture-followup-2026-09-27.md](ingestion/etf-etc-holdings-data-capture-followup-2026-09-27.md) — Follow-up: a free, structured way to capture ETF holdings data (2026-09-27)
- [financial-statement-uploads-xhtml-csv-2026-09-23.md](ingestion/financial-statement-uploads-xhtml-csv-2026-09-23.md) — Financial-statement uploads: ESEF .xhtml + CSV/Excel (2026-09-23)
- [fy2025-uploads-external-validation-2026-09-23.md](ingestion/fy2025-uploads-external-validation-2026-09-23.md) — FY2025 upload figures vs. published reports: Vår Energi + Salmon Evolution (2026-09-23)
- [ixbrl-debt-da-extraction-2026-10-05.md](ingestion/ixbrl-debt-da-extraction-2026-10-05.md) — Total debt and D&A from ESEF filings: audit of 11 real files and the robust extractor (2026-10-05)
- [lgim-holdings-capture-2026-09-29.md](ingestion/lgim-holdings-capture-2026-09-29.md) — L&G (LGIM) holdings capture for the L&G Gold Mining UCITS ETF (F31) — 2026-09-29
- [newsweb-annual-report-fetch-sprint15-2026-09-26.md](ingestion/newsweb-annual-report-fetch-sprint15-2026-09-26.md) — Sprint 15: fetch ESEF annual reports straight from Oslo Børs Newsweb
- [newsweb-document-types-investigation-2026-09-26.md](ingestion/newsweb-document-types-investigation-2026-09-26.md) — Newsweb document types & other capturable sources — investigation (2026-09-26)
- [newsweb-interim-report-fetch-2026-09-27.md](ingestion/newsweb-interim-report-fetch-2026-09-27.md) — Newsweb interim/half-year report fetch (2026-09-27)
- [newsweb-interim-report-kongsberg-bug-2026-09-27.md](ingestion/newsweb-interim-report-kongsberg-bug-2026-09-27.md) — Newsweb interim-report fetch — Kongsberg (KOG.OL) bug report, 2026-09-27
- [pareto-gigante-and-fund-constituents-2026-10-04.md](ingestion/pareto-gigante-and-fund-constituents-2026-10-04.md) — Pareto Bank's .xhtml, Gigante Salmon, and statements for fund constituents (2026-10-04)
- [tag-gaps-aker-orkla-subsea-2026-10-04.md](ingestion/tag-gaps-aker-orkla-subsea-2026-10-04.md) — Aker BP, Orkla, Subsea 7: the real tags behind the missing line items (2026-10-04)
- [tag-review-inbox-2026-10-07.md](ingestion/tag-review-inbox-2026-10-07.md) — Tag review inbox: see missing ESEF inputs and the closest tags after a Newsweb fetch (2026-10-07)
- [upload-validation-var-energi-and-deletes-2026-09-23.md](ingestion/upload-validation-var-energi-and-deletes-2026-09-23.md) — Upload validation (Vår Energi FY2025) + document/holding deletes (2026-09-23)
- [xhtml-ingestion-validation-2026-10-05.md](ingestion/xhtml-ingestion-validation-2026-10-05.md) — ESEF ingestion validated against the printed annual reports: Aker BP, Orkla, Salmon Evolution, Subsea 7 (2026-10-05)
- [newsweb-watch-2026-10-28.md](ingestion/newsweb-watch-2026-10-28.md) — Background hourly check of Newsweb for new announcements on owned + watchlist holdings (2026-10-28)

### valuation/

Valuation and analysis numbers: DCF, ROIC/ROE, margin of safety, data gaps, fund look-through.

- [all-instrument-analysis-2026-10-07.md](valuation/all-instrument-analysis-2026-10-07.md) — Analysis for every instrument type (2026-10-07)
- [data-gap-fixes-2026-10-04.md](valuation/data-gap-fixes-2026-10-04.md) — Data-gap fixes, one by one (2026-10-04)
- [data-gaps-overview-2026-10-03.md](valuation/data-gaps-overview-2026-10-03.md) — Data gaps: what Aladdin cannot calculate yet, and what it needs (2026-10-03)
- [db-contents-and-look-through-2026-10-03.md](valuation/db-contents-and-look-through-2026-10-03.md) — What is in the database today, and why "Refresh look-through" seemed to do nothing (2026-10-03, late; updated 2026-10-04)
- [fund-etf-analysis-sprint8-2026-09-24.md](valuation/fund-etf-analysis-sprint8-2026-09-24.md) — Sprint 8: Buffett/Munger analysis for funds and ETFs (F9)
- [fund-look-through-valuation-2026-09-29.md](valuation/fund-look-through-valuation-2026-09-29.md) — Fund look-through valuation via the Xtrackers feed (F30) — 2026-09-29
- [gap-closing-roic-roe-multiples-2026-09-25.md](valuation/gap-closing-roic-roe-multiples-2026-09-25.md) — Closing the "Not available" gaps: ROIC, ROE and market multiples (2026-09-25)
- [loss-making-price-assumes-2026-10-14.md](valuation/loss-making-price-assumes-2026-10-14.md) — Loss-making companies: "can't be ranked yet" plus what the price assumes (2026-10-14)
- [margin-board-sprint19-2026-10-03.md](valuation/margin-board-sprint19-2026-10-03.md) — Sprint 19: make the Margin-of-safety board rank more (2026-10-03)
- [margin-of-safety-data-gaps-2026-09-27.md](valuation/margin-of-safety-data-gaps-2026-09-27.md) — Margin-of-safety board: why all 5 holdings are unrankable (2026-09-27)
- [own-year-fact-ownership-2026-10-08.md](valuation/own-year-fact-ownership-2026-10-08.md) — Own-year fact ownership (2026-10-08)
- [owner-view-metrics-and-local-worker-plan-2026-09-23.md](valuation/owner-view-metrics-and-local-worker-plan-2026-09-23.md) — Owner's-view metric definitions + plan for local LLM from Railway (2026-09-23)
- [regime-dcf-wiring-sprint14-2026-09-26.md](valuation/regime-dcf-wiring-sprint14-2026-09-26.md) — Sprint 14: regime → DCF discount-rate wiring (2026-09-26)
- [roic-roe-multiples-sprint9-2026-09-25.md](valuation/roic-roe-multiples-sprint9-2026-09-25.md) — Sprint 9: ROIC, ROE, ROCE and market multiples (2026-09-25)
- [sb1no-implausible-dcf-investigation-2026-09-29.md](valuation/sb1no-implausible-dcf-investigation-2026-09-29.md) — SB1NO.OL "incorrect data" investigation — 2026-09-29
- [valuation-data-diagnosis-2026-10-06.md](valuation/valuation-data-diagnosis-2026-10-06.md) — Why 15 holdings and watchlist names cannot be valued: diagnosis from Faiz's SQL results (2026-10-06)
- [price-split-data-fixes-2026-10-14.md](valuation/price-split-data-fixes-2026-10-14.md) — Equinor price checked (not a bug), Kongsberg 5-for-1 split restated, price-jump flag, holding-currency check (2026-10-14)
- [equinor-beta-fix-2026-10-14.md](valuation/equinor-beta-fix-2026-10-14.md) — Yahoo gave Equinor a beta of -0.66; assumptions v5 rejects betas outside 0 to 3 and says so (2026-10-14)
- [kongsberg-multiples-display-2026-10-14.md](valuation/kongsberg-multiples-display-2026-10-14.md) — Kongsberg EV/EBITDA card quoted FY2019's reason; now the newest period and the real cause (no EBITDA) (2026-10-14)
- [valuation-guardrails-build-2026-09-29.md](valuation/valuation-guardrails-build-2026-09-29.md) — Valuation guardrails — build (2026-09-29)
- [valuation-v4-normalised-base-certificates-2026-10-07.md](valuation/valuation-v4-normalised-base-certificates-2026-10-07.md) — Valuation v4: normalised DCF base, equity-certificate banks, insurer ROE (2026-10-07)

### llm-local/

Local LLM (Ollama), the worker and queue, evidence packets, LLM usage ledger.

- [evidence-packet-token-budget-2026-10-02.md](llm-local/evidence-packet-token-budget-2026-10-02.md) — Evidence packet token budget — big holdings can no longer outgrow the local model
- [evidence-quality-sprint6-2026-09-24.md](llm-local/evidence-quality-sprint6-2026-09-24.md) — Sprint 6 — Evidence quality: uploaded document text in the analysis
- [llm-usage-ledger-sprint15-2026-09-28.md](llm-local/llm-usage-ledger-sprint15-2026-09-28.md) — LLM usage ledger — Sprint 15 #1 (F27), 2026-09-28
- [local-llm-data-scaling-analysis-2026-09-27.md](llm-local/local-llm-data-scaling-analysis-2026-09-27.md) — Local LLM data scaling — will more holdings/documents break Ollama? (2026-09-27)
- [local-llm-fund-output-limit-fix-2026-09-27.md](llm-local/local-llm-fund-output-limit-fix-2026-09-27.md) — Fix: fund/ETF blind pass truncated by the local LLM's output limit (2026-09-27)
- [local-llm-tickers-ui-2026-09-23.md](llm-local/local-llm-tickers-ui-2026-09-23.md) — Local LLM engine, ticker convention, UI tweaks — 2026-09-23
- [local-worker-queue-sprint5b-2026-09-23.md](llm-local/local-worker-queue-sprint5b-2026-09-23.md) — Sprint 5B — Local LLM from Railway + overnight queue (F8 + F5)
- [nightly-tripwire-check-sprint15-2026-09-29.md](llm-local/nightly-tripwire-check-sprint15-2026-09-29.md) — Nightly tripwire check (Sprint 15 #5, F29) — 2026-09-29
- [ollama-adaptive-fit-2026-09-30.md](llm-local/ollama-adaptive-fit-2026-09-30.md) — Local LLM: adaptive fit — no more "only 78% on the GPU" failures
- [ollama-streaming-dark-theme-2026-09-25.md](llm-local/ollama-streaming-dark-theme-2026-09-25.md) — Ollama timeouts, dark theme, readable analysis — 2026-09-25
- [ollama-what-it-reads-2026-10-09.md](llm-local/ollama-what-it-reads-2026-10-09.md) — What the local LLM (Ollama) reads and writes
- [worker-housekeeping-idle-only-2026-10-05.md](llm-local/worker-housekeeping-idle-only-2026-10-05.md) — Worker: daily jobs only when the queue is idle (2026-10-05)
- [worker-nonblocking-background-jobs-2026-10-07.md](llm-local/worker-nonblocking-background-jobs-2026-10-07.md) — Worker: background jobs on their own thread (2026-10-07)

### ops/

Running the app: hosting, auth gate, page-load, background jobs, audits, live checks.

- [agentic-coding-audit-2026-09-27.md](ops/agentic-coding-audit-2026-09-27.md) — Agentic-coding audit — 2026-09-27
- [backend-auth-cors-gate-2026-09-27.md](ops/backend-auth-cors-gate-2026-09-27.md) — Backend auth gate + CORS lockdown — 2026-09-27
- [background-jobs-status-2026-10-07.md](ops/background-jobs-status-2026-10-07.md) — Background jobs on System status (2026-10-07)
- [claude-setup-assessment-2026-10-09.md](ops/claude-setup-assessment-2026-10-09.md) — Claude setup assessment and proposal — 2026-10-09
- [housekeeping-2026-10-19.md](ops/housekeeping-2026-10-19.md) — Housekeeping: code and feature audit, docs and diagrams refreshed, loose ends (2026-10-19)
- [live-verification-2026-09-27.md](ops/live-verification-2026-09-27.md) — Live verification — 2026-09-27 (post API-key-gate deploy)
- [macro-data-and-guardrails-sprint7-2026-09-24.md](ops/macro-data-and-guardrails-sprint7-2026-09-24.md) — Numeric macro data (Fed / Norges Bank) + Sprint 7 guardrail tooling
- [mypy-report-only-2026-10-14.md](ops/mypy-report-only-2026-10-14.md) — Backend type check in CI: mypy, report only (2026-10-14)
- [object-storage-free-tier-alternatives-2026-09-27.md](ops/object-storage-free-tier-alternatives-2026-09-27.md) — Object storage: free-tier alternatives to Supabase Storage (2026-09-27)
- [page-load-root-cause-2026-10-03.md](ops/page-load-root-cause-2026-10-03.md) — Page load: root cause found and options (2026-10-03)
- [page-load-snapshots-2026-09-30.md](ops/page-load-snapshots-2026-09-30.md) — Page-load fix: timing header, stored snapshots, no live price fetch in GET (2026-09-30)
- [remove-unused-manual-portfolio-endpoints-2026-10-14.md](ops/remove-unused-manual-portfolio-endpoints-2026-10-14.md) — Removed: four unused manual portfolio endpoints (2026-10-14)
- [sprint20-speed-2026-10-03.md](ops/sprint20-speed-2026-10-03.md) — Sprint 20: speed (2026-10-03)

### features/

Feature and UI notes: dashboard, watchlist, thesis tracking, performance, reader, polish and noise audits.

- [account-name-position-data-macro-speed-2026-09-22.md](features/account-name-position-data-macro-speed-2026-09-22.md) — Account name, lost position data, and Macro page slowness — 2026-09-22
- [currency-edit-and-nok-equivalent-2026-10-07.md](features/currency-edit-and-nok-equivalent-2026-10-07.md) — Holding currency: why USD shows for a NOK holding, edit after the fact, NOK equivalent
- [dashboard-status-watchlist-journal-2026-09-23.md](features/dashboard-status-watchlist-journal-2026-09-23.md) — Dashboard, System status, Watchlist, Decision journal — 2026-09-23
- [demo-mode-toggle-2026-09-26.md](features/demo-mode-toggle-2026-09-26.md) — Demo mode toggle — 2026-09-26
- [document-read-button-2026-09-30.md](features/document-read-button-2026-09-30.md) — "Read" button for stored documents — 2026-09-30
- [norway-curve-credit-and-ux-pass-sprint15-2026-09-28.md](features/norway-curve-credit-and-ux-pass-sprint15-2026-09-28.md) — Sprint 15 #4 — Norway yield curve / credit spread, plus a UX pass (2026-09-28)
- [portfolio-performance-sprint13-2026-09-27.md](features/portfolio-performance-sprint13-2026-09-27.md) — Sprint 13 — Portfolio performance over time (F13)
- [portfolio-risk-regime-sprint12-2026-09-26.md](features/portfolio-risk-regime-sprint12-2026-09-26.md) — Sprint 12: portfolio risk & regime intelligence (2026-09-26)
- [precious-metals-tracking-2026-09-26.md](features/precious-metals-tracking-2026-09-26.md) — Precious metals tracking — 2026-09-26
- [real-return-reporting-sprint15-2026-09-27.md](features/real-return-reporting-sprint15-2026-09-27.md) — Real (CPI-deflated) return reporting on Performance (Sprint 15 quarterly-review plan, item #2)
- [split-view-reader-2026-09-30.md](features/split-view-reader-2026-09-30.md) — Split-view document reader — 2026-09-30
- [llm-prompt-log-2026-10-13.md](features/llm-prompt-log-2026-10-13.md) — System status Prompt log: the exact prompts sent to Gemini and the local model (2026-10-13)
- [thesis-tracking-sprint11-2026-09-26.md](features/thesis-tracking-sprint11-2026-09-26.md) — Sprint 11: thesis tracking over time (2026-09-26)
- [ui-polish-sidebar-queue-progress-2026-09-27.md](features/ui-polish-sidebar-queue-progress-2026-09-27.md) — UI polish: sidebar, queue progress, correlation names, logo, collapsible holdings — 2026-09-27
- [ux-noise-audit-2026-10-06.md](features/ux-noise-audit-2026-10-06.md) — Frontend noise audit: end-user UX review (2026-10-06)

### sprints/

Cross-cutting sprint plans and the hardening sprint.

- [game-design-sprint-plan-2026-10-15.md](sprints/game-design-sprint-plan-2026-10-15.md) — Contest 3 game design sprint plan: 5 main sprints (E1-E5), 13-item bucket, Stitch asks for each (2026-10-15, proposed, not started)
- [hardening-sprint-2026-10-12.md](sprints/hardening-sprint-2026-10-12.md) — Hardening sprint (2026-10-12)
- [sprint15-plan-and-quarterly-review-2026-09-26.md](sprints/sprint15-plan-and-quarterly-review-2026-09-26.md) — Sprint 15 plan + economic/mathematical review + doc cleanup (2026-09-26)

### archive/

Finished progress history. Move completed milestones here from PROGRESS.md.

- [PROGRESS-full-2026-09-30.md](archive/PROGRESS-full-2026-09-30.md) — Aladdin — Progress
- [progress-archive.md](archive/progress-archive.md) — Aladdin — Progress archive

## Rules for adding docs

- New doc goes in the topic folder it belongs to, named `<topic>-<what>-<YYYY-MM-DD>.md`. Add one line for it here in the same change.
- Only `PROGRESS.md`, `architecture.md` and the active sprint plan live at the docs root.
- Reference docs by full path (`docs/game/...`) in code comments and other docs so grep finds them.
- Claude project docs under `claude/` are flat. Mirror by filename: `claude/<name>.md` is `docs/<folder>/<name>.md`. This index says which folder.
