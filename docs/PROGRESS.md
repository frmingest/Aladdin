# Aladdin — Progress

Quick-glance tracker. Detail for each item lives in its own linked doc; this page stays short tables only.

**Last updated:** 2026-09-27

---

## 1. Where we are right now

| | |
|---|---|
| **Current phase** | Phase 11: the Buffett/Munger single-focus rebuild ([sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md)) |
| **Sprints closed** | 0, 1, 2, 3, 4, 5, 5B, 6, 7, 8, 9, 10, 11, 12, **13** |
| **In progress** | Nothing open. **Built today:** Sprint 13 — portfolio performance over time (backlog 3c). Sprint 11+12 confirmed pushed to `origin/main` this session (see below). Next: pick another backlog item (3c) |
| **Latest build** | Sprint 13: **1 commit on `E:\Aladdin`, local only, not pushed** (`ed9ea03`). `origin/main` is now Sprint 12 (`cd944a6`) — Sprint 11+12 confirmed pushed this session (`git status` showed "up to date with origin/main" before Sprint 13 started) |
| **Tests** | Sprint 13: 844/846 backend pass (11 new, same 2 of the 3 previously-noted pre-existing failures — `test_factory.py`'s LLM provider default, env-dependent). tsc/eslint/vitest(19)/build clean. **No schema change this sprint** — reuses Sprint 12's `PriceHistoryObservation` cache as-is, so there's no new migration to verify |
| **Live-verified?** | ❌ Nothing checked live this session. Railway deploy status from 2026-09-25 stands: the documented URLs answered "not provisioned" |

> ⚠️ **Correction found and fixed 2026-09-26:** this page previously said Sprint 11 was "written... as
> uncommitted changes." That was false — nothing had actually been written to `E:\Aladdin`; the repo
> was clean at Sprint 10 with no thesis code anywhere. Caught at the start of today's session,
> confirmed by `git status`/`git log` that session, and rebuilt for real. See
> [thesis-tracking-sprint11-2026-09-26.md](thesis-tracking-sprint11-2026-09-26.md) for the full
> correction note. Going forward: don't trust a prior session's "built" claim without checking
> `git status`/`git log` in the current session first (this is also now explicit in CLAUDE.md).

---

## 2. Needs from Faiz

| # | Action | Why |
|---|---|---|
| ★★ | **Commit review + push.** 5 new local commits on `E:\Aladdin` (Sprint 11, 12, 13) sit on top of what's pushed. Sprint 11+12 confirmed already pushed to `origin/main` this session (`cd944a6`) — Sprint 13 (`ed9ea03`) is the one still local. Review in GitHub Desktop, push, then redeploy | Nothing from Sprint 13 is on GitHub or Railway yet |
| ★★ | **Run both new migrations against real Postgres**, in order: `c7a1e9f3b2d5` (thesis_tripwires) then `a3f5c8d1e942` (price_history_observations) — `alembic upgrade head`, `downgrade -1` ×2, `upgrade head` again. Only verified on SQLite so far (no Postgres in the build sandbox) | Same up/down/up rigor as every other migration, just not yet done for these two |
| ★ | After deploy: open **Performance** in the nav. Check whether the reindexed value history looks right against what you remember, and whether OSEBX.OL is the benchmark you want (or a different/blended one) | First real use of Sprint 13 — [doc](portfolio-performance-sprint13-2026-09-27.md) §6 |
| ★ | After deploy: open a holding with an analysis → **Thesis tracking** → **Make a tripwire** on 2–3 invalidation triggers; open **Thesis monitor**. Tell me which triggers pre-filled badly, and whether 180 days / 20% feel right | First real use of Sprint 11 — [doc](thesis-tracking-sprint11-2026-09-26.md) §8 |
| ★ | After deploy: open **Portfolio risk** in the nav. Check the correlation matrix against holdings you'd expect to move together, look at any cluster flag, and check today's regime reading. Say if the \|r\|≥0.6 cluster threshold or the 2σ/20-day stress sizing feel too aggressive or too tame | First real use of Sprint 12 — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) §5 |
| ★ | **Which Railway URL is live?** `https://aladdin-backend.up.railway.app` returned "domain not provisioned" as of 2026-09-25. Check Railway → Settings → Networking | Nothing can be live-verified until the URL is known |
| ★ | After the deploy: upload `Orklaasa-2025-12-31-1-no.xhtml` again: expect a note *"… embedded images/fonts removed on upload"* | Large ESEF uploads (Sprint 10) — [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) §1 |
| ★ | On Vår Energi, Salmon Evolution and Orkla: **Primary sources → Earlier annual reports → Import history**. Tell me the years imported and any warnings | First real run of the ESEF history import — [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) §5 |
| ★ | After the deploy: **delete and re-upload** the Vår Energi and Salmon Evolution `.xhtml` files, then open each holding's **Market multiples** card and check the share count. Vår's IR page says **2,496,406,246** shares (24 Sep 2026); if Yahoo differs, use **Enter share count** | Tax, leases and EPS are only stored on extraction; the share count feeds the DCF too |
| ★ | Restart the local backend and the PC worker (new Ollama timeouts load on start). Set Windows user variable `OLLAMA_NUM_PARALLEL=1` and restart Ollama. During a pass, `ollama ps` should say `100% GPU` | Fixes the "blind pass failed: Ollama timed out" runs — [doc](ollama-streaming-dark-theme-2026-09-25.md) §1 |
| ★ | Look through the app in the **dark theme** and say what still reads badly | [doc](ollama-streaming-dark-theme-2026-09-25.md) §2–3 |
| ★ | After deploy: **Macro → Refresh data** (expect updates; US series fail = `FRED_API_KEY` missing in Railway). Restart the PC worker | First real Norges Bank / SSB / FRED fetch |
| ★ | GitHub → Settings → Actions → **Variables** `SMOKE_FRONTEND_URL`, `SMOKE_API_URL`; then run the **Smoke test** workflow | Post-deploy check (F4) |
| ★ | Once on the PC: `pip install -r backend\requirements-dev.txt`, then `pre-commit install` in `E:\Aladdin`. Later: require CI on `main` (branch protection) | Hooks run on every commit, CI on every push |
| ★ | **Rotate credentials** pasted into chat on 2026-09-23: Supabase DB password + storage S3 keys, Google AI Studio, Mistral, FRED keys — then update `backend/.env` and Railway | They're in a chat transcript |
| ★ | Railway Variables: `LLM_PROVIDER=google_ai_studio` (or unset), `LLM_FALLBACK_PROVIDER=none` | Railway can't reach Ollama on your PC |
| ★ | Fix the 1 remaining readiness blocker on the first holding, then run the first local analysis | First real run on the local LLM |
| ★ | Change Vår Energi's ticker `VARRY` → **`VAR.OL`**; fix sectors: Xetra-Gold + L&G Gold Mining → Materials, Salmon Evolution → Consumer Staples | [ticker decision](local-llm-tickers-ui-2026-09-23.md#2-ticker-convention--decision) |
| ★ | Redeploy covers Sprint 8 too (migration `f8a9b0c1d2e3`, 3 fund tables). If Railway sets `ACTIVE_ANALYSIS_PROMPT_VERSION=v1`, remove it | Fund facts + fund analysis — [doc](fund-etf-analysis-sprint8-2026-09-24.md) |
| ★ | **Set up your funds:** tag Heimdal Utbytte A as **Equity fund**; upload each fund's fact sheet; fill in Fund facts; run the analysis | First real fund analysis — [doc](fund-etf-analysis-sprint8-2026-09-24.md) §7 |
| ★ | **Start the worker on the PC**: `python -m app.worker` (or `scripts\start-worker.ps1`). Then **Run on my PC** on a holding from the Railway site | First real local run started from Railway — [guide](local-llm-ollama-setup.md) |
| ★ | After the deploy, open **System status** and fix anything under *Needs attention* | Replaces items 1–3 below |
| ★ | Upload the **ESEF annual report `.xhtml`** for each Oslo holding (2 years each gives 3 years of history) | [upload doc](financial-statement-uploads-xhtml-csv-2026-09-23.md) |
| 1 | Set `MARKET_DATA_PROVIDER=yfinance` and `RESEARCH_PROVIDER=gemini_search` in **Railway** | The analysis engine can't produce real output while these are `stub` |
| 2 | Add `SEC_EDGAR_USER_AGENT` in **Railway** | SEC requires a contact email |
| 3 | Confirm Railway is running the latest commit | System status shows the commit + DB migration |
| 4 | Try "Import from SEC EDGAR" on a US holding, and open an Oslo holding's announcements | First live test of both sources |
| 5 | Open an equity holding, check the Readiness card, then click **Run analysis** | First real signal on prompt quality, cost and usefulness |
| 6 | Open **Margin of safety** in the nav | First real ranking |
| 7 | Try **Dashboard**, **Watchlist** and **Journal** | First real use |
| 7b | On a US holding, run **Import from SEC EDGAR** again | Saves the SEC cover-page share count |
| 8 | Upload an annual report, run an analysis and open the **document excerpt** group | First real check of Sprint 6 — [doc](evidence-quality-sprint6-2026-09-24.md) §6 |
| 9 | Review `analysis_schema/v1.py` and `prompts/analysis/*_v2.md` | Once a real run uses v1, any change needs a new version file (CLAUDE.md Rule 3) |

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
| F13 | **Portfolio performance over time** | Both | Daily portfolio value history + benchmark comparison, reindexed from today's positions | Sprint 13 | ✅ Built and committed 2026-09-27 (`ed9ea03`) — [doc](portfolio-performance-sprint13-2026-09-27.md) |

