# Aladdin — Progress

Quick-glance tracker. Detail for each item lives in its own linked doc; this page stays short tables only.

**Last updated:** 2026-09-26

---

## 1. Where we are right now

| | |
|---|---|
| **Current phase** | Phase 11: the Buffett/Munger single-focus rebuild ([sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md)) |
| **Sprints closed** | 0, 1, 2, 3, 4, 5, 5B, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 |
| **In progress** | Nothing open in code. **Newsweb fetch (F17) moved to the top of the holding page + confirmed working for watchlist items** (this session, frontend-only, committed and pushed `06e519c` — see §5). Before that: mobile responsiveness pass pushed directly to `main` (`5c46d46`, frontend-only, no PR — same low-risk direct-push precedent as the demo-mode hotfix) and **redeployed**. Before that: demo mode toggle (F16) and Sprint 15's Newsweb annual-report fetch (F17), merged via PR [#7](https://github.com/frmingest/Aladdin/pull/7) and the live blank-page hotfix (`5c15b9e`) — all confirmed working by Faiz |
| **Live URLs** | Frontend: `https://exciting-gratitude-production-71b5.up.railway.app` · Backend: `https://aladdin-production-bd25.up.railway.app` — found 2026-09-26 (old backend URL in earlier notes, `aladdin-backend.up.railway.app`, was never provisioned — this is the real one) |
| **Latest build** | **Newsweb fetch moved to the top of the holding page** (this session, 2026-09-26) — Faiz reported the "Fetch from Newsweb" button (F17) was buried at the bottom of the page inside the collapsed Primary sources section; it now renders as its own section right under the page header, visible immediately on Newsweb-eligible holdings. Also confirmed it already works unchanged for watchlist-only companies. Before that: the mobile responsiveness pass (`5c46d46`) — the fixed left sidebar (13 items, always rendered) ate roughly a third of a phone-width screen; it now collapses behind a hamburger drawer below the `lg` breakpoint, 6 data tables that were missing horizontal scroll got it, page padding shrinks on narrow screens, and the shared PageHeader wraps instead of overflowing. Not yet clicked on an actual phone by Faiz. Before that: the demo-mode hotfix (`5c15b9e`) — Faiz confirmed fixed and working. Before that: demo mode toggle (F16) + Newsweb annual-report fetch (F17), merged via PR #7 (`2e84ef8`) and redeployed |
| **GitHub access** | Claude has direct push/PR access to `frmingest/aladdin`. **Note:** the local clone at `E:\Aladdin` has fallen behind `origin/main` (it's missing the PR #7 merge and the `5c15b9e` hotfix, and now also `5c46d46`) — this session worked from a fresh GitHub clone instead of pushing from the stale local one to avoid a messy non-fast-forward merge. Faiz should `git fetch && git reset --hard origin/main` in `E:\Aladdin` next time he's on that PC, or just keep treating GitHub as the source of truth per the existing note below. Railway auto-deploys on every push to `main`, confirmed by Faiz |
| **Migrations on real Postgres** | ✅ **Confirmed 2026-09-26** for `c7a1e9f3b2d5`, `a3f5c8d1e942`, `a74ba6a059dd` (precious metals) and **`b2c3d4e5f6a7`** (app settings / demo mode) — all four ran clean on the redeploy (Railway build log: `Running upgrade a74ba6a059dd -> b2c3d4e5f6a7`). Sprint 15 (Newsweb fetch) and the mobile responsiveness pass have **no migration** |
| **Tests** | Mobile responsiveness pass: frontend-only — tsc/eslint/vitest (19/19)/production build all clean, no backend tests touched. Demo-mode hotfix: 906/907 backend pass in a from-scratch venv (1 pre-existing, environment-only failure). Sprint 15: 905/907 pass (25 new). Demo mode: 881/883 pass (18 new). Precious metals: 863/865 pass (12 new) |
| **Live-verified?** | ✅ **Yes, as of 2026-09-26**, up through the demo-mode hotfix — Faiz confirmed the toggle works in production after the fix. The mobile responsiveness pass and Sprint 15's Newsweb fetch have **not yet been checked live** — mobile needs a real phone (or a resized desktop browser); see §2 |
| **Regime-adjusted DCF (Sprint 14)** | Built, off by default (`REGIME_ADJUSTED_DCF_ENABLED=false`). Nothing changes until Faiz sets it to `true` in Railway — see §2 |
| **Economic/mathematical review** | ✅ **Done 2026-09-26.** DCF, CAPM, regime classifier, correlation/stress and all ratio math read line-by-line against what an economist would check for an investment-grade tool — **verdict: sound, no incorrect formulas or unsound logic found.** Known, already-documented simplifications restated (US-only regime curve/credit legs, round-number regime discount add-ons, no WACC/debt-structure model, Sprint 13 performance is an approximation, no real/inflation-adjusted return view yet) and turned into backlog candidates. See [sprint15-plan-and-quarterly-review-2026-09-26.md](sprint15-plan-and-quarterly-review-2026-09-26.md) §1 |
| **Project-doc cleanup** | ✅ **Done 2026-09-26.** Of the 60 Claude project docs, 33 described the app from *before* the 2026-09-21 clean-slate rebuild (Phases 0-10, old ADR decisions) — that code no longer exists in the repo. Deleted all 33; one (`cwo-design-redesign.md`) flagged as possibly misfiled from a different project, left for Faiz to confirm. See [sprint15-plan-and-quarterly-review-2026-09-26.md](sprint15-plan-and-quarterly-review-2026-09-26.md) §4 |

> ⚠️ **Correction found and fixed 2026-09-26:** this page previously said Sprint 11 was "written... as
> uncommitted changes." That was false — nothing had actually been written to `E:\Aladdin`; the repo
> was clean at Sprint 10 with no thesis code anywhere. Caught at the start of that session,
> confirmed by `git status`/`git log`, and rebuilt for real. See
> [thesis-tracking-sprint11-2026-09-26.md](thesis-tracking-sprint11-2026-09-26.md) for the full
> correction note. Going forward: don't trust a prior session's "built" claim without checking
> `git status`/`git log` in the current session first (this is also now explicit in CLAUDE.md).

---

## 2. Needs from Faiz

Going through this list point by point with Faiz (started 2026-09-26).

| # | Action | Why | Status |
|---|---|---|---|
| ★★ | **Try the mobile fix on your phone**: open the app in a mobile browser, tap the hamburger to open/close the nav, and scroll through Holdings/Portfolio to check the tables now scroll horizontally instead of squashing | First real check of this session's responsiveness pass | Open |
| ★ | **Sync your local `E:\Aladdin` clone**: it's behind `origin/main` by several commits (missing PR #7's merge, the demo-mode hotfix, and this session's mobile fix). Run `git fetch origin` then `git reset --hard origin/main` next time you're on that PC | Avoids a confusing merge next time work happens from `E:\Aladdin` directly | Open |
| ★★ | **Try Sprint 15 for real**: open an Oslo Børs holding — the **Fetch from Newsweb** card is now right at the top of the page. This is the first time it's been run against the real site (not just fixtures) | First live test of the new feature — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) §6 | Open |
| ✅ | ~~Review and commit the demo mode toggle~~ | — | **Done 2026-09-26.** Merged via PR #7, redeployed, hit a real bug (blank page), Claude fixed it directly on `main` (`5c15b9e`), Faiz confirmed it's working |
| ✅ | ~~Review and commit + push Sprint 15 (Newsweb fetch)~~ | — | **Done 2026-09-26.** Merged via PR #7, redeployed |
| ✅ | ~~Commit and push the precious metals feature~~ | — | **Done** — already on `main` |
| ★ | **Review the Dashboard UI refresh** (earlier this session) in the browser | New hero balance card + top-holdings card strip, borrowed from a dribbble reference he shared — see §5 for what changed and why | Open |
| ★★ | **Rotate credentials** pasted into chat: Supabase DB password + storage S3 keys, Google AI Studio, Mistral, FRED keys (2026-09-23) — **and the Supabase `DATABASE_URL` (incl. password) pasted 2026-09-26** to run the migration check | They're in chat transcripts — this now includes a live production DB password | **Open — treat as the gate before any further Sprint 15 (quarterly-review plan) work** |
| ★ | Once redeployed: decide whether to turn on regime-adjusted DCF (`REGIME_ADJUSTED_DCF_ENABLED=true` in Railway) — widens every DCF's discount rate by a fixed amount (0/150/300bps) when the macro regime isn't baseline | First real use of Sprint 14 — [doc](regime-dcf-wiring-sprint14-2026-09-26.md) §2 | Open |
| ★ | Open **Performance** in the nav. Check whether the reindexed value history looks right, and whether OSEBX.OL is the benchmark you want | First real use of Sprint 13 — [doc](portfolio-performance-sprint13-2026-09-27.md) §6 | Open |
| ★ | Open a holding with an analysis → **Thesis tracking** → **Make a tripwire** on 2–3 invalidation triggers; open **Thesis monitor** | First real use of Sprint 11 — [doc](thesis-tracking-sprint11-2026-09-26.md) §8 | Open |
| ★ | Open **Portfolio risk** in the nav. Check the correlation matrix, cluster flag, and today's regime reading | First real use of Sprint 12 — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) §5 | Open |
| ★ | Open **Precious metals** in the nav, add your actual gold/silver coin holdings, and check the spot prices look right | First real use of F15 — [doc](precious-metals-tracking-2026-09-26.md) §5 | Open |
| ★ | Upload `Orklaasa-2025-12-31-1-no.xhtml` again: expect a note *"… embedded images/fonts removed on upload"* | Large ESEF uploads (Sprint 10) | Open |
| ★ | On Vår Energi, Salmon Evolution and Orkla: **Primary sources → Earlier annual reports → Import history**, or now **Fetch from Newsweb** | First real run of the ESEF history import / Newsweb fetch | Open |
| ★ | Delete and re-upload the Vår Energi and Salmon Evolution `.xhtml` files, then check each holding's **Market multiples** card's share count against Vår's IR page (2,496,406,246 shares, 24 Sep 2026) | Tax/leases/EPS and share count feed the DCF | Open |
| ★★ | **Restart the local backend and the PC worker** — System status showed the local worker (DESKTOP-U0MD9TM) offline. Set `OLLAMA_NUM_PARALLEL=1` and restart Ollama | Fixes "blind pass failed: Ollama timed out"; nothing runs on the local LLM while it's down | Open |
| ★ | Look through the app in dark theme and say what still reads badly | [doc](ollama-streaming-dark-theme-2026-09-25.md) §2–3 | Open |
| ★ | **Macro → Refresh data** (US series fail = `FRED_API_KEY` missing in Railway). Restart the PC worker | First real Norges Bank / SSB / FRED fetch | Open |
| ★ | GitHub → Settings → Actions → **Variables** `SMOKE_FRONTEND_URL`, `SMOKE_API_URL`; run the Smoke test workflow | Post-deploy check | Open |
| ★ | On the PC: `pip install -r backend\requirements-dev.txt`, `pre-commit install` in `E:\Aladdin`. Later: require CI on `main` | Hooks run on every commit, CI on every push | Open |
| ★★ | **Gemini daily quota is exhausted (0/20)** as of last check | Blocks readiness/analysis runs and live research until reset | Open — check reset/billing |
| ★ | Fix the 1 remaining readiness blocker on the first holding, then run the first local analysis | First real run on the local LLM | Open |
| ★ | Change Vår Energi's ticker `VARRY` → `VAR.OL`; fix sectors: Xetra-Gold + L&G Gold Mining → Materials, Salmon Evolution → Consumer Staples | [decision](local-llm-tickers-ui-2026-09-23.md#2-ticker-convention--decision) | Open |
| ★ | **Set up your funds:** tag Heimdal Utbytte A as Equity fund; upload fact sheets; fill in Fund facts; run the analysis | First real fund analysis — [doc](fund-etf-analysis-sprint8-2026-09-24.md) §7 | Open |
| ★ | **Start the worker on the PC**: `python -m app.worker`. Then **Run on my PC** on a holding | First real local run started from Railway | Open |
| 4 | Try "Import from SEC EDGAR" on a US holding, and open an Oslo holding's announcements | First live test of both sources | Open |
| 5 | Open an equity holding, check Readiness, click **Run analysis** | Gemini quota exhausted right now; local worker offline too | Open |
| 6 | Open **Margin of safety** in the nav | First real ranking | Open |
| 7b | On a US holding, run **Import from SEC EDGAR** again | Saves the SEC cover-page share count | Open |
| 8 | Upload an annual report, run an analysis, open the document excerpt group | First real check of Sprint 6 | Open |
| 9 | Review `analysis_schema/v1.py` and `prompts/analysis/*_v2.md` | Once a real run uses v1, any change needs a new version file (CLAUDE.md Rule 3) | Open |

---

## 3. Roadmap

### 3a. Agreed feature plan (2026-09-22, in build order)

| # | Feature | Layer | What it delivers | Fits into | Status |
|---|---|---|---|---|---|
| F1 | **Analysis view** | Frontend | Verdict card, moat breakdown, clickable evidence citations and notes editor | Sprint 4 | ✅ Done 2026-09-22 |
| F2 | **Analysis readiness check** | Backend + UI | Per-holding checklist before spending a Gemini call | Sprint 4 | ✅ Done 2026-09-22 |
| F3 | **Margin-of-safety board** | Both | Every owned stock/ETF ranked by price vs. DCF range | Sprint 5 | ✅ Done 2026-09-22 |
| F4 | **System status page + smoke test** | Both | Quota, `stub` providers, stale caches; Playwright smoke suite | Sprint 5 / 7 | ✅ Done |
| F5 | **Overnight analysis queue** | Both | Queue all ready holdings, worker runs them overnight | Sprint 5B | ✅ Done 2026-09-23 |
| F8 | **Local LLM from Railway** | Both | PC worker claims runs queued from Railway, runs on Ollama | Sprint 5B | ✅ Done 2026-09-23 |
| F6 | **Decision journal** | Both | Why bought/sold, at what price, what would prove wrong | New | ✅ Done 2026-09-23 |
| F7 | **Watchlist** | Both | Analyze companies not owned; buy-below alert | New | ✅ Done 2026-09-23 |
| F10 | **Numeric macro data** | Both | Norges Bank / SSB / FRED, cited in every analysis | Backlog → built | ✅ Done 2026-09-24 |
| F9 | **Fund & ETF analysis** | Both | Fund facts, look-through, fee drag, fund-version analysis | Sprint 8 | ✅ Done 2026-09-24 |
| F11 | **Thesis tracking** | Both | Tripwires checked by code, "what changed", verdict timeline, Thesis monitor | Sprint 11 | ✅ Built, committed and live-verified 2026-09-26 (`88e77e2`, `fbb2afe`) — see correction note in §1 |
| F12 | **Portfolio risk & regime intelligence** | Both | Real correlation matrix, correlated-cluster flag, drawdown/stress scenarios, regime classification | Sprint 12 | ✅ Built, committed and live-verified 2026-09-26 (`612bc5a`, `cab8272`) — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| F13 | **Portfolio performance over time** | Both | Daily portfolio value history + benchmark comparison, reindexed from today's positions | Sprint 13 | ✅ Built, committed, pushed, deployed, live-verified 2026-09-26 — [doc](portfolio-performance-sprint13-2026-09-27.md) |
| F14 | **Regime → DCF discount-rate wiring** | Both | Widens the DCF discount rate per macro regime, off by default | Sprint 14 | ✅ Built and pushed 2026-09-26 — [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
| F15 | **Precious metals tracking** | Both | Physical 1oz gold/silver coins (top 15 series each), valued at gold-api.com spot in NOK, price-development chart | Unplanned | ✅ Built, committed and pushed 2026-09-26 — [doc](precious-metals-tracking-2026-09-26.md) |
| F16 | **Demo mode toggle** | Both | Settings-page flag that swaps every page to a fixed, fabricated portfolio and blocks every write, so the app can be shown safely with zero risk of exposing real data | Unplanned | ✅ Built, merged via PR #7 (`2e84ef8`), redeployed. **Live bug found and fixed** (fabricated data used string literals outside the frontend's real type unions — blanked the page) via direct hotfix `5c15b9e`. **Faiz confirmed working 2026-09-26** — [doc](demo-mode-toggle-2026-09-26.md) |
| F17 | **Newsweb annual-report fetch** | Both | Button on a holding that finds its newest ESEF annual report on Oslo Børs Newsweb, unzips it, and runs it through the same ingestion pipeline as a manual upload | Sprint 15 | ✅ Built, merged via PR #7 (`2e84ef8`), redeployed. **Moved to the top of the holding page 2026-09-26** (was buried in Primary sources) and confirmed to work for watchlist items too. Not yet clicked against the real Newsweb site — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| F18 | **Mobile responsiveness pass** | Frontend | Collapsible hamburger nav below `lg`, horizontal scroll on every data table, tighter page padding on narrow screens, wrapping page headers | Unplanned | ✅ Built and pushed 2026-09-26 (`5c46d46`). Not yet checked on a real phone — see §2 |

### 3b. Sprint status

| Sprint | Scope | Status |
|---|---|---|
| 0 | Guardrails, schema mapping, skeleton backend/frontend, Gemini + Mistral wiring | ✅ Closed |
| 1 | Equity data model, deterministic calculations, document ingestion, first pages | ✅ Closed |
| 2 | Live evidence-first research (macro, sector, company) | ✅ Closed |
| 3 | Valuation engine: DCF, reverse DCF, multiples + UI | ✅ Closed |
| 4 | Two-pass Buffett/Munger analysis engine + analysis view (F1) + readiness (F2) | ✅ Closed |
| 5 | Portfolio roll-up and dashboard (+ F3) | ✅ Closed 2026-09-23 |
| 5B | Local LLM from Railway + overnight queue (F8 + F5) | ✅ Built 2026-09-23 (`18e8a4e`, pushed) |
| 6 | Evidence quality (section-aware chunking, evidence budget) | ✅ Built 2026-09-24 (`71ec23b`, pushed) |
| 7 | Guardrail tooling: pre-commit, CI, secret scanning (+ F4 smoke test) | ✅ Built 2026-09-24 (`f81a824`, pushed) |
| 8 | Fund & ETF analysis (F9, decision 23) | ✅ Built 2026-09-24 (`8847311`, pushed) |
| — | Numeric macro data (F10, decision 24) | ✅ Built 2026-09-24 (`c4b2ed2`, `551a141`, pushed) |
| 9 | ROIC / ROE / ROCE + market multiples with share counts | ✅ Built 2026-09-25 (`0b05364`, pushed) |
| 10 | ESEF history import (layer D) + large `.xhtml` uploads | ✅ Built 2026-09-25 (`176721f`, pushed) |
| 11 | Thesis tracking over time (F11, decision 25) + price without a DCF | ✅ Built 2026-09-26 (`88e77e2` backend, `fbb2afe` frontend). Migration `c7a1e9f3b2d5` — confirmed on real Postgres, live in prod — [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 12 | Portfolio risk & regime intelligence (F12) | ✅ Built 2026-09-26 (`612bc5a` backend, `cab8272` frontend). Migration `a3f5c8d1e942` — confirmed on real Postgres, live in prod — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 13 | Portfolio performance over time (F13, backlog 3c) | ✅ Built 2026-09-27 (`ed9ea03`). No schema change — [doc](portfolio-performance-sprint13-2026-09-27.md). Live in prod (`ba4726b` on top) |
| 14 | Regime → DCF discount-rate wiring (backlog 3c, Faiz's call) | ✅ Built and pushed 2026-09-26 (`b7a0398`). Off by default. No schema change — [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
| 15 | Newsweb annual-report fetch (F17) — a button that fetches a holding's ESEF annual report straight from Oslo Børs Newsweb | ✅ Built, merged via PR #7, redeployed. No schema change — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md). *(The broader quarterly-review "Sprint 15" plan — LLM usage ledger, real-return reporting, etc. — is separately tracked in 3c, not started; this Newsweb feature took the slot as Faiz's more urgent request)* |
| — | Unplanned, shipped 2026-09-23: F4 status page, F6 decision journal, F7 watchlist | ✅ Done |
| — | Dashboard UI refresh (hero balance card + top-holdings cards, dribbble-inspired) | ✅ Built 2026-09-26, frontend-only, on `main` |
| — | **Precious metals tracking (F15)** | ✅ Built, committed and pushed 2026-09-26 — [doc](precious-metals-tracking-2026-09-26.md) |
| — | **Demo mode toggle (F16) — fabricated-data mode, exhaustive write-blocking** | ✅ Built, merged (PR #7), redeployed, live bug fixed via hotfix `5c15b9e`, confirmed working — [doc](demo-mode-toggle-2026-09-26.md) |
| — | **Mobile responsiveness pass (F18)** | ✅ Built and pushed 2026-09-26 (`5c46d46`), frontend-only |

### 3c. Backlog (unscheduled)

| Candidate | Note |
|---|---|
| Share-count refresh from the PC worker | Yahoo may block Railway's datacenter IP; the worker (home IP) could refresh prices and share counts |
| Operating margin from EBIT | When a filing tags EBIT but not operating income, operating margin stays empty |
| Alerts and notifications | Unblocked by Sprint 11 (tripwires store when they fired); needs a delivery channel (e-mail / push) |
| Qualitative thesis triggers | "Management changes" can't be a number; could be matched against Newsweb announcements |
| Fund annual-report holdings parser | Deterministic parser for the "schedule of investments" in a fund report PDF |
| Fund look-through valuation | Weighted P/E / earnings yield over linked holdings; needs their prices |
| Liquidity tier for illiquid alternative assets | Whisky, physical metals — no "sellable today at a quoted price" flag exists |
| Numismatic premium over spot for coins | F15 values coins at spot only — no premium source available free today |
| Historical price backfill for gold/silver | gold-api.com's history endpoint is paid; a free alternative with real history hasn't been found yet |
| Including precious metals in `PortfolioOverview` totals/concentration | Deliberate scope cut in F15 |
| Dependency audit → blocking, mypy in CI | After CI has run clean for a while |
| Code-split the frontend bundle | `npm run build` warns the main JS chunk is ~792 kB (min); not blocking, but worth a `manualChunks`/dynamic-import pass eventually |

> Pulled into the **quarterly-review "Sprint 15" plan** (2026-09-26, separate from the Newsweb feature
> above): LLM usage ledger, nightly tripwire check, reporting/export, rate sensitivity per holding,
> Norway-specific yield curve/credit spread data, benchmark-relative / real-return reporting. Not yet
> started. See [sprint15-plan-and-quarterly-review-2026-09-26.md](sprint15-plan-and-quarterly-review-2026-09-26.md) §2.

### 3d. Free data sources

| Source | Covers | Status |
|---|---|---|
| SEC EDGAR (XBRL company facts) | US financials, citation-grade | ✅ Built 2026-09-22 |
| Oslo Børs Newsweb (announcements feed) | Oslo regulated announcements | ✅ Built 2026-09-22 |
| Oslo Børs Newsweb (annual-report fetch) | Fetches and unzips the ESEF annual report itself | ✅ Built 2026-09-26 (Sprint 15) |
| filings.xbrl.org (ESEF index) | Oslo filing history FY2020–FY2024, xBRL-JSON | ✅ Built 2026-09-25 (Sprint 10) |
| yfinance share count · SEC `dei` shares | Shares outstanding for multiples + DCF | ✅ Built 2026-09-25 (Sprint 9) |
| yfinance daily price history | Correlation + stress sizing (Sprint 12), cached in `price_history_observations` | ✅ Built 2026-09-26 (Sprint 12) |
| gold-api.com | Gold/silver spot price (USD), free and keyless — no free history endpoint | ✅ Built 2026-09-26 (F15) |
| Brønnøysundregistrene | Norwegian entity data and annual accounts | Nice to have |
| VFF (vff.no) | Norwegian fund NAVs (Alfred Berg, Heimdal) | Needs a look |
| World Bank / OECD / IMF, GDELT | Global macro, news sentiment | Low |
| FMP / Finnhub free tiers | Mostly paywalled | Not recommended |

Detail: [free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md)

---

## 4. Known issues

| Issue | Impact | Fix |
|---|---|---|
| **Local `E:\Aladdin` clone is behind `origin/main`** | Missing the PR #7 merge, the `5c15b9e` hotfix and this session's `5c46d46` mobile fix — working from it directly would hit a messy non-fast-forward merge | Faiz: `git fetch origin && git reset --hard origin/main` in `E:\Aladdin` |
| **Local PC worker (DESKTOP-U0MD9TM) is offline** | No local-LLM analysis runs, no worker-side macro/price refresh, tripwire checks can't run overnight | Restart it — see §2 |
| **Gemini daily quota exhausted** — 0/20 calls left | No live research, no new analysis runs, until the quota resets or the plan changes | See §2 |
| Gemini quota counter is in-memory | Resets on every server/worker restart, no persistent record of when it resets | Backlog candidate: LLM usage ledger |
| A live Supabase `DATABASE_URL` (with password) was pasted into this chat 2026-09-26 | Credential exposure in a chat transcript, same as the 2026-09-23 leak | **Rotate the Supabase DB password — gates further Sprint 15 work**, see §2 |
| gitleaks pre-commit hook builds with Go | First `pre-commit install` run is slow | Expected; CI uses the prebuilt binary |
| Uploads from before Sprint 9 lack tax, leases and EPS | ROIC shows "missing: income_tax_expense" until re-uploaded | Delete + re-upload |
| Multiples history uses today's FX rate when none is stored near a year end | Older years' P/E for Vår carry today's NOK/USD | Historical FX backfill (backlog) |
| Metrics panel in the screenshots still shows pre-`34beec7` figures | Owner's-view numbers not applied on that instance | Delete + re-upload the `.xhtml` files |
| Railway may cap request size | A `.xhtml` over ~100 MB could be refused before reaching the app (not confirmed) | Upload via the local backend; report the exact error |
| Interest coverage ignores capitalised interest | Understates interest during a build-out (Salmon: 36m capitalised) | Not scheduled |
| ESEF notes are only block-tagged; shares outstanding rarely tagged | No per-share value from ESEF alone | — |
| An umbrella fund report adds little excerpt text | The useful part is the holdings schedule | Holdings parser (backlog) |
| Sprint 12's regime classifier is US-only for yield curve + credit spread | Norway's own rate/curve dynamics aren't reflected in those two legs | Backlog candidate: Norway yield-curve/credit-spread sourcing |
| No inflation-adjusted / real-return view on Performance | Sprint 13 reports nominal NOK returns only | Backlog candidate: real-return reporting |
| No debt-structure/WACC cross-check alongside the equity DCF | Flagged in the 2026-09-26 economic review as scope, not a bug | Not scheduled |
| Precious metals price history has no backfill | Chart starts empty and grows one point/day (gold-api.com's history endpoint is paid) | Stated plainly in the UI; backlog if a free historical source turns up |
| Precious metals valued at spot only, no numismatic premium | A coin dealer's actual buy/sell price differs from spot by a series-specific premium | Backlog — no free premium data source found yet |
| Sprint 15's Newsweb fetch hasn't been run against the live Newsweb site yet | Fixtures are shaped like real responses, but the button itself is untested against the real API | First click — see [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) §6 |
| Main JS bundle is ~792 kB minified | Slower first load, especially on mobile networks | Backlog candidate: code-splitting (3c) |

---

## 5. Changes / history

| Date | Change | Summary | Detail |
|---|---|---|---|
| 2026-09-26 | **Newsweb fetch (F17): moved to top of the holding page + confirmed it works for watchlist items** | Faiz reported the "Fetch from Newsweb" button (Sprint 15, F17) was buried at the bottom of a holding's page inside the collapsed **Primary sources** section — hard to find right after opening a position. Moved: the same card (`NewswebAnnualReportCard`, exported from `SourcesPanel.tsx`) now renders in its own section right after the page header in `HoldingDetailPage.tsx`, before "Buffett/Munger analysis" — visible immediately, no scrolling or expanding needed. It still only appears for Newsweb-eligible holdings (Oslo Børs `.OL` ticker or NOK currency, same `GET /sources/holdings/{id}` eligibility check as before); the bottom Primary sources section keeps the announcements/ESEF-history/EDGAR cards and no longer repeats this one, so it isn't shown twice. Also confirmed, no code needed: the fetch already works identically for watchlist-only companies. `POST /watchlist` (`backend/app/api/watchlist.py`) creates a real `Holding` row with the same `ticker`/`trading_currency` fields Newsweb eligibility reads (`newsweb_applies()` in `app/services/filings/eligibility.py`), and the fetch/import endpoints key off `holding_id` alone — nothing in the eligibility check, the fetch endpoint, or the import pipeline reads portfolio ownership, position quantity, or account. A watched company's page is the exact same `HoldingDetailPage` route (`/holdings/{holding_id}`) an owned position uses. Frontend-only, no backend/schema change. tsc/eslint/vitest (19/19)/production build all clean. Committed and pushed (`06e519c`) | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Mobile responsiveness pass (F18)** | Faiz reported the app "does not adapt well to screen" on mobile browsers. Root cause: the fixed 224px left sidebar (13 nav items) was always rendered regardless of viewport width, so on a phone it consumed roughly a third of the screen. Fix: the sidebar now hides below Tailwind's `lg` breakpoint and is replaced by a top bar (hamburger + logo) that opens a slide-in drawer with the same nav — closes on link tap or backdrop click, locks background scroll while open, auto-closes if the viewport widens past `lg`. Also fixed along the way: the shared `PageHeader` (title + action buttons) now stacks and wraps instead of overflowing on narrow screens; 6 data tables (Holdings list, a holding's filings table, all 3 tables on Portfolio, a fund's yearly-returns table) were missing the `overflow-x-auto` wrapper other tables already had, so their columns would clip or squash on a phone — wrapped them the same way; the Journal page's 3-stat-tile row now stacks to 1 column below `sm` instead of cramming into 3; every page container's `px-8 py-8` padding now shrinks to `px-4 py-6` below `sm`, so it doesn't eat ~64px of a ~375px-wide screen. Frontend-only, no backend/schema change. Verified with `tsc --noEmit`, `eslint`, `vitest` (19/19) and a clean production build, all run twice (once on the local `E:\Aladdin` clone, once on a fresh GitHub clone after that local clone turned out to be behind `origin/main`). Pushed directly to `main` (`5c46d46`, frontend-only, no PR — same precedent as the demo-mode hotfix). **Not yet checked on a real phone by Faiz** — see §2 | — |
| 2026-09-26 | **Hotfix: demo mode blanked the page on first real use** | Faiz turned demo mode on in production and every page went blank. Root cause: `synthetic_data.py`'s fabricated data used plausible-sounding string literals that aren't in the frontend's actual TypeScript unions — `tone="neutral"` (valid: good/info/warn), `regime="neutral"` (valid: baseline/stagflation/crisis), invented zone names `"buy_zone"`/`"fair_value"`/`"expensive"` (valid: below_bear/bear_to_base/base_to_bull/above_bull — real logic from `app/services/valuation/board.py` reproduced exactly as `_demo_zone()` so it can't drift again), `status="completed"` (valid: uppercase `COMPLETED`), `status="on_track"` (valid: intact/review/tripwire_fired/not_analyzed). Each crashed a `Record<Union,{...}>[value].label`-style lookup with no error boundary to catch it — confirmed via the live browser console (`Cannot read properties of undefined (reading 'label')` in DashboardPage's SummaryCard). Cross-checked every other fabricated enum-like field against its real frontend union — no further mismatches found. Backend suite: 906/907 pass in a from-scratch venv (the 1 failure is a pre-existing, environment-only issue confirmed present on the pre-fix commit too — missing local `GOOGLE_AI_STUDIO_API_KEY`, not a regression). Pushed directly to `main` (`5c15b9e`, no PR — an active production bug), Railway redeployed, **Faiz confirmed working** | — |
| 2026-09-26 | **Demo mode toggle (F16) and Sprint 15 Newsweb fetch (F17) merged and redeployed** | Both merged to `main` via PR [#7](https://github.com/frmingest/Aladdin/pull/7) (a duplicate PR #8 opened from a parallel session was closed). Migration `b2c3d4e5f6a7` (app_settings) ran clean on the redeploy alongside the still-pending `a74ba6a059dd` (precious metals) — both now **confirmed on real Postgres**. See the hotfix entry above for the bug this surfaced on first use | [demo mode doc](demo-mode-toggle-2026-09-26.md) · [Newsweb doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Sprint 15: fetch ESEF annual reports straight from Oslo Børs Newsweb (F17)** | New feature, Faiz's direct request: a button on a holding that finds its newest "ANNUAL FINANCIAL REPORT" announcement on Oslo Børs Newsweb, downloads the attachment, unzips it if it's an ESEF package (skipping any bundled iXBRL-viewer copy), and runs the extracted `.xhtml` through the **exact same** ingestion pipeline a manual upload uses — same de-dup, same size cap, same fact extraction, no parallel code path. Records Newsweb's own provenance (message id/url, title, date, attachment) on the resulting Document so re-checking later doesn't re-fetch. New `GET`/`POST /sources/holdings/{id}/newsweb-annual-report[/import]` endpoints, new card in Primary sources. No schema change. 25 new backend tests (905/907 total, same 2 pre-existing env-dependent failures), tsc/eslint/vitest/build clean | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Demo mode toggle (F16) — fabricated-data mode for safe demos** | New feature, Faiz's direct request: a Settings-page toggle that, when on, makes every page show a fixed, entirely fabricated portfolio (10 well-known US large-caps — AAPL/MSFT/GOOGL/JNJ/PG/KO/JPM/V/HD/XOM — across 2 fabricated accounts, plus fabricated precious metals, journal, watchlist, macro and risk data) instead of anything real, and blocks every write outright. Enforced structurally, not by output-swapping: every faked `GET` checks `is_demo_mode(db)` as the first statement and returns before the real DB/provider code runs at all; `documents.py`/`sources.py`/`research.py`/`funds.py` are blocked outright (no safe fake exists for real filings/research); every `POST`/`PUT`/`PATCH`/`DELETE` across all 17 routers calls `require_not_demo(db)` first, except the demo-mode setting itself. New `AppSetting` model/table, migration `b2c3d4e5f6a7` (additive). New **Settings** page + nav entry, persistent amber "DEMO MODE" banner on every page while on. 18 new backend tests (881/883 total, same 2 pre-existing env-dependent failures), tsc/eslint/vitest(19)/build clean. (First live use found a bug — see the hotfix entry above) | [doc](demo-mode-toggle-2026-09-26.md) |
| 2026-09-26 | **Precious metals tracking (F15) — physical gold/silver coins** | New feature, Faiz's direct request: track 1oz gold/silver coins from the top 15 popular series per metal (Maple Leaf, Krugerrand, Kangaroo, and more), valued at gold-api.com's free spot price converted to NOK. Own table (`PreciousMetalHolding`) — deliberately kept out of the equity-only `Holding` model and out of `PortfolioOverview`'s concentration math, same reasoning as Portfolio risk / Performance getting their own cards. No free historical-price endpoint exists, so the price-development chart accumulates one real point per day rather than backfilling or inventing data — stated plainly in the API's `method_note` and the chart's caption. New migration `a74ba6a059dd` (additive). New **Precious metals** page (add-coin form, holdings table with inline quantity edit, spot/value stat tiles, dual-axis gold/silver price chart), nav entry, dashboard link card. 12 new backend tests (863/865 total, same 2 pre-existing env-dependent failures), tsc/eslint/vitest(19)/build clean | [doc](precious-metals-tracking-2026-09-26.md) |
| 2026-09-26 | **Dashboard UI refresh, inspired by a dribbble stock-portfolio reference Faiz shared** | Replaced the old 4-tile stat grid with a "hero" balance card (big portfolio-value headline, holdings/top-5-share/coverage as supporting stats beside it) and added a top-4-holdings card strip below it (avatar initial, name, ticker, value, Buffett/Munger verdict) — both borrowed visually from the reference's card-based, dark-themed layout. Deliberately did **not** copy the reference's price/%-change/volume framing: Aladdin has no live intraday price feed on this page by design, and its actual value is thesis/verdict/risk-driven rather than day-trading-driven, so the new cards show weight% and verdict instead of a fabricated daily move. Same data, same `GET /portfolio/overview` endpoint, same colour tokens/design system — no backend change, no new API call, no migration | — |
| 2026-09-26 | **Full project review: economic/mathematical verification, doc cleanup, Sprint 15 plan** | Read the DCF/CAPM/regime/correlation/stress math line-by-line against what an economist would check for "investment-grade" — verdict: sound, no incorrect formulas found; known simplifications (US-only regime legs, round-number regime add-ons, no WACC model, no real-return view) turned into backlog candidates. Audited all 60 Claude project docs against the actual repo: 33 described the app from before the 2026-09-21 clean-slate rebuild and no longer match any real code — deleted. No dead application code found; the four legacy Phase-3/5 DB tables are confirmed intentionally unused (kept read/delete-only for cascade-purge), not an oversight | [plan](sprint15-plan-and-quarterly-review-2026-09-26.md) |
| 2026-09-26 | **Sprint 14: regime → DCF discount-rate wiring (backlog 3c, Faiz's call)** | New setting `REGIME_ADJUSTED_DCF_ENABLED` (default `false`) — when turned on, every holding's DCF discount rate is widened by a versioned per-regime add-on (baseline +0bps, stagflation +150bps, crisis +300bps), reusing Sprint 12's regime classifier. Both the base and widened rates are shown everywhere a valuation appears. No migration. 8 new backend tests (851/853 total, same 2 pre-existing env-dependent failures), tsc/eslint/vitest(19)/build clean. Committed and pushed (`b7a0398`) | [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
| 2026-09-26 | **Live-verified production for the first time this session** | Found the real Railway URLs (frontend `exciting-gratitude-production-71b5`, backend `aladdin-production-bd25`). Opened the live app: Dashboard renders real portfolio data; System status confirms commit `ba4726b` deployed and migration `a3f5c8d1e942` at head, "no configuration problems found." Found two live issues: local PC worker offline since ~07:50, and Gemini daily quota exhausted (0/20) | — |
| 2026-09-26 | **Confirmed both migrations on real Postgres** | Both `c7a1e9f3b2d5` and `a3f5c8d1e942` were found already applied to production Postgres. Faiz ran a downgrade→upgrade cycle twice against real Supabase Postgres — clean, no errors, ended back at head. This required pasting the live `DATABASE_URL` (with password) into chat — flagged in §4 for credential rotation | — |
| 2026-09-26 | **Corrected push status + set up direct GitHub access** | Re-checked `E:\Aladdin` directly: repo is clean, `main` up to date with `origin/main` at `bd342c1`. Railway auto-deploys on push. Also attached `frmingest/aladdin` to Claude's GitHub access directly (push scope) | — |
| 2026-09-27 | **Sprint 13: portfolio performance over time (F13, backlog 3c)** | Built daily portfolio value history + benchmark comparison: reindexes each holding's today's NOK value backward through its own price/FX history (today's positions held constant) — stated as an approximation, not a real past-transaction P&L. Reuses Sprint 12's `PriceHistoryObservation` cache as-is — no new table, no migration. New **Performance** page. Default benchmark OSEBX.OL. 11 new tests (844/846 backend total), tsc/eslint/vitest/build clean. Committed (`ed9ea03`), pushed | [doc](portfolio-performance-sprint13-2026-09-27.md) |
| 2026-09-26 | **Sprint 12: portfolio risk & regime intelligence (F12)** | Real Pearson correlation matrix from actual fetched 1-year daily price history; correlated-cluster flag (\|r\|≥0.6 among top-10 holdings); portfolio + per-holding drawdown/stress scenarios; regime classifier (baseline/stagflation/crisis) from US HY spread, US 10y-2y curve, US + Norway CPI, 3-month rolling average. New **Portfolio risk** page. Migration `a3f5c8d1e942` (additive). 29 new backend tests (832/835 total), tsc/eslint/vitest/build clean. Committed (`612bc5a`, `cab8272`), pushed | [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 2026-09-26 | **Sprint 11: thesis tracking, rebuilt for real (F11, decision 25)** | Found at session start that the previously "documented as built" Sprint 11 didn't exist in the repo — built it for real. Tripwires (checked by code, never the LLM); "what changed since the analysis"; verdict timeline; new **Thesis monitor** page. Migration `c7a1e9f3b2d5` (additive). 797/800 backend tests pass, tsc/eslint/vitest(19)/build clean. Committed (`88e77e2`, `fbb2afe`), pushed | [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 2026-09-25 | **Sprint 10: ESEF history import + large `.xhtml` uploads** | Base64 images/fonts stripped before storing and parsing; duplicate check on the original hash; iXBRL limit 80 → 250 MB. 744 tests (19 new), 19 vitest (3 new). Committed | [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) |
| 2026-09-25 | **Sprint 9: ROIC / ROE / ROCE + market multiples** | Stores pre-tax profit, tax, leases, minorities, basic EPS and raw materials from ESEF/SEC. Share-count service. Market cap, owner's-view EV, P/E, P/B, P/S, EV/EBITDA, FCF yield. 725 tests (40 new), 16 vitest (3 new). Committed, pushed | [doc](roic-roe-multiples-sprint9-2026-09-25.md) |
| 2026-09-25 | **Ollama streaming + dark theme + readable analysis** | Ollama passes stream so a slow pass no longer times out. UI: dark theme by default. 683 backend tests (8 new), 13 vitest (7 new). Committed `787cf53`, pushed | [doc](ollama-streaming-dark-theme-2026-09-25.md) |
| 2026-09-24 | **Sprint 7: guardrail tooling (+ F4 smoke test)** | CI on every push/PR; pre-commit ruff/gitleaks/file checks; read-only Playwright smoke test. Committed `f81a824`, pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) §5 |
| 2026-09-24 | **Numeric macro data: Norges Bank, SSB, FRED (F10, decision 24)** | 13 series + real policy rates and NO−US 10y. Migration `a9b0c1d2e3f4` (additive). 678 tests (29 new). Committed `c4b2ed2`, `551a141`, pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) |
| 2026-09-24 | **Sprint 8: fund & ETF analysis (F9)** | New type `equity_fund`; Fund facts typed in or CSV-imported, never read by an LLM. Migration `f8a9b0c1d2e3` (additive). 649 tests (30 new). Committed `8847311`, pushed | [doc](fund-etf-analysis-sprint8-2026-09-24.md) |
| 2026-09-24 | **Sprint 6: uploaded document text in the analysis** | Section-aware chunking; deterministic scoring within a token budget. 619 tests (33 new). Committed `71ec23b`, pushed | [doc](evidence-quality-sprint6-2026-09-24.md) |
| 2026-09-23 | **Sprint 5B: local LLM from Railway (F8) + overnight queue (F5)** | **Run on my PC** queues a run; PC worker claims it. Migration `e6f7a8b9c0d1` (additive). 586 tests (29 new). Committed `18e8a4e`, pushed | [doc](local-worker-queue-sprint5b-2026-09-23.md) |
| 2026-09-23 | **Dashboard, System status, Watchlist, Decision journal** | New home Dashboard, System status page (F4), Watchlist (F7), Decision journal (F6). 557 tests (41 new). Committed `bc4de0c`…`bc28502`, pushed | [doc](dashboard-status-watchlist-journal-2026-09-23.md) |
| 2026-09-23 | **Known issues reviewed with Faiz** | Closed without code; Railway ↔ local LLM planned as Sprint 5B / F8 | [plan](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §1, §3 |
| 2026-09-23 | **Owner's-view metric definitions** | Hybrid capital counted as debt; FCF/owner earnings net of decommissioning, financing interest, leases, hybrid coupons. Committed `34beec7`, pushed | [doc](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §2 |
| 2026-09-23 | **LLM & technology overview** | New doc: the 3 places an LLM is used | [doc](llm-and-technology-overview.md) |
| 2026-09-23 | **FY2025 uploads checked against published reports** | Raw figures match; definition gaps found and proposed | [doc](fy2025-uploads-external-validation-2026-09-23.md) |
| 2026-09-23 | **Upload validation (Vår Energi) + deletes** | 5 mapping fixes; statement integrity checks; new cascade/clean-slate deletes. 504 tests (18 new). Committed `be4b7e7`, pushed | [doc](upload-validation-var-energi-and-deletes-2026-09-23.md) |
| 2026-09-23 | **Reverted: LLM PDF figure extraction** | Faiz decided against it. `8e1c1fb` reverts `9a0db96`. Pushed | — |
| 2026-09-23 | **Uploads: ESEF `.xhtml` + CSV statements** | New inline-XBRL parser; statement-table parser for IR CSV/Excel. 486 tests (63 new). Committed `2e49de7`, pushed | [doc](financial-statement-uploads-xhtml-csv-2026-09-23.md) |
| 2026-09-23 | **Ollama set up on Faiz's PC — verified** | Readiness shows "Ollama reachable, model 'qwen3:14b' available" | [guide](local-llm-ollama-setup.md) |
| 2026-09-23 | **Local LLM engine + ticker decision + UI tweaks** | New `OllamaProvider`; ticker rule decided. 423 tests (20 new). Committed, pushed | [doc](local-llm-tickers-ui-2026-09-23.md) · [guide](local-llm-ollama-setup.md) |
| 2026-09-22 | **F3 Margin-of-safety board** | New `GET /valuation/board`. 403 tests (11 new). Committed, pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **F1 Analysis view + F2 Readiness check (Sprint 4 closed)** | New `GET /analysis/holdings/{id}/readiness`. 392 tests (28 new). Committed, pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Feature plan + progress.md restructure** | Docs only, no code | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Primary sources: SEC EDGAR + Newsweb** | EDGAR annual facts saved with filing provenance. 364 tests (31 new). Pushed | [doc](primary-sources-sec-edgar-newsweb-2026-09-22.md) |
| 2026-09-22 | Setup checklist confirmed | Pushed and redeployed, 5 CSVs re-uploaded, Gemini and FRED keys set | [doc](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-22 | Account rename, position data, Macro speed | 333 tests. Deployed | [doc](account-name-position-data-macro-speed-2026-09-22.md) |
| 2026-09-21 | CSV import fixes + full data wipe | 326 tests | [doc](csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md) |
| 2026-09-21 | CSV import 500: storage alias | 5 regression tests. Deployed | — |
| 2026-09-21 | Portfolio delete: second cascade bug | 2 regression tests | [doc](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-21 | **Sprint 4 backend: analysis engine** | Evidence packet, versioned schema, prompts, blind/reconciliation passes. Migration `b5e1a9c3d7f2`. 307 tests | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio delete, page speed, first chart, whisky grouping | — | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 closed | Valuation engine backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 closed | Live research backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio CSV import + delete UI | Pulled forward from Sprint 4 | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 1 closed | Models, calculations, ingestion, minimal API, first pages | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 closed | Guardrails, schema map, skeletons, LLM wiring | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset | Clean-slate rebuild plan written | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Pre-reset history (Phases 0–10) is kept in the project's other docs and in git history.*
