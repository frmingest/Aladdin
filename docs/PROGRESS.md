# Aladdin — Progress

**Last updated:** 2026-10-02 · structure: [1 Now](#1-where-we-are-now) · [2 Needs from Faiz](#2-needs-from-faiz) · [3 Known issues](#3-known-issues) · [4 Roadmap](#4-roadmap) · [5 Features](#5-feature-index) · [6 Changes / history](#6-changes--history)

How this page works: short tables only. Each item links to its own doc in this folder. Finished work
moves to **§6 Changes / history** as soon as it is done. The full previous version of this page (long
write-ups, every old note) is kept verbatim in [archive/PROGRESS-full-2026-09-30.md](archive/PROGRESS-full-2026-09-30.md).
Architecture and diagram: [architecture.md](architecture.md).

---

## 1. Where we are now

| | |
|---|---|
| **Phase** | Phase 11: Buffett/Munger single-focus rebuild. **Next: Sprints 18–22, approved 2026-10-02** (see §4) |
| **`main`** | `58601a8` (PR #35). Everything built so far is merged, including game mode G1–G9 (#23–#35), CI fixes (#21) and the lamp logo (#34). PR #26 (G3 alone) is superseded by #27; close it if still open |
| **Open PRs** | None known from this side (checked 2026-10-02 from the repo; confirm on GitHub) |
| **Sprints closed** | 0–15 (16 and 17 / Epic F22 were built and removed 2026-09-29). **Sprint 18 is next** |
| **Backend tests** | 1,335 pass (verified 2026-10-01 on the G7b branch) · Ruff clean · frontend 94 tests, tsc clean, ESLint 0 errors (G7b branch) |
| **Migration head** | `o1a6b7c8d9e0` (one head). Not yet confirmed on Supabase: `l1d2e3f4a5b6`, `n1f5a6b7c8d9`, `o1a6b7c8d9e0` |
| **Live URLs** | Frontend `https://exciting-gratitude-production-71b5.up.railway.app` · Backend `https://aladdin-production-bd25.up.railway.app` |
| **Deploy** | Railway auto-deploys every push to `main`. Live state not re-verified since 2026-09-27; Sprint 18 does that |
| **How Claude ships work** | Branch → commit → push → **Claude opens the PR from chat** → Faiz reviews and merges ([CLAUDE.md](../CLAUDE.md), "Pull requests") |

---

## 2. Needs from Faiz

Grouped by what kind of effort it is. ★★★ = blocks something or costs money/safety.

### A. This week: deploy checks

Done on 2026-10-02 (confirmed by Faiz): GitHub Actions variables `SMOKE_FRONTEND_URL` / `SMOKE_API_URL`, and the `SMOKE_API_KEY` secret. PR #21 is merged. See §6.

| | Action | Why |
|---|---|---|
| ★★★ | **Railway → frontend service → Variables:** `VITE_API_KEY` exists and equals the backend's `APP_AUTH_TOKEN`. (It lives on the *frontend* service, not the backend, so seeing only `APP_AUTH_TOKEN` on the backend is expected.) Also confirm only one backend deployment is active | The API-key gate was seen flapping 2026-09-27; `VITE_API_KEY` is baked in at frontend build time |
| ★★★ | **Backend deploy log** shows migrations `l1d2e3f4a5b6`, `n1f5a6b7c8d9`, `o1a6b7c8d9e0`, `p1b7c8d9e0f1` ran, and `/health` is OK after the FastAPI upgrade (0.115 → 0.142) | Not yet confirmed on Supabase |

### B. On your PC

| | Action | Why |
|---|---|---|
| ★★★ | `ollama pull qwen3:8b`; set user env vars `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`, `OLLAMA_NUM_PARALLEL=1`; fully quit and restart Ollama; `git pull` in `E:\Aladdin`; restart backend and worker | Overnight local runs failed with "only 78% on the GPU"; the adaptive-fit fix needs the fallback model ([doc](ollama-adaptive-fit-2026-09-30.md)) |
| ★★ | Restart the worker so it runs the nightly tripwire check (03:00 UTC) and snapshot rebuild (04:00 UTC) | Both jobs live in the worker |
| ★ | `pip install -r backend\requirements-dev.txt` and `pre-commit install` in `E:\Aladdin` | Hooks run on every commit |
| ★ | Delete `_to_delete/_tmp_bk.zip` from the repo (1.5 MB backup of old files, tracked by mistake) and the stray `.nanfix.patch` | Clutter; content is in git history |

### C. Try it and tell me what reads wrong (first look)

| | What | Doc |
|---|---|---|
| ★★ | **Game mode walkthrough (G1–G9, all merged, none seen on real data).** `git pull`, deploy, then in order: (1) `PATCH /accounts/{id}` `{"cash_nok": …}` per account, or Fortress → Vault → Enter cash. (2) Open Portfolio risk and Margin of safety once so the siege and land layers have data. (3) Game mode on → Fortress: weather, SALE/OFFER/DEAR signs, tripwire marks, walls and moats against what you know, tower click (survey), keep or wall click (verdict on the whole). (4) Temperament card (needs a few Journal entries). (5) Advisors: does any line read as advice to trade, flattery or a scolding? Lamp and clock; **Sound** button. (6) Marketplace: walk the street, enter 2–3 stores, try *Name your price*. (7) Lamp logo in sidebar and tab. Tell me what reads wrong, alarmist, too busy or missing. Backend + frontend; migration `p1b7c8d9e0f1` is the only one | [game mode](game-mode-fortress-2026-10-01.md) |
| ★★ | Split-view reader: Holding → Metrics → eye next to a figure on an `.xhtml` filing; the exact number should be highlighted | [split view](split-view-reader-2026-09-30.md), [Read button](document-read-button-2026-09-30.md) |
| ★★ | Page speed: press **Refresh** once on Risk, Performance, Margin of safety, Watchlist, then reload (should be sub-second); Network tab → Timing shows DB ms | page-load (project doc `page-load-snapshots-2026-09-30`) |
| ★★ | Margin of safety after the valuation guardrails: re-run SB1NO.OL and the banks; old stored analyses show a red "not reliable" note until re-run; remove `ACTIVE_VALUATION_ASSUMPTIONS_VERSION=v1` in Railway if set | [guardrails](valuation-guardrails-build-2026-09-29.md) |
| ★★ | Fund look-through: XDEF (`LU3061478973`) → Fetch from Xtrackers; L&G Gold Mining (`IE00B3CNHG25`) → Issuer L&G → Fetch (expect 44 rows). Tell me row count, as-of date, coverage % or the error | [look-through](fund-look-through-valuation-2026-09-29.md), [L&G](lgim-holdings-capture-2026-09-29.md) |
| ★★ | Tripwires: Thesis monitor → Check now; dashboard banner when one fires | [doc](nightly-tripwire-check-sprint15-2026-09-29.md) |
| ★★ | Norway curve + UX: Macro → Refresh data; Ctrl+K; "On this page" chips | [doc](norway-curve-credit-and-ux-pass-sprint15-2026-09-28.md) |
| ★ | LLM usage card on System status; Kongsberg "Fetch all reports"; real-return toggle on Performance; "i" tooltips; mobile nav on a phone | [ledger](llm-usage-ledger-sprint15-2026-09-28.md), [Kongsberg](newsweb-interim-report-kongsberg-bug-2026-09-27.md) |

### D. Data and accounts

| | Action | Why |
|---|---|---|
| ★★★ | **Rotate credentials pasted into chat** (Supabase DB password + storage keys, Google AI Studio, Mistral, FRED; the `DATABASE_URL` pasted 2026-09-26) | They sit in chat transcripts |
| ★★★ | Get a free Tavily key; set `TAVILY_API_KEY` and `RESEARCH_FALLBACK_PROVIDER=tavily` in `backend/.env` and Railway | Research keeps working when Gemini's daily budget is spent |
| ★★ | Re-tag Heimdal Utbytte N, Heimdal Høyrente Pluss B and Alfred Berg Nordic High Yield II R away from "Equity ETF" (they are Norwegian mutual funds) | Wrong instrument type skews analysis |
| ★ | Change Vår Energi ticker `VARRY` → `VAR.OL`; sectors: Xetra-Gold and L&G Gold Mining → Materials, Salmon Evolution → Consumer Staples | [decision](local-llm-tickers-ui-2026-09-23.md#2-ticker-convention--decision) |
| ★ | Re-upload Vår Energi and Salmon Evolution `.xhtml`; check share count (2,496,406,246) | Feeds the DCF |
| ★ | Decide on `REGIME_ADJUSTED_DCF_ENABLED=true` | Off by default (doc (project doc `regime-dcf-wiring-sprint14-2026-09-26`)) |

---

## 3. Known issues

| Issue | Impact | Status |
|---|---|---|
| Smoke test red on every deploy | Post-deploy check never ran | Variables and `SMOKE_API_KEY` now set (2026-10-02); **confirm the next deploy's smoke run is green** (Sprint 18) |
| Margin-of-safety board rankable rows | Vår Energi and Salmon Evolution fail on a loss-making first year; funds need look-through | Click Newsweb fetch on the two equities; run fund look-through (doc (project doc `margin-of-safety-data-gaps-2026-09-27`)) |
| Gemini free quota is small (~20 calls/day) | Research and analysis stall when spent | Tavily fallback built; needs the key |
| Split-view reader and Read button never seen in a browser | Built where no browser could be driven | Needs your first look (C above) |
| A brand-new holding's first price/beta/research fetch still happens inside a GET | One slow first load per new holding | Backlog |
| Forced Margin-of-safety refresh revalues holdings one by one | Slow for a large portfolio | Backlog |
| Frontend `npm audit`: 2 moderate (react-router) | Not blocking (threshold is high) | Fix needs a react-router 7 migration |
| Dependency audit job is report-only | New advisories do not block merges | Make blocking after it stays clean |
| Docs mirror: Claude project `progress.md` and this file must match | They drifted several times | This page is now the source; project copy updated in the same change |
| 14 write-ups exist only in the Claude project, not in `docs/` | Breaks the "mirror every doc" rule in CLAUDE.md; links to them show as plain names | Names: page-load-options/snapshots, live-verification, local-llm-data-scaling-analysis, local-llm-fund-output-limit-fix, etf-etc-(holdings-followup, annual-report-sources), ui-polish-sidebar-queue-progress, sprint15-plan-and-quarterly-review, margin-of-safety-data-gaps, object-storage-free-tier-alternatives, newsweb-document-types-investigation, regime-dcf-wiring-sprint14, free-market-data-research-providers. Copy them across with a local sync |

---

## 4. Roadmap

### Sprint plan (approved 2026-10-02)

Order: make it trustworthy (18), make the board complete (19), make it fast (20), then depth and alerts (21, 22). Game mode is frozen until you have used it.

| Sprint | Theme | Scope |
|---|---|---|
| **18** | **Stabilise and verify (no new features)** | Verify live deploy and all migrations on Supabase. Confirm the smoke test runs green. Remove tracked clutter (`_to_delete/_tmp_bk.zip`, `.nanfix.patch`). Copy the 14 project-only write-ups into `docs/`. Decide whether game-mode thresholds (`market-v1`, `realm-v1`) move to the backend mapping. Fix the react-router `npm audit` warnings. |
| **19** | **Make the Margin-of-safety board rank everything** | Newsweb fetch for Vår Energi and Salmon Evolution; DCF handling of a loss-making first year; fund annual-report holdings parser for funds that are not Xtrackers or L&G; re-tag the three Norwegian funds; turn on the Tavily fallback. |
| **20** | **Speed** | Precompute the Margin-of-safety board in the worker; react-query client cache; move first price/beta/research fetches out of GET requests; persist beta/price/FX caches to the DB. |
| **21** | **Analysis depth and reporting** | Rate sensitivity per holding (old Sprint 15 #3); PDF export / portfolio report (old #6); per-run LLM cost attribution. |
| **22** | **Alerts and evidence** | Delivery channel for fired tripwires; insider trades and major-shareholder flags from Newsweb; SEC EDGAR full-text citations for US holdings. Sprints 21 and 22 may swap. |
| **Game mode (F33)** | **Frozen** | Only fixes from your walkthrough feedback (C above). No new game phase planned. |

### Backlog

| Candidate | Note |
|---|---|
| Insider trades, major-shareholder flags, inside information as structured evidence (Newsweb 1102 / 1006 / 1005 / 1104) | investigation (project doc `newsweb-document-types-investigation-2026-09-26`) |
| SEC EDGAR full-text search | Cite real filing passages for US holdings |
| Share-count and price refresh from the PC worker | Yahoo may block Railway's IP |
| Alerts and notifications | Tripwires now store when they fired; needs a delivery channel |
| Persist beta / price / FX caches to the DB | In-process caches reset on every deploy |
| LLM ledger follow-ups | Per-run attribution, log Tavily, cost estimate, pruning |
| Extend "i" tooltips to Dashboard, Macro/Sector, Analysis view, Thesis monitor | |
| Fund annual-report holdings parser | For non-Xtrackers, non-L&G funds |
| Liquidity tier, numismatic premium, gold/silver history, metals in portfolio totals | Small scope cuts from F15 |
| Dependency audit blocking, mypy in CI | After CI stays green |
| Watch only: ESAP fund-document coverage (~2027) | Re-check once live |

### Free data sources in use

SEC EDGAR · Oslo Børs Newsweb (announcements, annual and half-year reports) · filings.xbrl.org ·
yfinance · FRED · Norges Bank · SSB · gold-api.com · DWS Xtrackers holdings JSON · LGIM holdings CSV ·
Tavily (fallback, needs a key). Details: free-market-data-research-providers-2026-09-21.md (project doc `free-market-data-research-providers-2026-09-21`).

---

## 5. Feature index

| # | Feature | Status |
|---|---|---|
| F1–F3 | Analysis view, readiness check, Margin-of-safety board | ✅ merged |
| F4 | System status page + smoke test | ✅ merged (smoke needs variables) |
| F5, F8 | Overnight queue, local LLM from Railway (PC worker) | ✅ merged |
| F6, F7 | Decision journal, Watchlist | ✅ merged |
| F9 | Fund and ETF analysis | ✅ merged |
| F10 | Numeric macro data (Norges Bank, SSB, FRED) | ✅ merged |
| F11 | Thesis tracking (tripwires, timeline, monitor) | ✅ merged |
| F12 | Portfolio risk and regime | ✅ merged |
| F13 | Portfolio performance over time | ✅ merged |
| F14 | Regime → DCF discount rate | ✅ merged, off by default |
| F15 | Precious metals tracking | ✅ merged |
| F16 | Demo mode | ✅ merged |
| F17, F19 | Newsweb annual and half-year report fetch | ✅ merged |
| F18 | Mobile responsiveness | ✅ merged |
| F22 | Ray Dalio / split mode | ⛔ built (PR #9), **removed 2026-09-29** |
| F23 | Tavily research fallback | ✅ merged, needs key |
| F24–F26 | Page-load P0/P1, "i" tooltips | ✅ merged |
| F27 | LLM usage ledger | ✅ merged (PR #10) |
| F28 | Norway curve + UX pass | ✅ merged (PR #11) |
| F29 | Nightly tripwire check | ✅ merged (PR #14) |
| F30, F31 | Fund look-through (Xtrackers), L&G holdings capture | ✅ merged (PR #13, #15) |
| F32 | Split-view document reader, Read button | ✅ merged (PR #18–#20) |
| F33 | Game mode ("Fortress"): top-bar toggle re-presenting the real portfolio as a value-investing fortress | 🔨 **G9 Marketplace + store deep-dive built 2026-10-01 (branch `feature/fortress-marketplace`, on top of the lamp/connected-fortress branch).** **G1–G7a merged (#23, #25, #27, #28, #29, #30, #31), not yet checked live. G7b (the Oracle and the Partner advisors, study lamp and clock, optional sound) built 2026-10-01, PR open.** ([doc](game-mode-fortress-2026-10-01.md)) |
| — | Valuation guardrails (growth cap, plausibility guard, bank method) | ✅ merged |
| — | Page-load snapshots + Server-Timing | ✅ merged (PR #17) |
| — | Ollama adaptive fit | ✅ merged (PR #15, #16) |

---

## 6. Changes / history

Newest first. One line each; the full write-up of every entry is in
[archive/PROGRESS-full-2026-09-30.md](archive/PROGRESS-full-2026-09-30.md) §5.

| Date | Change | Summary | Detail |
|---|---|---|---|
| 2026-10-02 | **Review and plan: Sprints 18–22 approved** | Reviewed this page against the repo. Findings: PR #21, #34 and #35 are merged (page was stale); `_to_delete/_tmp_bk.zip` and `.nanfix.patch` still tracked; no open PRs. Faiz approved a five-sprint plan (§4). Faiz confirmed done: GitHub Actions variables `SMOKE_FRONTEND_URL` / `SMOKE_API_URL` and the `SMOKE_API_KEY` secret. `VITE_API_KEY` is a frontend-service variable (build arg), so only `APP_AUTH_TOKEN` appearing on the backend is expected. Needs section trimmed; the ten game-mode first-look rows are merged into one walkthrough. Docs only, no code change | §4 |
| 2026-10-01 | **Game mode G9: Marketplace and store deep-dive (F33)** | Frontend only, no backend, no migration. A **market square** below the fortress walls (Market Hall, a stall per watchlist company, lantern lit when in your price range) opens **the Marketplace** `/fortress/marketplace`: a street of stores. Entering a store `/fortress/marketplace/:id` gives a decision view in the same game theme: a merchant, decision scales, **eight gates** (moat, walls, earning power, fair price, your price, analyst's word, tripwires, freshness) each open / ajar / closed / unknown with its reason, a **price board** (stored bear / base / bull, the 25%-cushion price, today's price, your price), the moat tour, the numbers on the shelves, the case for and against from the stored analysis, tripwires, and **Name your price** (the only write: your buy-below price on the watchlist). Overall reading by fixed rules `market-v1`: Gates open / Promising, doubts remain / Wait for the price / Pass for now / Cannot judge yet; never says buy or sell, unknown is never called good. New `lib/marketplace.ts`; thresholds are in the frontend (**decision for Faiz:** move them to the backend mapping?). tsc, 156 frontend tests (40 new), ESLint 0 errors, build; rendered in Chromium (fortress, street, store, phone). **On branch `feature/fortress-marketplace`, not merged, not deployed; not seen with real data** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Magic-lamp logo + one connected fortress with a verdict on the whole (F33)** | Frontend only, no backend, no migration. **Logo:** the genie-bottle mark is replaced by a golden Aladdin lamp (spout, handle, jewels, blue genie smoke), new `LampLogo` in the sidebar, mobile bar and drawer, `public/favicon.svg` for the tab, and as the medallion on the Great Keep. **Fortress:** the separate towers are now parts of one structure. A **Great Keep** stands mid top terrace for the whole portfolio, the biggest holdings flank it, every terrace has a **curtain wall and corner bastions** joining its towers, and the **moat is one channel** in front of each wall whose stretches follow each tower's own moat tier (water, wider or narrower; dry ditch for none; dotted for unsurveyed; plain ground for funds). **Clicking a tower** opens that holding's survey; **clicking the keep, a wall or a bastion** (or the new toolbar button, which is the keyboard route) opens **the verdict on the whole fortress**: level (Needs a look first / Mixed / No rule flags / Cannot judge yet), a line each for walls, moats, analysis age, thesis tripwires, land, weather, vault, spread and temperament, the towers to open first, and the stored analyst-verdict mix. New `lib/realmVerdict.ts` (rules `realm-v1`, shown in the card under "How it is decided"): a read-only reading aid over backend categories, shares weighted by portfolio %, never says buy/sell, unknown data is never called sound. **Decision for Faiz:** these thresholds live in the frontend (like the Ledger's "Needs a look"); say if you want them moved to the backend's versioned mapping. tsc, 116 frontend tests (21 new), build; rendered in Chromium (14 holdings, 5, 3; calm/gathering; hover, selected). **PR open, not deployed; not seen with real data** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **AI vs deterministic provenance doc** | Faiz asked which document clearly separates AI/local-LLM output from the rest. The existing LLM & technology overview covers each LLM call but not each output, so a companion doc now lists every output by source (LLM, code, or you), with code locations, local-vs-API, and what the LLM sees. Also fixed the overview, which said document text never reaches the LLM: short keyword-picked passages do (Sprint 6). Docs only, no code change. **Not committed** | [doc](AI-VS-DETERMINISTIC.md) |
| 2026-10-01 | **Game mode G7b: advisors, study lamp and clock, optional sound (F33)** | `GET /game/state` gained an `advisors` block: two advisors, **the Oracle** (patient owner) and **the Partner** (blunt sceptic), speaking hand-written lines chosen by fixed rules (new pure `app/services/game/advisors.py`; the words live in the versioned `app/domain/game_mapping/advisor_lines_v1.py`). 15 rules: a fired tripwire, a thesis flagged for review, a big tower with timber/rotted walls, a big tower with no moat, a big tower with an old analysis, cheap land on strong walls with a moat ("a reason to study it, not a signal"), a big tower above its bull case, a turning storm with a thin or a deep vault, an unknown or old cash figure, a shantytown, a shared cracked wall, a strained or a composed temperament (only with a confident reading), and an "all quiet" line that appears only when nothing is flagged **and** a stored risk reading says calm (unknown weather is never called quiet). Most urgent first (warning, note, calm), 6 lines at most and 2 per rule, with a count of what did not fit; every line carries the stored facts it came from. No line says buy, sell, add or trim (a test enforces it), none is a quotation from Buffett or Munger (disclaimer shown), and nothing rewards trading. No new threshold, no migration, database only. Frontend: *The advisors* card with two small drawn portraits and a *Why this line* fact list per line; a **study desk** with a live analog clock and a lamp that is lit when the newest portfolio snapshot is under 7 days old, dim when older, out when there is none (a reading of data age, not a reward); an optional **Sound** button (synthesized soft wind that follows the stored weather, capped quiet, off on every page load, started only by a press). Backend 1,335 tests (76 new: 70 rule/boundary + 6 API incl. read-only and demo), ruff clean; frontend 94 tests (11 new), tsc clean, ESLint 0 errors, build; page checked in Chromium at desktop and phone width against a synthetic state. **PR open, not deployed; not seen with real data; sound not listened to** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Fortress quick-look card moved beneath the frame (F33 polish)** | Frontend only. The hover/tap card (name, walls, moat, "Click to read the full survey") was floating over the scene and covered neighbouring towers, worst on a phone where a tap leaves it open. It is now a normal card in a reserved slot directly under the framed scene (`TowerPeek`, `.fortress-peek-slot`), so nothing is covered and the page does not jump. Hover state moved from `FortressScene` up to `FortressPage`. tsc and 83 tests pass. **Merged (#31), not checked live** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Game mode art pass: painted 2.5D Fortress (F33, part of G7)** | Frontend only, no backend, no migration, no rule changed. The scene was repainted towards classic fantasy-strategy quality: dusk/storm/siege/mist skies with sun glow, snow-capped mountain ranges, a pine treeline, terraced hillside with cliff faces and tufts; every building lit from the left with a contact shadow and painterly grain. Keeps got conical roofs (slate for stone walls, shingle for timber, a holed roof for rot) so the material reads twice, crenellated parapets with corbels, quoins, lit arched windows and torches when the analysis is fresh, wooden doors, drawbridges over stone-rimmed moats. Funds are round allied towers (green roof), gold is a gold mine with glinting nuggets, cash-like funds are thatched granaries, unsurveyed walls a ghost building plan. A fired tripwire now sets the tower alight (flames, smoke, breach, red !). New: green selection ring / gold hover ring, a game-style hover card, an iron-and-gilt frame with a resource bar (realm value, vault, towers, weather, temperament: facts, not points), Marcellus display face and gilded panel edges under the study skin. Ambient motion (banners, water, fireflies / rain / embers, flicker) is off under reduced motion. Layout rows got taller for the roofs (`ROW_HEIGHT` 290, `SCENE_TOP` 96). tsc, ESLint (0 errors), 83 tests (3 new), build; checked in Chromium for every weather, structure and wall, light and dark theme, desktop and phone. **PR #30 open, not deployed; not seen with real data** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Game mode G6: temperament meter (F33)** | `GET /game/state` gained a `temperament` block: level (composed / steady / restless / rash / unsurveyed), a needle (restoring events as a share of all judged events), a low-confidence flag under 5 logged decisions, and every event as its own line (rule, date, holding, one-sentence reason, source). **Rules (new `app/services/game/temperament.py`, pure):** drains = buy/add against a Sell/Avoid verdict, buy/add with no invalidation written, a *sell* (never a trim) while the verdict was Buy/Strong Buy and no tripwire had fired, 3+ trades on one holding inside 90 days (churn, one line per burst); restores = trim/sell after a tripwire fired, 6- and 12-month reviews written once due, keeping a position through a 15%+ price fall between two snapshots with no tripwire fired. Rolling 365-day window. Turnover between each account's two latest snapshots is shown as counts (no fee data, so no kroner). Database only (journal, tripwire `fired_at`, snapshot positions), no migration; new thresholds are additive mapping v1 fields. Demo mode shows an invented meter. **Frontend:** Temperament card on the Fortress (half-dial, ▲/▼ event list, turnover, link to the Journal); dashed dial and "?" when there is nothing to read, never a default needle. Backend 1,259 tests (31 new), frontend 80 (6 new), tsc and ESLint clean, build; card checked in Chromium at desktop and phone width against the demo state and an empty state. **PR #29 open, not deployed; not seen with real journal data** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Game mode G5: vault entry screen (F33)** | The Vault now has an in-app way to enter cash (until now it needed a raw `PATCH /accounts/{id}`). **Backend (additive, no migration):** `GET /game/state` vault gained `accounts` (id, name, cash, entered-at, stale flag per account) and `cash_stale`; new rule `cash_is_stale` and mapping v1 field `stale_cash_days=30` (additive; cash typed more than 30 days ago is still used but labelled old, with a data-gap note). **Frontend:** Vault card gets *Enter cash / Update cash* opening a small per-account editor (one Save, only changed accounts are PATCHed, empty box clears, 0 = entered and empty); new `parseCashNok` reads `250 000`, `250,000`, `1.250,50`, `250k`, `1.2m` and refuses anything ambiguous; hidden with a note in demo mode. Backend 1,228 tests pass (2 new), frontend tsc and ESLint clean, 74 tests (4 new), build passes. Not yet seen in a browser against real data. **Merged (#28), not checked live** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Game mode G4: sieges, land for sale, tripwire breaches (F33)** | `GET /game/state` gained a `siege` block (calm / gathering / besieged / unsurveyed from the stored macro regime and stress what-if) and per-tower `land`, `thesis`, `siege_exposure`, `shared_wall_with`. Database only: reads the stored risk and margin-of-safety snapshots (labelled with age, never rebuilt; missing or corrupt = fog) and the thesis monitor. New thresholds are additive fields in mapping v1. Frontend: weather sky, land signs, breach marks, ladders (only when weather turns), cracked shared walls, legend, weather card, Ledger columns. Backend 1,226 tests (48 new), frontend 70 (17 new), checked in Chromium. Branch also carries G3 (PR #26 never reached `main`). **Merged (#27), not checked live** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Game mode G3: study skin, holding-page tower survey, richer Ledger (F33)** | Frontend only, no backend or migration change. Game mode now sets `data-skin="study"` on `<html>`, re-pointing only the neutral surface/ink/accent tokens (dark and light variants) and headings to a serif; state colours are untouched. Holding pages show the tower survey (shared `TowerSurvey` component) at the top in game mode. The Ledger got sortable columns, a "Needs a look" filter and a totals line (pure helpers in `lib/fortress.ts`, 7 new tests). tsc, lint (0 errors), 53 tests and build pass; Ledger with skin checked in Chromium. **PR #26 open, stacked on #24; not merged, not deployed; holding page not yet seen with real data** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Game mode G2: top bar, toggle, Fortress home scene (F33)** | Frontend only, no backend or migration change. New slim top bar (desktop) / mobile bar with a **Game mode** switch; `GameModeProvider` keeps the choice per browser in guarded `localStorage`, default **off**, so default mode is unchanged. Switching on opens `/fortress` (lazy route chunk, 21 kB, so default mode downloads nothing extra) and adds a Fortress nav entry; switching off from the Fortress returns to the Dashboard. The scene is a layered SVG built from `GET /game/state`: tower size, wall material (basalt to rotted, or scaffolded when unsurveyed), moat (wide / narrow / dry ditch), ivy and fog for stale or missing analysis, funds as outposts, gold as a store, a shantytown strip, a vault card and a spread-of-the-realm card. A **Ledger** tab shows the same state as a table, so no fact is only a drawing. Towers are keyboard-operable; rise-in animation respects `prefers-reduced-motion`. Pure layout and wording in `lib/fortress.ts` (11 unit tests). Checked in a real browser against synthetic states (19 holdings, every material and structure); tsc, lint (0 errors), 46 frontend tests and build pass. No Framer Motion: CSS keyframes did the one animation needed, so no new dependency. **PR #24 open, stacked on #23; not merged, not deployed** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-10-01 | **Game mode G1 backend (F33)** | Planning ADR (decisions D1–D5 settled with Faiz), then the backend: versioned mapping `app/domain/game_mapping/v1.py`; deterministic rules (moat tier, wall material from net debt / EBITDA or, for banks, equity / assets, tower size, analysis freshness, shantytown, vault level); `GET /game/state` (database only, demo branch first); optional per-account cash (`cash_nok`, `cash_as_of`, migration `p1b7c8d9e0f1`, additive) set via the existing `PATCH /accounts/{id}`. 59 rule-boundary tests + 9 API tests; whole backend 1,178 pass; ruff clean; migration up/down/up on Postgres 16, one head. No frontend change. **Written, not merged, not deployed** | [doc](game-mode-fortress-2026-10-01.md) |
| 2026-09-30 | **Housekeeping: docs, architecture diagram, PR workflow, CI fixes** | New [architecture.md](architecture.md) with diagrams, README, refreshed technology overview, this page restructured; CLAUDE.md now says Claude opens PRs from chat. **PR #21** fixes red CI: Ruff 0.16.8 (12 findings), `pip-audit` (fastapi 0.115→0.142, starlette 0.38→1.7, python-dotenv, pytest), 3 stale tests that CI never reached, smoke workflow crash | PR #21 |
| 2026-09-30 | **Split-view reader step 2: pressing a figure highlights the exact number in the filing** | Step 1 jumped to the figure's page; this lands on the number. **Backend:** `anchoring.py` now takes the document's stored figures (`api/documents.py` passes them) and, for each, finds the tagged number on its own page with the… | [doc](split-view-reader-2026-09-30.md) |
| 2026-09-30 | **Split-view document reader: filing on one side, its stored figures on the other (F32)** | Faiz asked to read a financial report with the statements card beside it, and whether the PDF viewer supports XHTML. **Answer:** PDFs use the browser's own viewer; | [doc](split-view-reader-2026-09-30.md) |
| 2026-09-30 | **Resolved PR merge conflicts on `feature/ollama-adaptive-fit`** | The PR showed conflicts in the six page-load snapshot files and `docs/PROGRESS.md`. | — |
| 2026-09-30 | **"Read" eye button on every stored-document reference + animated reader mode** | Faiz asked for a URL to each stored document with an eye button that opens it in the browser, with a smooth transition into read mode. | [doc](document-read-button-2026-09-30.md) |
| 2026-09-30 | **Page-load fix: Server-Timing header, stored page snapshots, stored price history in Risk/Performance GETs** | Faiz approved the recommended plan (D + B + A). (1) `app/timing.py` adds `Server-Timing` (total / DB ms / query count) and `X-DB-Queries` to every response. | doc (project doc `page-load-snapshots-2026-09-30`) |
| 2026-09-30 | **Watchlist card on Margin of safety, graphics-over-text pass, live page-load measurements** | (1) `GET /valuation/board` gained `watchlist_rows` (watched companies you don't own, valued by the same code via a shared `_value_row`, with your buy-below price); | options doc (project doc `page-load-options-2026-09-30`) |
| 2026-09-30 | **Fixed: adaptive fit refused every run ("needs ~34,700 tokens but OLLAMA_NUM_CTX is 24,576")** | First real run after the adaptive-fit change: all holdings failed the planner's own size check. It reserved the full output cap (8k/16k) inside the context and capped the fallback model at the 14b's 24k. | [doc](ollama-adaptive-fit-2026-09-30.md) |
| 2026-09-30 | **Fixed: CI "gitleaks" job failing with 4 leaks** | Ran gitleaks locally against the full history: all 4 are false positives from the generic-api-key rule — three hits on the macro series identifier `no_curve_10y_3m` (`macro_series.py`, `regime.py`, `test_risk_regime.py`) and one… | — |
| 2026-09-30 | **Fixed: worker waited on Gemini quota although the Tavily fallback was configured** | Faiz's re-queued runs sat at "Waiting for Gemini quota … Gemini budget left today: 0". | — |
| 2026-09-30 | **Fixed: every overnight local analysis failing with `only 78% of the model is on the GPU`** | Root cause: qwen3:14b (~9.3 GB) + fixed 24k context doesn't fit a 12 GB card; the 09-29 guard only checked after the first token and could only fail. | [ollama-adaptive-fit-2026-09-30.md](ollama-adaptive-fit-2026-09-30.md) |
| 2026-09-29 | **Reverted Epic F22 (Ray Dalio persona + side-by-side / split mode)** | Faiz decided the modes overcomplicate the app at this stage. Reverted the whole of PR #9 (`d2eccaa`), keeping every later, unrelated change (valuation guardrails, LLM ledger, Norway curve + UX pass, NaN-close fix, fund… | — |
| 2026-09-29 | **Investigated the ETLX.DE (L&G Gold Mining) Ollama timeout and added a GPU-offload guard** | Faiz's run failed: `Ollama timed out … 1800s … ~6,314 tokens … 3.5 tokens/s … only 78% on the GPU`. | [setup guide](local-llm-ollama-setup.md) |
| 2026-09-29 | **Built L&G (LGIM) holdings capture (F31) for the L&G Gold Mining UCITS ETF** | Faiz wanted the Xtrackers-style free capture for `IE00B3CNHG25` and asked which of two options was best. | [doc](lgim-holdings-capture-2026-09-29.md) |
| 2026-09-29 | **Built fund look-through valuation (F30) via the free Xtrackers feed** | Faiz asked for it so the funds are rankable on the Margin-of-safety board. (1) `POST /funds/{id}/holdings/fetch-xtrackers {isin}` pulls the full constituent list from DWS's public JSON feed (confirmed live through the browser:… | [doc](fund-look-through-valuation-2026-09-29.md) |
| 2026-09-29 | **Merged the valuation-guardrails branch into `main`** | Faiz asked for it. Trial-merged `feature/valuation-plausibility-and-financials` (clean), re-ran the merged tree — backend 1066 pass / same 2 pre-existing failures, ruff clean, frontend tsc + vitest clean — then pushed `main`… | [doc](valuation-guardrails-build-2026-09-29.md) |
| 2026-09-29 | **Tripwire "Check now" button + fired-tripwire dashboard banner** | Frontend on top of the nightly check: Thesis page gets a Check now button (`POST /thesis/check`) and the last-run text; the dashboard shows a red banner while any tripwire fires (holding links, Open Thesis, Check now). | [doc](nightly-tripwire-check-sprint15-2026-09-29.md) |
| 2026-09-29 | **Built the nightly tripwire check (Sprint 15 #5, F29)** | Faiz asked to pull the latest code and start the next planned item. Tripwires only fired when a thesis page was opened; | [doc](nightly-tripwire-check-sprint15-2026-09-29.md) |
| 2026-09-29 | **Valuation guardrails: fix for implausible DCF / "Strong Buy" (SB1NO.OL)** | (1) Growth capped at 10% then fading to 2.5% terminal (assumptions `v2`, new default; `v1` untouched per Rule 3). | [doc](valuation-guardrails-build-2026-09-29.md) |
| 2026-09-29 | **Investigated "incorrect price" on SB1NO.OL (Watchlist) and whether it is wider** | Faiz asked whether the SB1NO.OL price shown matched Yahoo and if the problem is bigger. **Prices are correct:** all 6 watchlist tickers equal Yahoo's price to the cent (SB1NO.OL 229.50 NOK). | [doc](sb1no-implausible-dcf-investigation-2026-09-29.md) |
| 2026-09-29 | **Fixed: local-LLM runs failing with `worker error: decimal.InvalidOperation`** | Faiz saw most queued local-LLM runs fail (Xetra-Gold, Salmon Evolution, Vår Energi, XDEF, ETLX, Alfred Berg, Heimdal…). **Root cause:** yfinance returns NaN for missing daily closes (common on .OL/.DE tickers and funds). | — |
| 2026-09-28 | **Built Norway yield curve (Sprint 15 #4, F28) + UX pass** | Faiz asked to start Sprint 15 #4 and have a (non-CWO) UX designer pass improve navigation/readability. | [doc](norway-curve-credit-and-ux-pass-sprint15-2026-09-28.md) |
| 2026-09-28 | **Built the persistent LLM usage ledger (F27, Sprint 15 #1)** | Faiz said "start developing next phase"; the next buildable item on this page was Sprint 15 #1, a prerequisite for anything that adds LLM calls. | [doc](llm-usage-ledger-sprint15-2026-09-28.md) |
| 2026-09-28 | **Shipped P1 page-load-performance fix + plain-language "i" info tooltips (F25 + F26)** | Faiz picked the P1 fix from a 3-way choice (LLM ledger / Norway curve data / P1 perf fix), plus asked for simple "i" hover tooltips explaining values/graphs in plain language. | — |
| 2026-09-28 | **Synced `docs/PROGRESS.md` in the repo with this page** | Faiz's earlier "develop this and push the change" round left `docs/PROGRESS.md` one revision behind this page — it still described the page-load-performance work as "investigated, not yet built" after this page had already been… | — |
| 2026-09-28 | **Shipped P0 page-load-performance fixes: nginx gzip/cache + frontend route code-splitting (F24)** | Faiz asked to develop the investigation's proposed fixes and push. Built the two P0 items: `frontend/nginx.conf` + the Dockerfile's inline copy now turn on `gzip` for text assets and a 1-year immutable `Cache-Control` on Vite's… | [doc](page-load-performance-investigation-2026-09-28.md) |
| 2026-09-28 | **Investigated why page load times are long across the app** | Faiz asked for an investigation into slow page loads on all pages, with fixes proposed if any. Read-only sweep of all 14 frontend routes and their backend request paths (no browser profiling this session). | [doc](page-load-performance-investigation-2026-09-28.md) |
| 2026-09-28 | **Built Tavily research fallback (F23)** | Faiz asked how to reduce reliance on the Google free tier beyond a paid plan. Found the analysis passes themselves already run free/unlimited on the local Ollama worker (`LLM_PROVIDER=ollama` in `.env`) and research already… | — |
| 2026-09-27 | **Found: API-key gate flapping in production** | Faiz reported "Missing or invalid API key" pervasively right after the gate was confirmed live and enforcing earlier the same day. | [doc](api-key-gate-flapping-2026-09-27.md) |
| 2026-09-27 | **Verified the API-key gate + CORS lockdown is live in production** | Faiz asked to verify the latest development is live. Checked directly rather than trusting this page's prior notes: browser-loaded the live frontend (dashboard rendered real data, no errors), confirmed the live backend 401s every… | doc (project doc `live-verification-2026-09-27`) |
| 2026-09-27 | **Backend API-key gate + CORS lockdown** | Built the ★★★ fix for the audit's #1/#2 findings: `ApiKeyMiddleware` (new `backend/app/security.py`) requires `X-API-Key` matching `APP_AUTH_TOKEN` on every request once that's set in Railway (no-op today, unset by default); | [doc](backend-auth-cors-gate-2026-09-27.md) |
| 2026-09-27 | **Full agentic-coding audit of the codebase** | Faiz asked for a full sweep for LLM-assisted-dev risk: eroded guardrails, spaghetti/god files, prompt-injection exposure, security gaps. Read-only — no code changed. Verdict: unusually well-guardrailed; | [doc](agentic-coding-audit-2026-09-27.md) |
| 2026-09-27 | **Committed and pushed the fund/ETF LLM output-limit fix; reconciled progress.md with actual git state** | Faiz asked to commit outstanding work. Checked `E:\Aladdin` directly rather than trusting this page's prior notes (per the standing correction rule) and found: (1) the queue-scope picker and 5-item UI-polish batch, both… | — |
| 2026-09-27 | **Fixed: local LLM fund/ETF analysis failing at the output-token limit** | Faiz's live failure on Xtrackers Europe Defence Technologies UCITS ETF (`XDEF.DE`): "Ollama stopped at the output limit (8192 tokens) before finishing the JSON." Root cause: a fund/ETF blind pass answers the `fund_v1` schema,… | doc (project doc `local-llm-fund-output-limit-fix-2026-09-27`) |
| 2026-09-27 | **Researched free ETF/ETC holdings-data automation; re-confirmed margin-of-safety findings unchanged** | Faiz asked to research the best free way to further improve ETF/ETC holdings data capture, and whether the margin-of-safety board's "no data" state matched the earlier same-day findings. | doc (project doc `etf-etc-holdings-data-capture-followup-2026-09-27`) |
| 2026-09-27 | **Investigated whether ETF/ETC holdings can get Newsweb-style ESEF annual reports** | Confirmed against the Transparency Directive text (2004/109/EC, Article 1(2)) that the ESEF/iXBRL mandate excludes UCITS units entirely; Xetra-Gold is a debt-like ETC from a private GmbH, also out of scope. | doc (project doc `etf-etc-annual-report-sources-investigation-2026-09-27`) |
| 2026-09-27 | **"Queue all ready holdings" scope picker (F5 extension)** | Faiz's direct request: the button always silently queued owned positions only. Backend: `queue_ready_holdings()` gained a `scope: Literal["holdings", "watchlist", "all"] = "holdings"` parameter; | — |
| 2026-09-27 | **5 UI/UX requests: grouped sidebar, analysis-queue progress/ETA, correlation-matrix names, genie-bottle logo, collapsible Holdings sections** | Grouped the flat 13-item nav into 5 sections; worker now reports a coarse stage as a fixed percentage; correlation heatmap shows security names instead of tickers; new genie-bottle logo + favicon; | doc (project doc `ui-polish-sidebar-queue-progress-2026-09-27`) |
| 2026-09-27 | **Unified the annual + half-year Newsweb fetch into one button** | Replaced two separate annual/half-year cards+buttons with one `NewswebAllReportsCard`. No backend change. Committed and pushed | [bug doc](newsweb-interim-report-kongsberg-bug-2026-09-27.md) |
| 2026-09-27 | **Investigated Faiz's Kongsberg (KOG.OL) bug report on F19; fixed a real attachment-ordering bug** | `pick_report_attachment()`'s PDF fallback took the first PDF in Newsweb's listed order, which could be an investor presentation rather than the report — fixed to skip presentation/webcast/invitation-named PDFs. | [bug doc](newsweb-interim-report-kongsberg-bug-2026-09-27.md) |
| 2026-09-27 | **Real (CPI-deflated) return reporting on Performance (Sprint 15 quarterly-review plan #2)** | New fields on `GET /performance/portfolio`: `real_return_pct`, `real_return_available`, `real_return_reason`, `cpi_region`, `real_return_note`. 4 new backend tests. No migration | [doc](real-return-reporting-sprint15-2026-09-27.md) |
| 2026-09-27 | **Newsweb half-year/interim report fetch (F19)** | Extended F17's annual-report fetch to also cover half-year/interim reports (category 1002), PDF-only, text evidence, zero facts extracted per CLAUDE.md Rule 1. 13 new backend tests. Committed and pushed (`8bceab8`) | [doc](newsweb-interim-report-fetch-2026-09-27.md) |
| 2026-09-26 | **Investigated other Newsweb document types + news sources** | Confirmed live the 13 announcement categories Newsweb publishes; ranked by evidence value. Research-only | doc (project doc `newsweb-document-types-investigation-2026-09-26`) |
| 2026-09-26 | **Newsweb fetch (F17): fetch every available annual report, not just the newest** | New `newsweb_filing_history_start_year` setting (default 2022); skips years already on file. 3 net new tests. Committed and pushed (`b8ee24b`) | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) §8 |
| 2026-09-26 | **Newsweb fetch (F17): moved to top of the holding page + confirmed it works for watchlist items** | Frontend-only. Committed and pushed (`06e519c`) | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Mobile responsiveness pass (F18)** | Sidebar hides below `lg`, replaced by a hamburger drawer; 6 tables wrapped in horizontal scroll. Pushed directly to `main` (`5c46d46`) | — |
| 2026-09-26 | **Hotfix: demo mode blanked the page on first real use** | Fabricated data used string literals outside the frontend's real TypeScript unions. Pushed directly to `main` (`5c15b9e`), Faiz confirmed working | — |
| 2026-09-26 | **Demo mode toggle (F16) and Sprint 15 Newsweb fetch (F17) merged and redeployed** | Both merged via PR #7. Migration `b2c3d4e5f6a7` confirmed on real Postgres | [demo mode doc](demo-mode-toggle-2026-09-26.md) · [Newsweb doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Sprint 15: fetch ESEF annual reports straight from Oslo Børs Newsweb (F17)** | New `GET`/`POST /sources/holdings/{id}/newsweb-annual-report[/import]`. 25 new backend tests | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Demo mode toggle (F16) — fabricated-data mode for safe demos** | Settings-page toggle; every faked `GET` checks `is_demo_mode(db)` first; every write blocked via `require_not_demo(db)`. Migration `b2c3d4e5f6a7`. 18 new backend tests | [doc](demo-mode-toggle-2026-09-26.md) |
| 2026-09-26 | **Precious metals tracking (F15) — physical gold/silver coins** | New `PreciousMetalHolding` table, valued at gold-api.com spot in NOK. Migration `a74ba6a059dd`. 12 new backend tests | [doc](precious-metals-tracking-2026-09-26.md) |
| 2026-09-26 | **Dashboard UI refresh, inspired by a dribbble stock-portfolio reference** | Hero balance card + top-4-holdings card strip. No backend change | — |
| 2026-09-26 | **Full project review: economic/mathematical verification, doc cleanup, Sprint 15 plan** | DCF/CAPM/regime/correlation/stress math verified sound. 33 stale docs deleted | plan (project doc `sprint15-plan-and-quarterly-review-2026-09-26`) |
| 2026-09-26 | **Sprint 14: regime → DCF discount-rate wiring** | New setting `REGIME_ADJUSTED_DCF_ENABLED` (default `false`). 8 new backend tests. Committed and pushed (`b7a0398`) | doc (project doc `regime-dcf-wiring-sprint14-2026-09-26`) |
| 2026-09-26 | **Live-verified production for the first time this session** | Found the real Railway URLs. Two live issues found: local PC worker offline, Gemini daily quota exhausted | — |
| 2026-09-26 | **Confirmed both migrations on real Postgres** | `c7a1e9f3b2d5` and `a3f5c8d1e942` found already applied | — |
| 2026-09-26 | **Corrected push status + set up direct GitHub access** | Re-checked `E:\Aladdin` directly: repo clean, up to date at that time. Attached `frmingest/aladdin` to Claude's GitHub access (push scope) | — |
| 2026-09-27 | **Sprint 13: portfolio performance over time (F13, backlog 3c)** | Reindexes each holding's today's NOK value backward through its own price/FX history. New **Performance** page. 11 new tests. Committed (`ed9ea03`), pushed | [doc](portfolio-performance-sprint13-2026-09-27.md) |
| 2026-09-26 | **Sprint 12: portfolio risk & regime intelligence (F12)** | Real Pearson correlation matrix, cluster flag, stress scenarios, regime classifier. Migration `a3f5c8d1e942`. 29 new backend tests. Committed (`612bc5a`, `cab8272`), pushed | [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 2026-09-26 | **Sprint 11: thesis tracking, rebuilt for real (F11, decision 25)** | Tripwires, "what changed", verdict timeline, new **Thesis monitor** page. Migration `c7a1e9f3b2d5`. Committed (`88e77e2`, `fbb2afe`), pushed | [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 2026-09-25 | **Sprint 10: ESEF history import + large `.xhtml` uploads** | Base64 images/fonts stripped before parsing; iXBRL limit 80 → 250 MB. 744 tests (19 new) | [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) |
| 2026-09-25 | **Sprint 9: ROIC / ROE / ROCE + market multiples** | Share-count service; market cap, owner's-view EV, P/E, P/B, P/S, EV/EBITDA, FCF yield. 725 tests (40 new). Committed, pushed | [doc](roic-roe-multiples-sprint9-2026-09-25.md) |
| 2026-09-25 | **Ollama streaming + dark theme + readable analysis** | Ollama passes stream; dark theme by default. 683 backend tests. Committed `787cf53`, pushed | [doc](ollama-streaming-dark-theme-2026-09-25.md) |
| 2026-09-24 | **Sprint 7: guardrail tooling (+ F4 smoke test)** | CI on every push/PR; pre-commit ruff/gitleaks; read-only Playwright smoke test. Committed `f81a824`, pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) §5 |
| 2026-09-24 | **Numeric macro data: Norges Bank, SSB, FRED (F10, decision 24)** | 13 series + real policy rates and NO−US 10y. Migration `a9b0c1d2e3f4`. Committed `c4b2ed2`, `551a141`, pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) |
| 2026-09-24 | **Sprint 8: fund & ETF analysis (F9)** | New type `equity_fund`; Fund facts typed in or CSV-imported. Migration `f8a9b0c1d2e3`. Committed `8847311`, pushed | [doc](fund-etf-analysis-sprint8-2026-09-24.md) |
| 2026-09-24 | **Sprint 6: uploaded document text in the analysis** | Section-aware chunking; deterministic scoring within a token budget. 619 tests. Committed `71ec23b`, pushed | [doc](evidence-quality-sprint6-2026-09-24.md) |
| 2026-09-23 | **Sprint 5B: local LLM from Railway (F8) + overnight queue (F5)** | **Run on my PC** queues a run; PC worker claims it. Migration `e6f7a8b9c0d1`. Committed `18e8a4e`, pushed | [doc](local-worker-queue-sprint5b-2026-09-23.md) |
| 2026-09-23 | **Dashboard, System status, Watchlist, Decision journal** | New home Dashboard, System status page (F4), Watchlist (F7), Decision journal (F6). Committed `bc4de0c`…`bc28502`, pushed | [doc](dashboard-status-watchlist-journal-2026-09-23.md) |
| 2026-09-23 | **Known issues reviewed with Faiz** | Closed without code | [plan](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §1, §3 |
| 2026-09-23 | **Owner's-view metric definitions** | Hybrid capital counted as debt; FCF/owner earnings net of decommissioning, financing interest, leases. Committed `34beec7`, pushed | [doc](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §2 |
| 2026-09-23 | **LLM & technology overview** | New doc | [doc](llm-and-technology-overview.md) |
| 2026-09-23 | **FY2025 uploads checked against published reports** | Raw figures match | [doc](fy2025-uploads-external-validation-2026-09-23.md) |
| 2026-09-23 | **Upload validation (Vår Energi) + deletes** | 5 mapping fixes; new cascade/clean-slate deletes. Committed `be4b7e7`, pushed | [doc](upload-validation-var-energi-and-deletes-2026-09-23.md) |
| 2026-09-23 | **Reverted: LLM PDF figure extraction** | Faiz decided against it. `8e1c1fb` reverts `9a0db96`. Pushed | — |
| 2026-09-23 | **Uploads: ESEF `.xhtml` + CSV statements** | New inline-XBRL parser; statement-table parser. Committed `2e49de7`, pushed | [doc](financial-statement-uploads-xhtml-csv-2026-09-23.md) |
| 2026-09-23 | **Ollama set up on Faiz's PC — verified** | Readiness shows "Ollama reachable, model 'qwen3:14b' available" | [guide](local-llm-ollama-setup.md) |
| 2026-09-23 | **Local LLM engine + ticker decision + UI tweaks** | New `OllamaProvider`; ticker rule decided. Committed, pushed | [doc](local-llm-tickers-ui-2026-09-23.md) · [guide](local-llm-ollama-setup.md) |
| 2026-09-22 | **F3 Margin-of-safety board** | New `GET /valuation/board`. Committed, pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **F1 Analysis view + F2 Readiness check (Sprint 4 closed)** | New `GET /analysis/holdings/{id}/readiness`. Committed, pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Feature plan + progress.md restructure** | Docs only | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Primary sources: SEC EDGAR + Newsweb** | EDGAR annual facts saved with filing provenance. Pushed | [doc](primary-sources-sec-edgar-newsweb-2026-09-22.md) |
| 2026-09-22 | Setup checklist confirmed | Pushed and redeployed | doc (project doc `free-market-data-research-providers-2026-09-21`) |
| 2026-09-22 | Account rename, position data, Macro speed | Deployed | [doc](account-name-position-data-macro-speed-2026-09-22.md) |
| 2026-09-21 | CSV import fixes + full data wipe | — | [doc](csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md) |
| 2026-09-21 | CSV import 500: storage alias | Deployed | — |
| 2026-09-21 | Portfolio delete: second cascade bug | — | doc (project doc `free-market-data-research-providers-2026-09-21`) |
| 2026-09-21 | **Sprint 4 backend: analysis engine** | Evidence packet, versioned schema, prompts, blind/reconciliation passes. Migration `b5e1a9c3d7f2` | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio delete, page speed, first chart, whisky grouping | — | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 closed | Valuation engine backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 closed | Live research backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio CSV import + delete UI | Pulled forward from Sprint 4 | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 1 closed | Models, calculations, ingestion, minimal API, first pages | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 closed | Guardrails, schema map, skeletons, LLM wiring | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset | Clean-slate rebuild plan written | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Pre-reset history (Phases 0–10) is kept in the project's other docs and in git history.*