### 3b. Sprint status

| Sprint | Scope | Status |
|---|---|---|
| 0 | Guardrails, schema mapping, skeleton backend/frontend, Gemini + Mistral wiring | ✅ Closed |
| 1 | Equity data model, deterministic calculations, document ingestion, first pages | ✅ Closed |
| 2 | Live evidence-first research (macro, sector, company) | ✅ Closed |
| 3 | Valuation engine: DCF, reverse DCF, multiples + UI | ✅ Closed |
| 4 | Two-pass Buffett/Munger analysis engine + analysis view (F1) + readiness (F2) | ✅ Closed |
| 5 | Portfolio roll-up and dashboard (+ F3) | ✅ Closed 2026-09-23 |
| 5B | Local LLM from Railway + overnight queue (F8 + F5) | ✅ Built 2026-09-23 (`18e8a4e`, not deployed) |
| 6 | Evidence quality (section-aware chunking, evidence budget) | ✅ Built 2026-09-24 (`71ec23b`, not deployed) |
| 7 | Guardrail tooling: pre-commit, CI, secret scanning (+ F4 smoke test) | ✅ Built 2026-09-24 (`f81a824`, not pushed) |
| 8 | Fund & ETF analysis (F9, decision 23) | ✅ Built 2026-09-24 (`8847311`, pushed, not deployed) |
| — | Numeric macro data (F10, decision 24) | ✅ Built 2026-09-24 (`c4b2ed2`, `551a141`, not pushed) |
| 9 | ROIC / ROE / ROCE + market multiples with share counts | ✅ Built 2026-09-25 (`0b05364`, pushed, not deployed) |
| 10 | ESEF history import (layer D) + large `.xhtml` uploads | ✅ Built 2026-09-25 (`176721f`, pushed, not deployed) |
| 11 | Thesis tracking over time (F11, decision 25) + price without a DCF | ✅ **Actually** built 2026-09-26 (`88e77e2` backend, `fbb2afe` frontend; **not pushed**). Migration `c7a1e9f3b2d5`, verified on SQLite only — [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 12 | Portfolio risk & regime intelligence (F12) | ✅ Built 2026-09-26 (`612bc5a` backend, `cab8272` frontend; **not pushed**). Migration `a3f5c8d1e942`, verified on SQLite only — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 13 | Portfolio performance over time (F13, backlog 3c) | ✅ Built 2026-09-27 (`ed9ea03`; **not pushed**). No schema change — reuses Sprint 12's `PriceHistoryObservation` cache as-is — [doc](portfolio-performance-sprint13-2026-09-27.md) |
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

### 3d. Free data sources

| Source | Covers | Status |
|---|---|---|
| SEC EDGAR (XBRL company facts) | US financials, citation-grade | ✅ Built 2026-09-22 |
| Oslo Børs Newsweb | Oslo regulated announcements | ✅ Built 2026-09-22 |
| filings.xbrl.org (ESEF index) | Oslo filing history FY2020–FY2024, xBRL-JSON | ✅ Built 2026-09-25 (Sprint 10) |
| yfinance share count · SEC `dei` shares | Shares outstanding for multiples + DCF | ✅ Built 2026-09-25 (Sprint 9) |
| yfinance daily price history | Correlation + stress sizing (Sprint 12), cached in `price_history_observations` | ✅ Built 2026-09-26 (Sprint 12) |
| Brønnøysundregistrene | Norwegian entity data and annual accounts | Nice to have |
| VFF (vff.no) | Norwegian fund NAVs (Alfred Berg, Heimdal) | Needs a look |
| World Bank / OECD / IMF, GDELT | Global macro, news sentiment | Low |
| FMP / Finnhub free tiers | Mostly paywalled | Not recommended |

Detail: [free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md)

---

## 4. Known issues

| Issue | Impact | Fix |
|---|---|---|
| Neither Sprint 11 nor Sprint 12's migration has run on real Postgres | Both only verified up/down/up on SQLite (no Postgres in the build sandbox) | Run both against real Postgres before trusting in production — see §2 |
| Gemini quota counter is in-memory | Resets on every server/worker restart | LLM usage ledger (backlog) |
| No GitHub push credentials in any session shell | Faiz pushes manually | Needs a PAT or credential helper from Faiz |
| gitleaks pre-commit hook builds with Go | First `pre-commit install` run is slow | Expected; CI uses the prebuilt binary |
| Uploads from before Sprint 9 lack tax, leases and EPS | ROIC shows "missing: income_tax_expense" until re-uploaded | Delete + re-upload |
| Multiples history uses today's FX rate when none is stored near a year end | Older years' P/E for Vår carry today's NOK/USD | Historical FX backfill (backlog) |
| Metrics panel in the screenshots still shows pre-`34beec7` figures | Owner's-view numbers not applied on that instance | Delete + re-upload the `.xhtml` files |
| Railway may cap request size | A `.xhtml` over ~100 MB could be refused before reaching the app (not confirmed) | Upload via the local backend; report the exact error |
| Interest coverage ignores capitalised interest | Understates interest during a build-out (Salmon: 36m capitalised) | Not scheduled |
| ESEF notes are only block-tagged; shares outstanding rarely tagged | No per-share value from ESEF alone | — |
| An umbrella fund report adds little excerpt text | The useful part is the holdings schedule | Holdings parser (backlog) |
| Sprint 12's regime classifier is US-only for yield curve + credit spread | Norway's own rate/curve dynamics aren't reflected in those two legs (CPI does use Norway's series) | Needs a Norwegian data source (backlog) |

