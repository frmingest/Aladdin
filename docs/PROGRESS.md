# Aladdin — Progress

Quick-glance tracker. Detail for each item lives in its own linked doc; this page stays short tables only.

**Last updated:** 2026-09-26

---

## 1. Where we are right now

| | |
|---|---|
| **Current phase** | Phase 11: the Buffett/Munger single-focus rebuild ([sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md)) |
| **Sprints closed** | 0, 1, 2, 3, 4, 5, 5B, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 |
| **In progress** | Nothing open in code. **Sprint 15: Newsweb annual-report fetch (F17) built this session** — a button that fetches a holding's ESEF annual report straight from Oslo Børs Newsweb instead of a manual download + upload, see [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md). Committed locally (`d78a118`), not pushed. **Demo mode toggle (F16) built this session** (unplanned, Faiz's direct request) — fabricated-data mode so the app can be shown with zero risk of exposing real portfolio data, see [doc](demo-mode-toggle-2026-09-26.md). Committed locally (`b2778f3`), not pushed. **Precious metals tracking (F15) built this session** (unplanned, Faiz's direct request) — see [doc](precious-metals-tracking-2026-09-26.md). Not yet committed |
| **Live URLs** | Frontend: `https://exciting-gratitude-production-71b5.up.railway.app` · Backend: `https://aladdin-production-bd25.up.railway.app` — found 2026-09-26 (old backend URL in earlier notes, `aladdin-backend.up.railway.app`, was never provisioned — this is the real one) |
| **Latest build** | **Sprint 15: Newsweb annual-report fetch (F17)** — this session, 2026-09-26 — backend + frontend, committed locally (`d78a118`), not pushed. Before that: **Demo mode toggle (F16)** — backend + frontend, committed locally (`b2778f3`), not pushed. Before that: **Precious metals tracking (F15)** — backend + frontend, not yet committed. Before that: Sprint 14 (`b7a0398`), Sprint 13 pushed and confirmed (`bd342c1` on top of `ed9ea03`) |
| **GitHub access** | Claude now has direct push/PR access to `frmingest/aladdin` (set up 2026-09-26, at Faiz's request) — no longer dependent on `E:\Aladdin` for git operations. Railway auto-deploys on every push to `main`, confirmed by Faiz |
| **Migrations on real Postgres** | ✅ **Confirmed 2026-09-26** for `c7a1e9f3b2d5` and `a3f5c8d1e942` — Faiz ran a full downgrade→upgrade cycle twice against real Postgres from `E:\Aladdin\backend`, clean, no errors, ended back at head. The new `a74ba6a059dd` (precious metals) and `b2c3d4e5f6a7` (app settings / demo mode) are **not yet verified on real Postgres** — checked against SQLite only so far |
| **Tests** | Demo mode: 881/883 backend pass (18 new, same 2 pre-existing `test_factory.py` failures). tsc/eslint/vitest(19)/build clean. Precious metals: 863/865 backend pass (12 new, same 2 pre-existing `test_factory.py` failures). tsc/eslint/vitest(19)/build clean |
| **Live-verified?** | ✅ **Yes — confirmed 2026-09-26.** Opened the live frontend and System status page: commit `ba4726b` (the latest push) is deployed, migration `a3f5c8d1e942` matches head, "no configuration problems found," dashboard renders real portfolio data (1 043 964 kr, 8 holdings). Two things need attention: **local PC worker offline** (last seen ~07:50 that morning) and **Gemini daily quota exhausted** (0/20 left) — see §4 |

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
| ★★ | **Review and commit the demo mode toggle** (this session) via GitHub Desktop — new migration `b2c3d4e5f6a7` needs a redeploy to take effect. Try it: Settings → turn Demo mode on, confirm every page shows the fabricated portfolio (AAPL/MSFT/GOOGL/JNJ/PG/KO/JPM/V/HD/XOM) and that a save/delete anywhere is refused with a clear message | So the app can be screen-shared/demoed with zero risk of exposing real holdings — Faiz's own requirement was "ensure there is no possible way to know ANY information from real portfolio when we have demo mode on" — see [doc](demo-mode-toggle-2026-09-26.md) | Open |
| ✅ | ~~Commit review + push~~ | — | **Done — already pushed.** `git status` on `E:\Aladdin` showed clean, up to date with `origin/main`. Railway auto-deploys on push |
| ✅ | ~~Run both new migrations against real Postgres~~ | — | **Done 2026-09-26.** Both `c7a1e9f3b2d5` and `a3f5c8d1e942` were already applied to production. Faiz ran `alembic downgrade -1` / `upgrade head` twice from `E:\Aladdin\backend` against the real Supabase Postgres — clean, no errors, ended back at head |
| ✅ | ~~Which Railway URL is live?~~ | — | **Done 2026-09-26.** Frontend `https://exciting-gratitude-production-71b5.up.railway.app`, backend `https://aladdin-production-bd25.up.railway.app`. System status confirms commit `ba4726b` deployed, migration at head, no config problems |
| ★ | After deploy: open **Performance** in the nav. Check whether the reindexed value history looks right against what you remember, and whether OSEBX.OL is the benchmark you want (or a different/blended one) | First real use of Sprint 13 — [doc](portfolio-performance-sprint13-2026-09-27.md) §6 | Open |
| ★ | After deploy: open a holding with an analysis → **Thesis tracking** → **Make a tripwire** on 2–3 invalidation triggers; open **Thesis monitor**. Tell me which triggers pre-filled badly, and whether 180 days / 20% feel right | First real use of Sprint 11 — [doc](thesis-tracking-sprint11-2026-09-26.md) §8 | Open |
| ★ | After deploy: open **Portfolio risk** in the nav. Check the correlation matrix against holdings you'd expect to move together, look at any cluster flag, and check today's regime reading. Say if the \|r\|≥0.6 cluster threshold or the 2σ/20-day stress sizing feel too aggressive or too tame | First real use of Sprint 12 — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) §5 | Open |
| ★ | After the deploy: upload `Orklaasa-2025-12-31-1-no.xhtml` again: expect a note *"… embedded images/fonts removed on upload"* | Large ESEF uploads (Sprint 10) — [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) §1 | Open |
| ★ | On Vår Energi, Salmon Evolution and Orkla: **Primary sources → Earlier annual reports → Import history**. Tell me the years imported and any warnings | First real run of the ESEF history import — [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) §5 | Open |
| ★ | After the deploy: **delete and re-upload** the Vår Energi and Salmon Evolution `.xhtml` files, then open each holding's **Market multiples** card and check the share count. Vår's IR page says **2,496,406,246** shares (24 Sep 2026); if Yahoo differs, use **Enter share count** | Tax, leases and EPS are only stored on extraction; the share count feeds the DCF too | Open |
| ★★ | **Restart the local backend and the PC worker** — System status shows the local worker (DESKTOP-U0MD9TM) **offline**, last seen ~07:50 this morning. Set Windows user variable `OLLAMA_NUM_PARALLEL=1` and restart Ollama. During a pass, `ollama ps` should say `100% GPU` | Fixes the "blind pass failed: Ollama timed out" runs; also nothing can run on the local LLM while the worker is down — [doc](ollama-streaming-dark-theme-2026-09-25.md) §1 | Open |
| ★ | Look through the app in the **dark theme** and say what still reads badly | [doc](ollama-streaming-dark-theme-2026-09-25.md) §2–3 | Open |
| ★ | After deploy: **Macro → Refresh data** (expect updates; US series fail = `FRED_API_KEY` missing in Railway). Restart the PC worker | First real Norges Bank / SSB / FRED fetch | Open |
| ★ | GitHub → Settings → Actions → **Variables** `SMOKE_FRONTEND_URL`, `SMOKE_API_URL`; then run the **Smoke test** workflow | Post-deploy check (F4). URLs now known — see §1 | Open |
| ★ | Once on the PC: `pip install -r backend\requirements-dev.txt`, then `pre-commit install` in `E:\Aladdin`. Later: require CI on `main` (branch protection) | Hooks run on every commit, CI on every push | Open |
| ★★ | **Rotate credentials** pasted into chat: Supabase DB password + storage S3 keys, Google AI Studio, Mistral, FRED keys (2026-09-23) — **and now also the Supabase `DATABASE_URL` (incl. password) pasted 2026-09-26** to run the migration check. Then update `backend/.env` and Railway | They're in chat transcripts — this now includes a live production DB password | Open — **higher priority than before** |
| ★ | Railway Variables: `LLM_PROVIDER=google_ai_studio` (or unset), `LLM_FALLBACK_PROVIDER=none` | Railway can't reach Ollama on your PC | Open |
| ★★ | **Gemini daily quota is exhausted (0/20 left)** — a research call failed 2 min before this check with `429 RESOURCE_EXHAUSTED`. Nothing that needs live research/analysis will work until it resets or the plan is upgraded | Blocks readiness/analysis runs and live research until reset | Open — check when it resets, or Railway's Gemini billing plan |
| ★ | Fix the 1 remaining readiness blocker on the first holding, then run the first local analysis | First real run on the local LLM | Open |
| ★ | Change Vår Energi's ticker `VARRY` → **`VAR.OL`**; fix sectors: Xetra-Gold + L&G Gold Mining → Materials, Salmon Evolution → Consumer Staples | [ticker decision](local-llm-tickers-ui-2026-09-23.md#2-ticker-convention--decision) | Open |
| ★ | Redeploy covers Sprint 8 too (migration `f8a9b0c1d2e3`, 3 fund tables). If Railway sets `ACTIVE_ANALYSIS_PROMPT_VERSION=v1`, remove it | Fund facts + fund analysis — [doc](fund-etf-analysis-sprint8-2026-09-24.md) | Open |
| ★ | **Set up your funds:** tag Heimdal Utbytte A as **Equity fund**; upload each fund's fact sheet; fill in Fund facts; run the analysis | First real fund analysis — [doc](fund-etf-analysis-sprint8-2026-09-24.md) §7 | Open |
| ★ | **Start the worker on the PC**: `python -m app.worker` (or `scripts\start-worker.ps1`). Then **Run on my PC** on a holding from the Railway site | First real local run started from Railway — [guide](local-llm-ollama-setup.md) | Open |
| ★ | Upload the **ESEF annual report `.xhtml`** for each Oslo holding (2 years each gives 3 years of history) | [upload doc](financial-statement-uploads-xhtml-csv-2026-09-23.md) | Open |
| 1 | Set `MARKET_DATA_PROVIDER=yfinance` and `RESEARCH_PROVIDER=gemini_search` in **Railway** | The analysis engine can't produce real output while these are `stub` | Open — System status shows these are already set correctly (yfinance, Gemini + Google Search); worth double-checking against this row |
| 2 | Add `SEC_EDGAR_USER_AGENT` in **Railway** | SEC requires a contact email | Open — System status shows "Contact user agent set", so this may already be done; worth confirming |
| 4 | Try "Import from SEC EDGAR" on a US holding, and open an Oslo holding's announcements | First live test of both sources — System status shows SEC EDGAR "Never imported" | Open |
| 5 | Open an equity holding, check the Readiness card, then click **Run analysis** | First real signal on prompt quality, cost and usefulness — note: Gemini quota is exhausted right now (see above); local worker is also offline | Open |
| 6 | Open **Margin of safety** in the nav | First real ranking | Open |
| 7 | Try **Dashboard**, **Watchlist** and **Journal** | First real use — Dashboard confirmed rendering real data 2026-09-26 | Open |
| 7b | On a US holding, run **Import from SEC EDGAR** again | Saves the SEC cover-page share count | Open |
| 8 | Upload an annual report, run an analysis and open the **document excerpt** group | First real check of Sprint 6 — [doc](evidence-quality-sprint6-2026-09-24.md) §6 | Open |
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
| F11 | **Thesis tracking** | Both | Tripwires checked by code, "what changed", verdict timeline, Thesis monitor | Sprint 11 | ✅ **Actually built and committed 2026-09-26** (`88e77e2`, `fbb2afe`) — see correction note in §1 |
| F12 | **Portfolio risk & regime intelligence** | Both | Real correlation matrix, correlated-cluster flag, drawdown/stress scenarios, regime classification | Sprint 12 | ✅ Built and committed 2026-09-26 (`612bc5a`, `cab8272`) — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| F13 | **Portfolio performance over time** | Both | Daily portfolio value history + benchmark comparison, reindexed from today's positions | Sprint 13 | ✅ Built, committed and **pushed, deployed, live-verified** 2026-09-26 — [doc](portfolio-performance-sprint13-2026-09-27.md) |
| F14 | **Regime → DCF discount-rate wiring** | Both | Widens the DCF discount rate per macro regime, off by default | Sprint 14 | ✅ Built and pushed 2026-09-26 — [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
| F15 | **Precious metals tracking** | Both | Physical 1oz gold/silver coins (top 15 series each), valued at gold-api.com spot in NOK, price-development chart | Unplanned | ✅ Built 2026-09-26, not yet committed — [doc](precious-metals-tracking-2026-09-26.md) |
| F16 | **Demo mode toggle** | Both | Settings-page flag that swaps every page to a fixed, fabricated portfolio and blocks every write, so the app can be shown safely with zero risk of exposing real data | Unplanned | ✅ Built and committed locally 2026-09-26 (`b2778f3`), not yet pushed — [doc](demo-mode-toggle-2026-09-26.md) |
| F17 | **Newsweb annual-report fetch** | Both | Button on a holding that finds its newest ESEF annual report on Oslo Børs Newsweb, unzips it, and runs it through the same ingestion pipeline as a manual upload | Sprint 15 | ✅ Built and committed locally 2026-09-26 (`d78a118`), not yet pushed — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |

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
| 11 | Thesis tracking over time (F11, decision 25) + price without a DCF | ✅ **Actually** built 2026-09-26 (`88e77e2` backend, `fbb2afe` frontend). Migration `c7a1e9f3b2d5` — **confirmed on real Postgres and live in prod, 2026-09-26** — [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 12 | Portfolio risk & regime intelligence (F12) | ✅ Built 2026-09-26 (`612bc5a` backend, `cab8272` frontend). Migration `a3f5c8d1e942` — **confirmed on real Postgres and live in prod, 2026-09-26** — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 13 | Portfolio performance over time (F13, backlog 3c) | ✅ Built 2026-09-27 (`ed9ea03`). No schema change — reuses Sprint 12's `PriceHistoryObservation` cache as-is — [doc](portfolio-performance-sprint13-2026-09-27.md). **Live in prod, confirmed 2026-09-26** (commit `ba4726b` on top) |
| 14 | Regime → DCF discount-rate wiring (backlog 3c, Faiz's call) | ✅ Built and pushed 2026-09-26 (`b7a0398`). Off by default (`REGIME_ADJUSTED_DCF_ENABLED=false`). No schema change — [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
| **15** | **Newsweb annual-report fetch (F17)** — a button that fetches a holding's ESEF annual report straight from Oslo Børs Newsweb instead of a manual download + upload | ✅ Built and committed locally 2026-09-26 (`d78a118`). No schema change. Not yet pushed — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| — | **Precious metals tracking (F15)** — physical gold/silver coin holdings, gold-api.com spot pricing, price-development chart | ✅ Built 2026-09-26, backend + frontend, not yet committed — [doc](precious-metals-tracking-2026-09-26.md) |
| — | **Demo mode toggle (F16)** — fabricated-data mode, exhaustive write-blocking | ✅ Built 2026-09-26, backend + frontend, committed locally (`b2778f3`), not yet pushed — [doc](demo-mode-toggle-2026-09-26.md) |
| — | Unplanned, shipped 2026-09-23: F4 status page, F6 decision journal, F7 watchlist | ✅ Done |

### 3c. Backlog (unscheduled)

| Candidate | Note |
|---|---|
| Share-count refresh from the PC worker | Yahoo may block Railway's datacenter IP; the worker (home IP) could refresh prices and share counts |
| Operating margin from EBIT | When a filing tags EBIT but not operating income, operating margin stays empty |
| Alerts and notifications | Unblocked by Sprint 11 (tripwires store when they fired); needs a delivery channel (e-mail / push) |
| Nightly tripwire check | The PC worker could check tripwires with fresh prices overnight (today: when a page opens) |
| Qualitative thesis triggers | "Management changes" can't be a number; could be matched against Newsweb announcements |
| Reporting and export | PDF or print view of an analysis run |
| More primary sources | See table 3d |
| Fund annual-report holdings parser | Deterministic parser for the "schedule of investments" in a fund report PDF |
| Fund look-through valuation | Weighted P/E / earnings yield over linked holdings; needs their prices |
| Rate sensitivity per holding | Floating vs fixed debt, refinancing wall vs. the new policy-rate/yield data |
| Norway-specific yield curve / credit spread data | Sprint 12's regime classifier is US-only for curve + credit; no free Norges Bank equivalent found yet |
| Regime → DCF factor-weight wiring | Sprint 12 surfaces the regime as information only; wiring it into valuation is a real behavior change — Faiz's call |
| Liquidity tier for illiquid alternative assets | Whisky, physical metals — no "sellable today at a quoted price" flag exists (from the old Phase 10 notes) |
| Benchmark-relative / real-return reporting | No index comparison or inflation adjustment on returns yet (from the old Phase 10 notes) |
| Dependency audit → blocking, mypy in CI | After CI has run clean for a while |
| LLM usage ledger | Gemini's daily quota counter is in-memory and resets on restart; ran out mid-session 2026-09-26 with no persistent tracking of when |

### 3d. Free data sources

| Source | Covers | Status |
|---|---|---|
| SEC EDGAR (XBRL company facts) | US financials, citation-grade | ✅ Built 2026-09-22 |
| Oslo Børs Newsweb | Oslo regulated announcements | ✅ Built 2026-09-22 |
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
| **Local PC worker (DESKTOP-U0MD9TM) is offline** — last seen ~07:50 the morning of 2026-09-26 | No local-LLM analysis runs, no worker-side macro/price refresh, tripwire checks can't run overnight | Restart it — see §2 |
| **Gemini daily quota exhausted** — 0/20 calls left, last research call failed with `429 RESOURCE_EXHAUSTED` | No live research, no new analysis runs, until the quota resets or the plan changes | See §2 — check reset timing / billing plan |
| ~~Neither Sprint 11 nor Sprint 12's migration has run on real Postgres~~ | — | **Resolved 2026-09-26** — both confirmed with a full downgrade/upgrade cycle against real Supabase Postgres, clean |
| Gemini quota counter is in-memory | Resets on every server/worker restart, no persistent record of when it resets | LLM usage ledger (backlog) |
| No GitHub push credentials in any session shell | **Resolved 2026-09-26** — Claude now has direct push/PR access to `frmingest/aladdin` | — |
| A live Supabase `DATABASE_URL` (with password) was pasted into this chat 2026-09-26, to run the migration check | Credential exposure in a chat transcript, same as the 2026-09-23 leak | **Rotate the Supabase DB password** — see §2 |
| gitleaks pre-commit hook builds with Go | First `pre-commit install` run is slow | Expected; CI uses the prebuilt binary |
| Uploads from before Sprint 9 lack tax, leases and EPS | ROIC shows "missing: income_tax_expense" until re-uploaded | Delete + re-upload |
| Multiples history uses today's FX rate when none is stored near a year end | Older years' P/E for Vår carry today's NOK/USD | Historical FX backfill (backlog) |
| Metrics panel in the screenshots still shows pre-`34beec7` figures | Owner's-view numbers not applied on that instance | Delete + re-upload the `.xhtml` files |
| Railway may cap request size | A `.xhtml` over ~100 MB could be refused before reaching the app (not confirmed) | Upload via the local backend; report the exact error |
| Interest coverage ignores capitalised interest | Understates interest during a build-out (Salmon: 36m capitalised) | Not scheduled |
| ESEF notes are only block-tagged; shares outstanding rarely tagged | No per-share value from ESEF alone | — |
| An umbrella fund report adds little excerpt text | The useful part is the holdings schedule | Holdings parser (backlog) |
| Sprint 12's regime classifier is US-only for yield curve + credit spread | Norway's own rate/curve dynamics aren't reflected in those two legs (CPI does use Norway's series) | Needs a Norwegian data source (backlog) |
| Precious metals price history has no backfill | Chart starts empty and grows one point/day (gold-api.com's history endpoint is paid) | Stated plainly in the UI; backlog if a free historical source turns up |
| Precious metals valued at spot only, no numismatic premium | A coin dealer's actual buy/sell price differs from spot by a series-specific premium | Backlog — no free premium data source found yet |
| Demo mode's app-settings migration (`b2c3d4e5f6a7`) not yet verified on real Postgres | Same as the precious metals migration — checked on SQLite only so far | Verify alongside `a74ba6a059dd` when Faiz redeploys |

---

## 5. Changes / history

| Date | Change | Summary | Detail |
|---|---|---|---|
| 2026-09-26 | **Sprint 15: fetch ESEF annual reports straight from Oslo Børs Newsweb (F17)** | New feature, Faiz's direct request: a button on a holding that finds its newest "ANNUAL FINANCIAL REPORT" announcement on Oslo Børs Newsweb, downloads the attachment, unzips it if it's an ESEF package (skipping any bundled iXBRL-viewer copy), and runs the extracted `.xhtml` through the **exact same** ingestion pipeline a manual upload uses — same de-dup, same size cap, same fact extraction, no parallel code path. Records Newsweb's own provenance (message id/url, title, date, attachment) on the resulting Document so re-checking later doesn't re-fetch. New `GET`/`POST /sources/holdings/{id}/newsweb-annual-report[/import]` endpoints, new card in Primary sources. No schema change. 25 new backend tests (905/907 total, same 2 pre-existing env-dependent failures), tsc/eslint/vitest/build clean. Committed locally (`d78a118`), not pushed. **Not yet run against the live Newsweb site** | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Demo mode toggle (F16) — fabricated-data mode for safe demos** | New feature, Faiz's direct request: a Settings-page toggle that, when on, makes every page show a fixed, entirely fabricated portfolio (10 well-known US large-caps — AAPL/MSFT/GOOGL/JNJ/PG/KO/JPM/V/HD/XOM — across 2 fabricated accounts, plus fabricated precious metals, journal, watchlist, macro and risk data) instead of anything real, and blocks every write outright. Enforced structurally, not by output-swapping: every faked `GET` checks `is_demo_mode(db)` as the first statement and returns before the real DB/provider code runs at all; `documents.py`/`sources.py`/`research.py`/`funds.py` are blocked outright (no safe fake exists for real filings/research); every `POST`/`PUT`/`PATCH`/`DELETE` across all 17 routers calls `require_not_demo(db)` first, except the demo-mode setting itself. New `AppSetting` model/table, migration `b2c3d4e5f6a7` (additive). New **Settings** page + nav entry, persistent amber "DEMO MODE" banner on every page while on. 18 new backend tests (881/883 total, same 2 pre-existing env-dependent failures), tsc/eslint/vitest(19)/build clean. Committed locally (`b2778f3`), not pushed | [doc](demo-mode-toggle-2026-09-26.md) |
| 2026-09-26 | **Precious metals tracking (F15) — physical gold/silver coins** | New feature, Faiz's direct request: track 1oz gold/silver coins from the top 15 popular series per metal (Maple Leaf, Krugerrand, Kangaroo, and more), valued at gold-api.com's free spot price converted to NOK. Own table (`PreciousMetalHolding`) — deliberately kept out of the equity-only `Holding` model and out of `PortfolioOverview`'s concentration math, same reasoning as Portfolio risk / Performance getting their own cards. No free historical-price endpoint exists, so the price-development chart accumulates one real point per day rather than backfilling or inventing data — stated plainly in the API's `method_note` and the chart's caption. New migration `a74ba6a059dd` (additive). New **Precious metals** page (add-coin form, holdings table with inline quantity edit, spot/value stat tiles, dual-axis gold/silver price chart), nav entry, dashboard link card. 12 new backend tests (863/865 total, same 2 pre-existing env-dependent failures), tsc/eslint/vitest(19)/build clean. Not yet committed | [doc](precious-metals-tracking-2026-09-26.md) |
| 2026-09-26 | **Live-verified production for the first time this session** | Found the real Railway URLs (frontend `exciting-gratitude-production-71b5`, backend `aladdin-production-bd25` — the old documented backend URL was never provisioned). Opened the live app: Dashboard renders real portfolio data; System status confirms commit `ba4726b` deployed and migration `a3f5c8d1e942` at head, "no configuration problems found." Found two live issues: local PC worker offline since ~07:50, and Gemini daily quota exhausted (0/20) | — |
| 2026-09-26 | **Confirmed both migrations on real Postgres** | Both `c7a1e9f3b2d5` and `a3f5c8d1e942` were found already applied to production Postgres (unexpected — not previously confirmed). Faiz ran a downgrade→upgrade cycle twice against real Supabase Postgres from `E:\Aladdin\backend` — clean, no errors, ended back at head. Note: this required pasting the live `DATABASE_URL` (with password) into chat, since neither the cloud session nor the linked-PC sandbox could reach Postgres' port directly (HTTPS-only egress in both) — flagged in §4 for credential rotation | — |
| 2026-09-26 | **Corrected push status + set up direct GitHub access** | Re-checked `E:\Aladdin` directly (`git status`/`git log`, not the doc): repo is clean, `main` up to date with `origin/main` at `bd342c1` — Sprint 13 (and the docs-sync commit on top of it) was already pushed, contrary to what this page said. Railway auto-deploys on push (confirmed by Faiz). Also attached `frmingest/aladdin` to Claude's GitHub access directly (push scope) at Faiz's request, so future sessions don't need to route git operations through `E:\Aladdin` | — |
| 2026-09-27 | **Sprint 13: portfolio performance over time (F13, backlog 3c)** | Confirmed at session start (via `git status`) that Sprint 11+12 were already pushed to `origin/main` (`cd944a6`) — corrected the stale "not pushed" claim. Then built daily portfolio value history + benchmark comparison: reindexes each holding's today's NOK value backward through its own price/FX history (today's positions held constant) — stated as an approximation, not a real past-transaction P&L, in every response's `method_note`. Reuses Sprint 12's `PriceHistoryObservation` cache as-is for tickers, FX pairs and the benchmark index alike — **no new table, no migration**. Days before every included holding has data are marked `partial` rather than truncating the series. New **Performance** page (cumulative-return chart vs. benchmark, stat tiles, coverage notes), nav entry, dashboard link card. Default benchmark OSEBX.OL. 11 new tests (844/846 backend total, 2 pre-existing unrelated failures), tsc/eslint/vitest/build clean. Committed (`ed9ea03`), pushed | [doc](portfolio-performance-sprint13-2026-09-27.md) |
| 2026-09-26 | **Sprint 12: portfolio risk & regime intelligence (F12)** | Real Pearson correlation matrix from actual fetched 1-year daily price history (not a sector proxy); correlated-cluster flag (\|r\|≥0.6 among the top-10 holdings by weight); portfolio + per-holding drawdown/stress scenarios (DCF bear price when available, else 2σ×√20-day historical volatility); regime classifier (baseline/stagflation/crisis) from US HY spread, US 10y-2y curve, US + Norway CPI, smoothed over a 3-month rolling average so one noisy print can't flip it — explicitly flagged as US-only for the curve/credit legs. New **Portfolio risk** page + dashboard card. Migration `a3f5c8d1e942` (additive, new `price_history_observations` cache table). 29 new backend tests (832/835 total, 3 pre-existing unrelated failures), tsc/eslint/vitest/build clean. Committed (`612bc5a`, `cab8272`), pushed | [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 2026-09-26 | **Sprint 11: thesis tracking, rebuilt for real (F11, decision 25)** | Found at session start that the previously "documented as built" Sprint 11 didn't exist in the repo at all (clean working tree at Sprint 10, no thesis code anywhere) — built it for real. Tripwires (metric·below/above·threshold, metrics from `services/metrics.py`, checked by code, never the LLM); "what changed since the analysis" (age≥180d, new figures/documents, notes edited, price move≥20%, price outside DCF range); verdict timeline from `equity_analysis_runs`; new **Thesis monitor** page, dashboard card, System status row; **Make a tripwire** pattern-matching (no LLM). Also fixed: price shown without a DCF ("No DCF yet" instead of "No price"). Migration `c7a1e9f3b2d5` (additive). 797/800 backend tests pass (3 pre-existing unrelated failures), tsc/eslint/vitest(19)/build clean, no new frontend tests (no component-test harness). Committed (`88e77e2`, `fbb2afe`), pushed | [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 2026-09-25 | **Sprint 10: ESEF history import + large `.xhtml` uploads** | Base64 images/fonts stripped before storing and parsing; duplicate check on the original hash; iXBRL limit 80 → 250 MB. Earlier ESEF reports imported by LEI from filings.xbrl.org as xBRL-JSON. `GET/POST /sources/holdings/{id}/esef-index`, Primary sources card, System status row, evidence packet v7. 744 tests (19 new), 19 vitest (3 new). Committed | [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) |
| 2026-09-25 | **Sprint 9: ROIC / ROE / ROCE + market multiples** | Stores pre-tax profit, tax, leases, minorities, basic EPS and raw materials from ESEF/SEC. Share-count service (manual > SEC cover page > Yahoo 24h > filing). Market cap, owner's-view EV, P/E, P/B, P/S, EV/EBITDA, FCF yield. Evidence packet v6. 725 tests (40 new), 16 vitest (3 new). Committed, pushed | [doc](roic-roe-multiples-sprint9-2026-09-25.md) |
| 2026-09-25 | **Ollama streaming + dark theme + readable analysis** | Ollama passes stream so a slow pass no longer times out. UI: dark theme by default. 683 backend tests (8 new), 13 vitest (7 new). Committed `787cf53`, pushed | [doc](ollama-streaming-dark-theme-2026-09-25.md) |
| 2026-09-24 | **Sprint 7: guardrail tooling (+ F4 smoke test)** | CI on every push/PR; pre-commit ruff/gitleaks/file checks; read-only Playwright smoke test. Committed `f81a824`, pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) §5 |
| 2026-09-24 | **Numeric macro data: Norges Bank, SSB, FRED (F10, decision 24)** | 13 series + real policy rates and NO−US 10y. Migration `a9b0c1d2e3f4` (additive). 678 tests (29 new). Committed `c4b2ed2`, `551a141`, pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) |
| 2026-09-24 | **Sprint 8: fund & ETF analysis (F9)** | New type `equity_fund`; Fund facts typed in or CSV-imported, never read by an LLM. Migration `f8a9b0c1d2e3` (additive). 649 tests (30 new). Committed `8847311`, pushed | [doc](fund-etf-analysis-sprint8-2026-09-24.md) |
| 2026-09-24 | **Sprint 6: uploaded document text in the analysis** | Section-aware chunking; deterministic scoring within a token budget. Evidence packet v4. 619 tests (33 new). Committed `71ec23b`, pushed | [doc](evidence-quality-sprint6-2026-09-24.md) |
| 2026-09-23 | **Sprint 5B: local LLM from Railway (F8) + overnight queue (F5)** | **Run on my PC** queues a run; PC worker claims it. Migration `e6f7a8b9c0d1` (additive). 586 tests (29 new). Committed `18e8a4e`, pushed | [doc](local-worker-queue-sprint5b-2026-09-23.md) |
| 2026-09-23 | **Dashboard, System status, Watchlist, Decision journal** | New home Dashboard, System status page (F4), Watchlist (F7), Decision journal (F6). 557 tests (41 new). Committed `bc4de0c`…`bc28502`, pushed | [doc](dashboard-status-watchlist-journal-2026-09-23.md) |
| 2026-09-23 | **Known issues reviewed with Faiz** | Closed without code; Railway ↔ local LLM planned as Sprint 5B / F8. Docs only | [plan](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §1, §3 |
| 2026-09-23 | **Owner's-view metric definitions** | Hybrid capital counted as debt; FCF/owner earnings net of decommissioning, financing interest, leases, hybrid coupons. Evidence packet v3. Committed `34beec7`, pushed | [doc](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §2 |
| 2026-09-23 | **LLM & technology overview** | New doc: the 3 places an LLM is used. Docs only | [doc](llm-and-technology-overview.md) |
| 2026-09-23 | **FY2025 uploads checked against published reports** | Raw figures match; definition gaps found and proposed. Docs only | [doc](fy2025-uploads-external-validation-2026-09-23.md) |
| 2026-09-23 | **Upload validation (Vår Energi) + deletes** | 5 mapping fixes; statement integrity checks; new cascade/clean-slate deletes. 504 tests (18 new). Committed `be4b7e7`, pushed | [doc](upload-validation-var-energi-and-deletes-2026-09-23.md) |
| 2026-09-23 | **Reverted: LLM PDF figure extraction** | Faiz decided against it. `8e1c1fb` reverts `9a0db96`. Pushed | — |
| 2026-09-23 | **Uploads: ESEF `.xhtml` + CSV statements** | New inline-XBRL parser; statement-table parser for IR CSV/Excel. 486 tests (63 new). Committed `2e49de7`, pushed | [doc](financial-statement-uploads-xhtml-csv-2026-09-23.md) |
| 2026-09-23 | **Ollama set up on Faiz's PC — verified** | Readiness shows "Ollama reachable, model 'qwen3:14b' available". Docs only | [guide](local-llm-ollama-setup.md) |
| 2026-09-23 | **Local LLM engine + ticker decision + UI tweaks** | New `OllamaProvider`; ticker rule decided (home-exchange Yahoo symbol). 423 tests (20 new). Committed, pushed | [doc](local-llm-tickers-ui-2026-09-23.md) · [guide](local-llm-ollama-setup.md) |
| 2026-09-22 | **F3 Margin-of-safety board** | New `GET /valuation/board`. 403 tests (11 new). Committed, pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **F1 Analysis view + F2 Readiness check (Sprint 4 closed)** | New `GET /analysis/holdings/{id}/readiness`. 392 tests (28 new). Committed, pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Feature plan + progress.md restructure** | Docs only, no code | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Primary sources: SEC EDGAR + Newsweb** | EDGAR annual facts saved with filing provenance. 364 tests (31 new). Pushed | [doc](primary-sources-sec-edgar-newsweb-2026-09-22.md) |
| 2026-09-22 | Setup checklist confirmed | Pushed and redeployed, 5 CSVs re-uploaded, Gemini and FRED keys set. Docs only | [doc](free-market-data-research-providers-2026-09-21.md) |
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