---

## 5. Changes / history

| Date | Change | Summary | Detail |
|---|---|---|---|
| 2026-09-27 | **Sprint 13: portfolio performance over time (F13, backlog 3c)** | Confirmed at session start (via `git status`) that Sprint 11+12 were already pushed to `origin/main` (`cd944a6`) — corrected the stale "not pushed" claim. Then built daily portfolio value history + benchmark comparison: reindexes each holding's today's NOK value backward through its own price/FX history (today's positions held constant) — stated as an approximation, not a real past-transaction P&L, in every response's `method_note`. Reuses Sprint 12's `PriceHistoryObservation` cache as-is for tickers, FX pairs and the benchmark index alike — **no new table, no migration**. Days before every included holding has data are marked `partial` rather than truncating the series. New **Performance** page (cumulative-return chart vs. benchmark, stat tiles, coverage notes), nav entry, dashboard link card. Default benchmark OSEBX.OL. 11 new tests (844/846 backend total, 2 pre-existing unrelated failures), tsc/eslint/vitest/build clean. Committed locally (`ed9ea03`), **not pushed** | [doc](portfolio-performance-sprint13-2026-09-27.md) |
| 2026-09-26 | **Sprint 12: portfolio risk & regime intelligence (F12)** | Real Pearson correlation matrix from actual fetched 1-year daily price history (not a sector proxy); correlated-cluster flag (\|r\|≥0.6 among the top-10 holdings by weight); portfolio + per-holding drawdown/stress scenarios (DCF bear price when available, else 2σ×√20-day historical volatility); regime classifier (baseline/stagflation/crisis) from US HY spread, US 10y-2y curve, US + Norway CPI, smoothed over a 3-month rolling average so one noisy print can't flip it — explicitly flagged as US-only for the curve/credit legs. New **Portfolio risk** page + dashboard card. Migration `a3f5c8d1e942` (additive, new `price_history_observations` cache table). 29 new backend tests (832/835 total, 3 pre-existing unrelated failures), tsc/eslint/vitest/build clean. Committed locally (`612bc5a`, `cab8272`), **not pushed**. Migration verified on SQLite only, not Postgres | [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 2026-09-26 | **Sprint 11: thesis tracking, rebuilt for real (F11, decision 25)** | Found at session start that the previously "documented as built" Sprint 11 didn't exist in the repo at all (clean working tree at Sprint 10, no thesis code anywhere) — built it for real. Tripwires (metric·below/above·threshold, metrics from `services/metrics.py`, checked by code, never the LLM); "what changed since the analysis" (age≥180d, new figures/documents, notes edited, price move≥20%, price outside DCF range); verdict timeline from `equity_analysis_runs`; new **Thesis monitor** page, dashboard card, System status row; **Make a tripwire** pattern-matching (no LLM). Also fixed: price shown without a DCF ("No DCF yet" instead of "No price"). Migration `c7a1e9f3b2d5` (additive). 797/800 backend tests pass (3 pre-existing unrelated failures), tsc/eslint/vitest(19)/build clean, no new frontend tests (no component-test harness). Committed locally (`88e77e2`, `fbb2afe`), **not pushed**. Migration verified on SQLite only, not Postgres | [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 2026-09-25 | **Sprint 10: ESEF history import + large `.xhtml` uploads** | Base64 images/fonts stripped before storing and parsing; duplicate check on the original hash; iXBRL limit 80 → 250 MB. Earlier ESEF reports imported by LEI from filings.xbrl.org as xBRL-JSON. `GET/POST /sources/holdings/{id}/esef-index`, Primary sources card, System status row, evidence packet v7. 744 tests (19 new), 19 vitest (3 new). Committed | [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md) |
| 2026-09-25 | **Sprint 9: ROIC / ROE / ROCE + market multiples** | Stores pre-tax profit, tax, leases, minorities, basic EPS and raw materials from ESEF/SEC. Share-count service (manual > SEC cover page > Yahoo 24h > filing). Market cap, owner's-view EV, P/E, P/B, P/S, EV/EBITDA, FCF yield. Evidence packet v6. 725 tests (40 new), 16 vitest (3 new). Committed, not pushed | [doc](roic-roe-multiples-sprint9-2026-09-25.md) |
| 2026-09-25 | **Ollama streaming + dark theme + readable analysis** | Ollama passes stream so a slow pass no longer times out. UI: dark theme by default. 683 backend tests (8 new), 13 vitest (7 new). Committed `787cf53`, not pushed | [doc](ollama-streaming-dark-theme-2026-09-25.md) |
| 2026-09-24 | **Sprint 7: guardrail tooling (+ F4 smoke test)** | CI on every push/PR; pre-commit ruff/gitleaks/file checks; read-only Playwright smoke test. Committed `f81a824`, not pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) §5 |
| 2026-09-24 | **Numeric macro data: Norges Bank, SSB, FRED (F10, decision 24)** | 13 series + real policy rates and NO−US 10y. Migration `a9b0c1d2e3f4` (additive). 678 tests (29 new). Committed `c4b2ed2`, `551a141`, not pushed | [doc](macro-data-and-guardrails-sprint7-2026-09-24.md) |
| 2026-09-24 | **Sprint 8: fund & ETF analysis (F9)** | New type `equity_fund`; Fund facts typed in or CSV-imported, never read by an LLM. Migration `f8a9b0c1d2e3` (additive). 649 tests (30 new). Committed `8847311`, not pushed | [doc](fund-etf-analysis-sprint8-2026-09-24.md) |
| 2026-09-24 | **Sprint 6: uploaded document text in the analysis** | Section-aware chunking; deterministic scoring within a token budget. Evidence packet v4. 619 tests (33 new). Committed `71ec23b`, not pushed | [doc](evidence-quality-sprint6-2026-09-24.md) |
| 2026-09-23 | **Sprint 5B: local LLM from Railway (F8) + overnight queue (F5)** | **Run on my PC** queues a run; PC worker claims it. Migration `e6f7a8b9c0d1` (additive). 586 tests (29 new). Committed `18e8a4e`, not pushed | [doc](local-worker-queue-sprint5b-2026-09-23.md) |
| 2026-09-23 | **Dashboard, System status, Watchlist, Decision journal** | New home Dashboard, System status page (F4), Watchlist (F7), Decision journal (F6). 557 tests (41 new). Committed `bc4de0c`…`bc28502`, not pushed | [doc](dashboard-status-watchlist-journal-2026-09-23.md) |
| 2026-09-23 | **Known issues reviewed with Faiz** | Closed without code; Railway ↔ local LLM planned as Sprint 5B / F8. Docs only | [plan](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §1, §3 |
| 2026-09-23 | **Owner's-view metric definitions** | Hybrid capital counted as debt; FCF/owner earnings net of decommissioning, financing interest, leases, hybrid coupons. Evidence packet v3. Committed `34beec7`, not pushed | [doc](owner-view-metrics-and-local-worker-plan-2026-09-23.md) §2 |
| 2026-09-23 | **LLM & technology overview** | New doc: the 3 places an LLM is used. Docs only | [doc](llm-and-technology-overview.md) |
| 2026-09-23 | **FY2025 uploads checked against published reports** | Raw figures match; definition gaps found and proposed. Docs only | [doc](fy2025-uploads-external-validation-2026-09-23.md) |
| 2026-09-23 | **Upload validation (Vår Energi) + deletes** | 5 mapping fixes; statement integrity checks; new cascade/clean-slate deletes. 504 tests (18 new). Committed `be4b7e7`, not pushed | [doc](upload-validation-var-energi-and-deletes-2026-09-23.md) |
| 2026-09-23 | **Reverted: LLM PDF figure extraction** | Faiz decided against it. `8e1c1fb` reverts `9a0db96`. Not pushed | — |
| 2026-09-23 | **Uploads: ESEF `.xhtml` + CSV statements** | New inline-XBRL parser; statement-table parser for IR CSV/Excel. 486 tests (63 new). Committed `2e49de7`, not pushed | [doc](financial-statement-uploads-xhtml-csv-2026-09-23.md) |
| 2026-09-23 | **Ollama set up on Faiz's PC — verified** | Readiness shows "Ollama reachable, model 'qwen3:14b' available". Docs only | [guide](local-llm-ollama-setup.md) |
| 2026-09-23 | **Local LLM engine + ticker decision + UI tweaks** | New `OllamaProvider`; ticker rule decided (home-exchange Yahoo symbol). 423 tests (20 new). Committed locally, not pushed | [doc](local-llm-tickers-ui-2026-09-23.md) · [guide](local-llm-ollama-setup.md) |
| 2026-09-22 | **F3 Margin-of-safety board** | New `GET /valuation/board`. 403 tests (11 new). Committed locally, not pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **F1 Analysis view + F2 Readiness check (Sprint 4 closed)** | New `GET /analysis/holdings/{id}/readiness`. 392 tests (28 new). Committed locally, not pushed | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Feature plan + progress.md restructure** | Docs only, no code | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Primary sources: SEC EDGAR + Newsweb** | EDGAR annual facts saved with filing provenance. 364 tests (31 new). Not pushed | [doc](primary-sources-sec-edgar-newsweb-2026-09-22.md) |
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
