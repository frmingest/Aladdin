# Aladdin — Progress

Quick-glance tracker. Detail for each item lives in its own linked doc; this page stays short tables only.

**Last updated:** 2026-09-27

---

## 1. Where we are right now

| | |
|---|---|
| **Current phase** | Phase 11: the Buffett/Munger single-focus rebuild ([sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md)) |
| **Sprints closed** | 0, 1, 2, 3, 4, 5, 5B, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 |
| **In progress** | Nothing uncommitted right now. The backend API-key gate + CORS lockdown is committed, pushed and was confirmed live and enforcing earlier today — but a **follow-up check found it flapping** (some endpoints 401, some 200, same unauthenticated request pattern) — see §2/§4 and [doc](api-key-gate-flapping-2026-09-27.md). Next up is whatever Faiz picks from §2/§3c |
| **Live URLs** | Frontend: `https://exciting-gratitude-production-71b5.up.railway.app` · Backend: `https://aladdin-production-bd25.up.railway.app` — found 2026-09-26 (old backend URL in earlier notes, `aladdin-backend.up.railway.app`, was never provisioned — this is the real one) |
| **Latest build** | **Backend API-key gate + CORS lockdown** (2026-09-27, pushed) — `ApiKeyMiddleware` (new `backend/app/security.py`) requires `X-API-Key` matching `APP_AUTH_TOKEN`; `CORS_ALLOWED_ORIGINS` replaces `allow_origins=["*"]`. Confirmed live and enforcing once, then found **inconsistently enforcing** on a later check the same day — see [doc](api-key-gate-flapping-2026-09-27.md). Before that: **local LLM fund/ETF output-limit fix**, **"Queue all ready holdings" scope picker** and **5 UI/UX requests** — see §5 |
| **GitHub access** | Claude has direct push/PR access to `frmingest/aladdin`. **`E:\Aladdin` confirmed back in sync with `origin/main` (`f746a3e`)** as of 2026-09-27 — clean working tree, no stale lock file found. Railway auto-deploys on every push to `main`, confirmed by Faiz |
| **Migrations on real Postgres** | ✅ **Confirmed 2026-09-26** for `c7a1e9f3b2d5`, `a3f5c8d1e942`, `a74ba6a059dd` (precious metals) and **`b2c3d4e5f6a7`** (app settings / demo mode) — all four ran clean on the redeploy. Sprint 15 (Newsweb fetch), the mobile responsiveness pass, the interim-report fetch, real-return reporting, the object-storage move, the UI polish batch, the queue-scope picker, the LLM output-limit fix and the API-key gate have **no migration** |
| **Tests** | API-key gate: 940 backend total, 939 pass (6 net new; 1 pre-existing unrelated failure, confirmed on unmodified `main` too). Frontend tsc/eslint/vitest(19/19)/build all clean. Local LLM fund output-limit fix: 932 backend total, 932 pass (6 net new; same 2 pre-existing, environment-only failures — `test_factory.py`, local `.env` selects Ollama). Newsweb interim attachment-picking fix: 928 backend total, 927 pass. Real-return reporting: 924 backend total, 4 net new. Newsweb interim/half-year fetch: 921 total, 920 pass. Newsweb "fetch every year" extension: 907/908 pass. Demo-mode hotfix: 906/907 pass. Sprint 15: 905/907 pass |
| **Live-verified?** | ✅ **Partially** — dashboard load and most endpoints verified live 2026-09-27, but the API-key gate itself is currently **flapping in production** (see above) — not a clean "yes" until Faiz confirms only one backend deployment is active and both settings match. Real-return reporting, Sprint 15's Newsweb fetch, the mobile responsiveness pass, the interim-report fetch (F19), the UI polish batch, the queue-scope picker and the LLM output-limit fix have **not yet been checked live** — see §2 |
| **Regime-adjusted DCF (Sprint 14)** | Built, off by default (`REGIME_ADJUSTED_DCF_ENABLED=false`). Nothing changes until Faiz sets it to `true` in Railway — see §2 |
| **Economic/mathematical review** | ✅ **Done 2026-09-26.** DCF, CAPM, regime classifier, correlation/stress and all ratio math read line-by-line against what an economist would check for an investment-grade tool — **verdict: sound, no incorrect formulas or unsound logic found.** Known simplifications turned into backlog candidates. See [sprint15-plan-and-quarterly-review-2026-09-26.md](sprint15-plan-and-quarterly-review-2026-09-26.md) §1 |
| **Project-doc cleanup** | ✅ **Done 2026-09-26.** 33 stale pre-rebuild docs deleted; one (`cwo-design-redesign.md`) flagged as possibly misfiled, left for Faiz to confirm. See [sprint15-plan-and-quarterly-review-2026-09-26.md](sprint15-plan-and-quarterly-review-2026-09-26.md) §4 |
| **Agentic-coding audit** | ✅ **Done 2026-09-27.** Full sweep of backend/frontend/CI for LLM-assisted-dev risk (guardrail drift, spaghetti files, prompt-injection exposure, security gaps). Verdict: well-guardrailed overall; CLAUDE.md's rules actually hold up in code. Two real gaps found — **no auth + wide-open CORS on a publicly deployed backend handling real financial data**, and a **documented `APP_AUTH_TOKEN` gate that was never implemented on either side** — plus the `docs/PROGRESS.md`/project-doc drift noted in the correction block below. See [agentic-coding-audit-2026-09-27.md](agentic-coding-audit-2026-09-27.md) |

> ⚠️ **Correction found and fixed 2026-09-26:** this page previously said Sprint 11 was "written... as
> uncommitted changes." That was false. See [thesis-tracking-sprint11-2026-09-26.md](thesis-tracking-sprint11-2026-09-26.md)
> for the full correction note. Going forward: don't trust a prior session's "built" or "uncommitted"
> claim without checking `git status`/`git log` in the current session first (this is also now
> explicit in CLAUDE.md). **Reconfirmed 2026-09-27:** this page also had the queue-scope picker and UI
> polish batch marked "not yet committed" when both were, in fact, already on `origin/main` — corrected
> in this update after checking `git log`/`git status` directly against the real remote.

> ⚠️ **Drift found and fixed 2026-09-27 (agentic-coding audit):** this repo copy had fallen behind the
> Claude project's `progress.md` — it still showed the queue-scope-picker/UI-polish batch as
> "uncommitted" and the local clone as "behind `origin/main`," both already corrected there days
> earlier. Synced in this update — see [agentic-coding-audit-2026-09-27.md](agentic-coding-audit-2026-09-27.md) §3.

> ⚠️ **Drift found and fixed 2026-09-27 (live verification):** this page said the API-key gate/CORS
> lockdown was still inert (env vars unset) and that `E:\Aladdin` was a commit behind with a stale lock
> file. Checked directly against production and the local clone: the gate is **already live and
> enforcing** (someone set `APP_AUTH_TOKEN`/`VITE_API_KEY` in Railway without updating this page), and
> `E:\Aladdin` is clean and in sync with `origin/main`. Corrected throughout this update — see
> [live-verification-2026-09-27.md](live-verification-2026-09-27.md).

> ⚠️ **Found 2026-09-27 (later same day): the gate is now flapping.** A follow-up check — prompted by
> Faiz seeing "Missing or invalid API key" pervasively in the live app — found `/holdings` and
> `/portfolio/overview` returning 200 with no auth header while `/macro/indicators` returned 401 for
> the same unauthenticated pattern, moments apart. `ApiKeyMiddleware` treats every non-`/health` path
> identically, so this isn't a code bug — it's the signature of more than one backend instance live at
> once with different `APP_AUTH_TOKEN` state (a Railway rolling deploy still mid-rollout, or an env var
> edit not yet picked up by every instance). See [doc](api-key-gate-flapping-2026-09-27.md) for the
> checks and what Faiz should do in the Railway dashboard.

---

## 2. Needs from Faiz

Going through this list point by point with Faiz (started 2026-09-26).

| # | Action | Why | Status |
|---|---|---|---|
| ★★★ | **Check Railway's Deployments tab for the backend service** — confirm only one deployment is active, and that `APP_AUTH_TOKEN` matches the frontend's `VITE_API_KEY` exactly. If more than one deployment is live, wait for it to settle or trigger a fresh redeploy | The gate was seen flapping (200 on some endpoints, 401 on others, both with no auth header) right after being confirmed live and enforcing — see [doc](api-key-gate-flapping-2026-09-27.md) | **Open — blocking, causing the "Missing or invalid API key" errors Faiz is seeing** |
| ★ | **Confirm `SMOKE_API_KEY` is set as a GitHub Actions secret** (repo → Settings → Secrets and variables → Actions) | Only remaining unverified piece of the backend auth/CORS gate itself, separate from the flapping issue above — see [doc](live-verification-2026-09-27.md) | Open |
| ★★ | **Try the new "Queue all ready holdings" popup** on the Analysis queue page | Now committed and pushed — first look | Open |
| ★★ | **Review today's 5 UI/UX changes** (grouped sidebar, analysis-queue progress/ETA, correlation-matrix names, genie-bottle logo, collapsible Holdings sections) | Now committed and pushed — first look | Open |
| ★★ | **Try the real (CPI-adjusted) return toggle on Performance**: open **Performance**, tick "Show real (CPI-adjusted) return" above the chart. If it's greyed out, run **Macro → Refresh data** first — the toggle needs at least one stored Norway CPI observation to compute a deflator | First live check of the new real-return overlay | Open |
| ★★★ | **Click "Fetch all reports" on Kongsberg Gruppen (KOG.OL)** — now a single button at the top of the page that fetches both annual and half-year reports together | First real test of the unified button, and of the interim path with the presentation-vs-report fix in place | **Open — see [doc](newsweb-interim-report-kongsberg-bug-2026-09-27.md)** |
| ★★ | **Try the mobile fix on your phone**: open the app in a mobile browser, tap the hamburger to open/close the nav, and scroll through Holdings/Portfolio to check the tables now scroll horizontally instead of squashing | First real check of this session's responsiveness pass | Open |
| ★★ | **Try Sprint 15 for real**: open an Oslo Børs holding — the **Fetch all annual reports** card is now right at the top of the page and pulls every year back to ~2022 in one click. This is the first time it's been run against the real site (not just fixtures) | First live test of the new feature — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) §6, §8 | Open |
| ✅ | ~~Set `APP_AUTH_TOKEN` (Railway backend) and the matching `VITE_API_KEY` (Railway frontend build)~~ | — | Set and matched at least once (confirmed 2026-09-27), but see the ★★★ flapping item above — something changed since |
| ✅ | ~~Review and commit the demo mode toggle~~ | — | **Done 2026-09-26.** Merged via PR #7, redeployed, hit a real bug (blank page), Claude fixed it directly on `main` (`5c15b9e`), Faiz confirmed it's working |
| ✅ | ~~Review and commit + push Sprint 15 (Newsweb fetch)~~ | — | **Done 2026-09-26.** Merged via PR #7, redeployed |
| ✅ | ~~Commit and push the precious metals feature~~ | — | **Done** — already on `main` |
| ✅ | ~~Commit and push the queue-scope picker~~ | — | **Done** — confirmed on `origin/main` 2026-09-27 |
| ✅ | ~~Commit and push the 5 UI/UX changes~~ | — | **Done** — confirmed on `origin/main` 2026-09-27 |
| ✅ | ~~Sync your local `E:\Aladdin` clone~~ | — | **Done 2026-09-27** — hard-reset to `origin/main`, confirmed clean. **Reconfirmed 2026-09-27 (live verification):** still clean and in sync (`f746a3e`), no stale lock file |
| ★ | **Decide whether to build the remaining Newsweb-investigation backlog items**: structured insider/major-shareholder flagging and inside-information/press-release evidence text | New backlog candidates from the 2026-09-26 document-sources investigation — see §3c and [doc](newsweb-document-types-investigation-2026-09-26.md) | Open |
| ★ | **Review the Dashboard UI refresh** in the browser | New hero balance card + top-holdings card strip, borrowed from a dribbble reference he shared | Open |
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
| ★ | **Re-tag Heimdal Utbytte N, Heimdal Høyrente Pluss B and Alfred Berg Nordic High Yield II R away from "Equity ETF"** — none of the three is actually exchange-traded; they're Norwegian open-ended mutual funds (the `.IR` code is a data-vendor fund identifier, not a ticker) | Found while investigating whether ETF/ETC holdings can get Newsweb-style annual reports — see [doc](etf-etc-annual-report-sources-investigation-2026-09-27.md) §3 | Open |
| ★ | **Start the worker on the PC**: `python -m app.worker`. Then **Run on my PC** on a holding | First real local run started from Railway | Open |
| 4 | Try "Import from SEC EDGAR" on a US holding, and open an Oslo holding's announcements | First live test of both sources | Open |
| 5 | Open an equity holding, check Readiness, click **Run analysis** | Gemini quota exhausted right now; local worker offline too | Open |
| 6 | Open **Margin of safety** in the nav | Still nothing rankable — root cause unchanged since the 2026-09-27 investigation (see §4 and [doc](margin-of-safety-data-gaps-2026-09-27.md)); the fix isn't code, it's clicking the Newsweb fetch on the 2 equities and, separately, building Fund look-through valuation for the 3 funds/ETFs | Open |
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
| F5 | **Overnight analysis queue** | Both | Queue all ready holdings, worker runs them overnight | Sprint 5B | ✅ Done 2026-09-23. **Extended 2026-09-27** with a scope picker (owned / watchlist / both), committed and pushed — see §5 |
| F8 | **Local LLM from Railway** | Both | PC worker claims runs queued from Railway, runs on Ollama | Sprint 5B | ✅ Done 2026-09-23. **Fund/ETF output-limit fix 2026-09-27**, committed and pushed (`660ae1e`) — see §5 |
| F6 | **Decision journal** | Both | Why bought/sold, at what price, what would prove wrong | New | ✅ Done 2026-09-23 |
| F7 | **Watchlist** | Both | Analyze companies not owned; buy-below alert | New | ✅ Done 2026-09-23 |
| F10 | **Numeric macro data** | Both | Norges Bank / SSB / FRED, cited in every analysis | Backlog → built | ✅ Done 2026-09-24 |
| F9 | **Fund & ETF analysis** | Both | Fund facts, look-through, fee drag, fund-version analysis | Sprint 8 | ✅ Done 2026-09-24. **Output-limit fix 2026-09-27** — see §5 |
| F11 | **Thesis tracking** | Both | Tripwires checked by code, "what changed", verdict timeline, Thesis monitor | Sprint 11 | ✅ Built, committed and live-verified 2026-09-26 (`88e77e2`, `fbb2afe`) — see correction note in §1 |
| F12 | **Portfolio risk & regime intelligence** | Both | Real correlation matrix, correlated-cluster flag, drawdown/stress scenarios, regime classification | Sprint 12 | ✅ Built, committed and live-verified 2026-09-26 (`612bc5a`, `cab8272`) — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| F13 | **Portfolio performance over time** | Both | Daily portfolio value history + benchmark comparison, reindexed from today's positions | Sprint 13 | ✅ Built, committed, pushed, deployed, live-verified 2026-09-26 — [doc](portfolio-performance-sprint13-2026-09-27.md) |
| F14 | **Regime → DCF discount-rate wiring** | Both | Widens the DCF discount rate per macro regime, off by default | Sprint 14 | ✅ Built and pushed 2026-09-26 — [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
| F15 | **Precious metals tracking** | Both | Physical 1oz gold/silver coins (top 15 series each), valued at gold-api.com spot in NOK, price-development chart | Unplanned | ✅ Built, committed and pushed 2026-09-26 — [doc](precious-metals-tracking-2026-09-26.md) |
| F16 | **Demo mode toggle** | Both | Settings-page flag that swaps every page to a fixed, fabricated portfolio and blocks every write | Unplanned | ✅ Built, merged via PR #7 (`2e84ef8`), redeployed. Live bug fixed via hotfix `5c15b9e`. **Faiz confirmed working 2026-09-26** — [doc](demo-mode-toggle-2026-09-26.md) |
| F17 | **Newsweb annual-report fetch** | Both | Button on a holding that finds every ESEF annual report on Oslo Børs Newsweb back to ~2022, unzips each, and runs it through the same ingestion pipeline as a manual upload | Sprint 15 | ✅ Built, merged via PR #7 (`2e84ef8`), redeployed. Moved to top of holding page (`06e519c`). Extended to fetch every available year (`b8ee24b`), and to also fetch half-year/interim reports (F19). Not yet clicked against the real Newsweb site — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| F18 | **Mobile responsiveness pass** | Frontend | Collapsible hamburger nav below `lg`, horizontal scroll on every data table, tighter page padding on narrow screens, wrapping page headers | Unplanned | ✅ Built and pushed 2026-09-26 (`5c46d46`). Not yet checked on a real phone — see §2 |
| F19 | **Newsweb half-year/interim report fetch** | Both | Same pipeline as F17, category 1002 — fetches a holding's half-year reports, almost always plain PDFs | Backlog → built | ✅ Built, committed and pushed 2026-09-27 (`8bceab8`). Waiting on Faiz to re-click Kongsberg — [doc](newsweb-interim-report-fetch-2026-09-27.md), [bug doc](newsweb-interim-report-kongsberg-bug-2026-09-27.md) |

### 3b. Sprint status

| Sprint | Scope | Status |
|---|---|---|
| 0 | Guardrails, schema mapping, skeleton backend/frontend, Gemini + Mistral wiring | ✅ Closed |
| 1 | Equity data model, deterministic calculations, document ingestion, first pages | ✅ Closed |
| 2 | Live evidence-first research (macro, sector, company) | ✅ Closed |
| 3 | Valuation engine: DCF, reverse DCF, multiples + UI | ✅ Closed |
| 4 | Two-pass Buffett/Munger analysis engine + analysis view (F1) + readiness (F2) | ✅ Closed |
| 5 | Portfolio roll-up and dashboard (+ F3) | ✅ Closed 2026-09-23 |
| 5B | Local LLM from Railway + overnight queue (F8 + F5) | ✅ Built 2026-09-23 (`18e8a4e`, pushed). **F5 extended 2026-09-27** with a scope picker (`35c4c8f`, pushed) — see §5. **F8's fund/ETF output-limit fix** (`660ae1e`, pushed) — see §5 |
| 6 | Evidence quality (section-aware chunking, evidence budget) | ✅ Built 2026-09-24 (`71ec23b`, pushed) |
| 7 | Guardrail tooling: pre-commit, CI, secret scanning (+ F4 smoke test) | ✅ Built 2026-09-24 (`f81a824`, pushed) |
| 8 | Fund & ETF analysis (F9, decision 23) | ✅ Built 2026-09-24 (`8847311`, pushed). **Output-limit fix 2026-09-27** — see §5 |
| — | Numeric macro data (F10, decision 24) | ✅ Built 2026-09-24 (`c4b2ed2`, `551a141`, pushed) |
| 9 | ROIC / ROE / ROCE + market multiples with share counts | ✅ Built 2026-09-25 (`0b05364`, pushed) |
| 10 | ESEF history import (layer D) + large `.xhtml` uploads | ✅ Built 2026-09-25 (`176721f`, pushed) |
| 11 | Thesis tracking over time (F11, decision 25) + price without a DCF | ✅ Built 2026-09-26 (`88e77e2` backend, `fbb2afe` frontend). Migration `c7a1e9f3b2d5` — confirmed on real Postgres, live in prod — [doc](thesis-tracking-sprint11-2026-09-26.md) |
| 12 | Portfolio risk & regime intelligence (F12) | ✅ Built 2026-09-26 (`612bc5a` backend, `cab8272` frontend). Migration `a3f5c8d1e942` — confirmed on real Postgres, live in prod — [doc](portfolio-risk-regime-sprint12-2026-09-26.md) |
| 13 | Portfolio performance over time (F13, backlog 3c) | ✅ Built 2026-09-27 (`ed9ea03`). No schema change — [doc](portfolio-performance-sprint13-2026-09-27.md). Live in prod (`ba4726b` on top) |
| 14 | Regime → DCF discount-rate wiring (backlog 3c, Faiz's call) | ✅ Built and pushed 2026-09-26 (`b7a0398`). Off by default. No schema change — [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
| 15 | Newsweb annual-report fetch (F17) | ✅ Built, merged via PR #7, redeployed. No schema change — [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| — | Unplanned, shipped 2026-09-23: F4 status page, F6 decision journal, F7 watchlist | ✅ Done |
| — | Dashboard UI refresh (hero balance card + top-holdings cards, dribbble-inspired) | ✅ Built 2026-09-26, frontend-only, on `main` |
| — | **Precious metals tracking (F15)** | ✅ Built, committed and pushed 2026-09-26 — [doc](precious-metals-tracking-2026-09-26.md) |
| — | **Demo mode toggle (F16)** | ✅ Built, merged (PR #7), redeployed, hotfix `5c15b9e`, confirmed working — [doc](demo-mode-toggle-2026-09-26.md) |
| — | **Mobile responsiveness pass (F18)** | ✅ Built and pushed 2026-09-26 (`5c46d46`), frontend-only |
| — | **Newsweb half-year/interim report fetch (F19)** | ✅ Built, committed and pushed 2026-09-27 (`8bceab8`) — [doc](newsweb-interim-report-fetch-2026-09-27.md) |
| — | **UI polish: grouped sidebar, queue progress/ETA, correlation names, genie-bottle logo, collapsible Holdings sections** | ✅ Built and pushed 2026-09-27 (`bd5f742`) — [doc](ui-polish-sidebar-queue-progress-2026-09-27.md) |
| — | **"Queue all ready holdings" scope picker (F5 extension)** | ✅ Built and pushed 2026-09-27 (`35c4c8f`) — see §5 |
| — | **Local LLM fund/ETF output-limit fix** | ✅ Built, committed and pushed 2026-09-27 (`660ae1e`) — see §5 and [doc](local-llm-fund-output-limit-fix-2026-09-27.md) |
| — | **Backend API-key gate + CORS lockdown** | ✅ Built, committed and pushed 2026-09-27 (`7f6bf4a`). Confirmed live and enforcing once, then found **flapping** later the same day — see §5 and [doc](api-key-gate-flapping-2026-09-27.md) |

### 3c. Backlog (unscheduled)

| Candidate | Note |
|---|---|
| **Insider trades as structured evidence (Newsweb category 1102)** | Parse buy/sell/shares/price into deterministic fields for a future Thesis-tracking tripwire ("insider sold >X%"), instead of just a citable link — see [doc](newsweb-document-types-investigation-2026-09-26.md) §2 |
| **Major shareholder flagging as structured evidence (Newsweb category 1006)** | Parse "crossed above/below N%" into a deterministic ownership-concentration fact — see [doc](newsweb-document-types-investigation-2026-09-26.md) §2 |
| **Inside information + press releases as evidence-packet text (Newsweb categories 1005/1104)** | Structural qualitative signal, independent of whether Gemini's search grounding happens to surface the same news — see [doc](newsweb-document-types-investigation-2026-09-26.md) §2 |
| **SEC EDGAR full-text search** (`efts.sec.gov`) | Lets a US-holding evidence citation point at a real filing passage instead of an LLM summary — see [doc](newsweb-document-types-investigation-2026-09-26.md) §3 |
| Share-count refresh from the PC worker | Yahoo may block Railway's datacenter IP; the worker (home IP) could refresh prices and share counts |
| Operating margin from EBIT | When a filing tags EBIT but not operating income, operating margin stays empty |
| Alerts and notifications | Unblocked by Sprint 11 (tripwires store when they fired); needs a delivery channel (e-mail / push) |
| Qualitative thesis triggers | "Management changes" can't be a number; could be matched against Newsweb announcements |
| **Fund look-through valuation** | Weighted P/E / earnings yield over linked holdings; needs their prices. **2026-09-27: a free path confirmed for Xtrackers-issued funds** — DWS's own product page calls a public, unauthenticated JSON API (`https://etf.dws.com/api/pdp/{locale}/etf/{isin-slug}/holdings`) returning the full constituent list (ISIN, weight, market value, country, sector) for any Xtrackers ETF, confirmed live against the portfolio's own XDEF holding. No equivalent found yet for L&G (fund-centre site is geo-gated behind a click-through T&Cs page, no API call seen). Build the Xtrackers fetch first if this is picked up — see [doc](etf-etc-holdings-data-capture-followup-2026-09-27.md) |
| **Fund annual-report holdings parser** | Deterministic parser for the "schedule of investments" in a fund report PDF — still the right approach for L&G and any non-Xtrackers fund |
| Liquidity tier for illiquid alternative assets | Whisky, physical metals — no "sellable today at a quoted price" flag exists |
| Numismatic premium over spot for coins | F15 values coins at spot only — no premium source available free today |
| Historical price backfill for gold/silver | gold-api.com's history endpoint is paid; a free alternative with real history hasn't been found yet |
| Including precious metals in `PortfolioOverview` totals/concentration | Deliberate scope cut in F15 |
| Dependency audit → blocking, mypy in CI | After CI has run clean for a while |
| Code-split the frontend bundle | `npm run build` warns the main JS chunk is ~795 kB (min) |
| Live progress % on the analysis queue is stage-estimate, not measured | A real per-token or per-substep progress signal would need the LLM call itself to report back mid-stream |
| **Watch, don't build: ESAP (European Single Access Point) fund-document coverage** | Entering implementation ~2027; a collection point, not a new XBRL-tagging mandate for UCITS funds — re-check once live | See [doc](etf-etc-annual-report-sources-investigation-2026-09-27.md) §6 |

> Pulled into the **quarterly-review "Sprint 15" plan** (2026-09-26, separate from the Newsweb feature
> above): LLM usage ledger, nightly tripwire check, reporting/export, rate sensitivity per holding,
> Norway-specific yield curve/credit spread data, benchmark-relative / real-return reporting.
> **Real-return reporting (item #2) built 2026-09-27.** The rest are not yet started. See
> [sprint15-plan-and-quarterly-review-2026-09-26.md](sprint15-plan-and-quarterly-review-2026-09-26.md) §2.

### 3d. Free data sources

| Source | Covers | Status |
|---|---|---|
| SEC EDGAR (XBRL company facts) | US financials, citation-grade | ✅ Built 2026-09-22 |
| Oslo Børs Newsweb (announcements feed) | Oslo regulated announcements | ✅ Built 2026-09-22 |
| Oslo Børs Newsweb (annual-report fetch) | Fetches and unzips the ESEF annual report itself | ✅ Built 2026-09-26 (Sprint 15) |
| Oslo Børs Newsweb (interim-report fetch) | Fetches a holding's half-year report — almost always PDF, text evidence only | ✅ Built and pushed 2026-09-27 (F19), not yet checked live |
| filings.xbrl.org (ESEF index) | Oslo filing history FY2020–FY2024, xBRL-JSON | ✅ Built 2026-09-25 (Sprint 10) |
| yfinance share count · SEC `dei` shares | Shares outstanding for multiples + DCF | ✅ Built 2026-09-25 (Sprint 9) |
| yfinance daily price history | Correlation + stress sizing (Sprint 12), cached in `price_history_observations` | ✅ Built 2026-09-26 (Sprint 12) |
| gold-api.com | Gold/silver spot price (USD), free and keyless — no free history endpoint | ✅ Built 2026-09-26 (F15) |
| Brønnøysundregistrene | Norwegian entity data and annual accounts | Nice to have |
| VFF (vff.no) | Norwegian fund NAVs (Alfred Berg, Heimdal) | Needs a look |
| World Bank / OECD / IMF, GDELT | Global macro, news sentiment | Low |
| FMP / Finnhub free tiers | Mostly paywalled | Not recommended |
| **ESEF/iXBRL for the portfolio's ETF/ETC holdings (Xetra-Gold, L&G Gold Mining, Xtrackers Defence Tech)** | **Confirmed not applicable — legal exemption, not a missing feature.** UCITS units are excluded from the Transparency Directive (Article 1(2)); Xetra-Gold is a debt-like ETC from a private GmbH, also out of scope | ❌ Investigated 2026-09-27, nothing to build — [doc](etf-etc-annual-report-sources-investigation-2026-09-27.md) |
| **DWS/Xtrackers public holdings JSON API** (`etf.dws.com/api/pdp/.../holdings`) | Free, unauthenticated, per-ISIN structured constituent list (weights, market value, country, sector) for any Xtrackers ETF, incl. the portfolio's XDEF — confirmed live 2026-09-27 | ⭐ Found 2026-09-27, not yet built — feeds the backlog's Fund look-through valuation item — [doc](etf-etc-holdings-data-capture-followup-2026-09-27.md) |

Detail: [free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md) · [newsweb-document-types-investigation-2026-09-26.md](newsweb-document-types-investigation-2026-09-26.md) · [etf-etc-annual-report-sources-investigation-2026-09-27.md](etf-etc-annual-report-sources-investigation-2026-09-27.md) · [etf-etc-holdings-data-capture-followup-2026-09-27.md](etf-etc-holdings-data-capture-followup-2026-09-27.md)

---

## 4. Known issues

| Issue | Impact | Fix |
|---|---|---|
| **API-key gate flapping in production** | Faiz seeing "Missing or invalid API key" intermittently across the app — `/holdings`/`/portfolio/overview` returned 200 with no auth header while `/macro/indicators` 401'd, moments apart. Points at more than one backend instance live with different `APP_AUTH_TOKEN` state (Railway rolling deploy mid-flight, or an env edit not yet picked up everywhere) | Faiz: check Railway's Deployments tab for the backend service, ensure only one deployment is active, confirm `APP_AUTH_TOKEN`/`VITE_API_KEY` still match, redeploy if needed — see [doc](api-key-gate-flapping-2026-09-27.md) |
| **`SMOKE_API_KEY` GitHub Actions secret not confirmed** | This session can't read GitHub secrets, so it's unconfirmed whether the smoke-test workflow's direct API calls carry a valid key — they may now be failing with 401 | Faiz: check GitHub → Settings → Secrets and variables → Actions for `SMOKE_API_KEY`, add/fix if missing — see [doc](live-verification-2026-09-27.md) |
| **Margin-of-safety board still shows nothing rankable** | Same root cause as the 2026-09-27 investigation, unchanged since: Vår Energi + Salmon Evolution fail on a loss-making earliest filed year (CAGR undefined); L&G Gold Mining, Xtrackers Defence Tech and the mislabelled Heimdal fund have no income-statement facts at all (funds, not operating companies) | Faiz: run the Newsweb fetch on the 2 equities and see if an earlier profitable year appears; the 3 funds need Fund look-through valuation (unbuilt) — see [doc](margin-of-safety-data-gaps-2026-09-27.md) and §3c |
| **Today's LLM output-limit fix hasn't been run against the real local Ollama/GPU yet** | Full backend suite passes (932/932, 2 pre-existing unrelated failures), and the code is now on `main`, but the actual fix only matters once a real fund/ETF pass is re-run on Faiz's PC | Faiz: restart backend/worker, re-run XDEF.DE — see §2 |
| **Newsweb interim/half-year fetch (F19): zero reports imported yet for Kongsberg (KOG.OL)** | Faiz's first live test reported "only capturing html/xbrl files" — investigation found the interim GET returns empty for this holding (only pre-existing annual .html/.xhtml on file), consistent with the fetch never having actually succeeded/run yet, not a confirmed bug in the fetch itself. Separately found and fixed a real bug: PDF fallback could pick an investor-presentation PDF over the actual report | Faiz: click "Fetch half-year reports" on Kongsberg again and report exactly what happens — see §2, [bug doc](newsweb-interim-report-kongsberg-bug-2026-09-27.md) |
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
| Real-return overlay hasn't been checked live yet | Committed and pushed 2026-09-27, needs at least one stored Norway CPI observation (Macro refresh) to show anything | First click — see §2 |
| No debt-structure/WACC cross-check alongside the equity DCF | Flagged in the 2026-09-26 economic review as scope, not a bug | Not scheduled |
| Precious metals price history has no backfill | Chart starts empty and grows one point/day (gold-api.com's history endpoint is paid) | Stated plainly in the UI; backlog if a free historical source turns up |
| Precious metals valued at spot only, no numismatic premium | A coin dealer's actual buy/sell price differs from spot by a series-specific premium | Backlog — no free premium data source found yet |
| Sprint 15's Newsweb fetch hasn't been run against the live Newsweb site yet | Fixtures are shaped like real responses, but the button itself is untested against the real API | First click — see [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) §6 |
| Main JS bundle is ~795 kB minified | Slower first load, especially on mobile networks | Backlog candidate: code-splitting (3c) |
| Three holdings display as "Equity ETF" but aren't exchange-traded (Heimdal Utbytte N, Heimdal Høyrente Pluss B, Alfred Berg Nordic High Yield II R) | Cosmetic/classification only — doesn't affect the fund-analysis path, but is the wrong label | Faiz to re-tag — see §2 |

---

## 5. Changes / history

| Date | Change | Summary | Detail |
|---|---|---|---|
| 2026-09-27 | **Found: API-key gate flapping in production** | Faiz reported "Missing or invalid API key" pervasively right after the gate was confirmed live and enforcing earlier the same day. Direct checks with no auth header found `/holdings` and `/portfolio/overview` returning 200 while `/macro/indicators` returned 401, moments apart — not something the middleware's own logic can produce (it treats every non-`/health` path identically), pointing at more than one backend instance live at once with different `APP_AUTH_TOKEN` state. Research-only — no code changed; asked Faiz to check Railway's Deployments tab | [doc](api-key-gate-flapping-2026-09-27.md) |
| 2026-09-27 | **Verified the API-key gate + CORS lockdown is live in production** | Faiz asked to verify the latest development is live. Checked directly rather than trusting this page's prior notes: browser-loaded the live frontend (dashboard rendered real data, no errors), confirmed the live backend 401s every endpoint but `/health` without an `X-API-Key`, and confirmed the deployed frontend bundle already sends a matching key that the backend accepts — meaning `APP_AUTH_TOKEN`/`VITE_API_KEY` are **already set in Railway**, not still-open as this page said. Also re-checked `E:\Aladdin`: clean, at `f746a3e`, in sync with `origin/main` — the "one commit behind + stale lock" note was already stale. Corrected both across this page. Only unconfirmed piece: whether `SMOKE_API_KEY` is set in GitHub Actions | [doc](live-verification-2026-09-27.md) |
| 2026-09-27 | **Backend API-key gate + CORS lockdown** | Built the ★★★ fix for the audit's #1/#2 findings: `ApiKeyMiddleware` (new `backend/app/security.py`) requires `X-API-Key` matching `APP_AUTH_TOKEN` on every request once that's set in Railway (no-op today, unset by default); `CORS_ALLOWED_ORIGINS` replaces the old `allow_origins=["*"]`, defaulting to the known frontend origin. Frontend sends `VITE_API_KEY` as `X-API-Key` on every request. Smoke test's direct API calls take an optional `SMOKE_API_KEY`. This session's own device-bridge shell hit a disk-full condition and a pre-existing stale `.git/index.lock` on `E:\Aladdin` partway through — rebuilt and fully tested in a fresh GitHub-attached clone instead (backend 940 total/939 pass, 6 new, 1 pre-existing unrelated failure confirmed on unmodified `main` too; frontend tsc/eslint/vitest 19-19/build all clean). Committed and pushed from there. **`E:\Aladdin` is now one commit behind and still has that stale lock file** — see [doc](backend-auth-cors-gate-2026-09-27.md) | [doc](backend-auth-cors-gate-2026-09-27.md) |
| 2026-09-27 | **Full agentic-coding audit of the codebase** | Faiz asked for a full sweep for LLM-assisted-dev risk: eroded guardrails, spaghetti/god files, prompt-injection exposure, security gaps. Read-only — no code changed. Verdict: unusually well-guardrailed; CLAUDE.md's rules (deterministic math, evidence-first, versioned prompts, blind-pass isolation, untrusted-document framing, destructive-op confirm, secrets discipline) all actually hold up in code, not just on paper. Two real gaps found: (1) no auth on any endpoint + `allow_origins=["*"]` on a backend handling real financial data, deployed publicly; (2) `frontend/.env.example` describes an `APP_AUTH_TOKEN`/`VITE_API_KEY` gate that was never implemented on either side — documented safeguard, no actual guardrail. Also found and fixed in the same change: this page had drifted from the Claude project's `progress.md` (still showed two already-committed items as uncommitted). Minor notes: 19 stale `vite.config.ts.timestamp-*.mjs` files from crashed dev servers (already gitignored going forward), two large files worth a look before they grow further (`synthetic_data.py`, `lib/types.ts`), and a stale `.git/index.lock` on the local PC clone | [doc](agentic-coding-audit-2026-09-27.md) |
| 2026-09-27 | **Committed and pushed the fund/ETF LLM output-limit fix; reconciled progress.md with actual git state** | Faiz asked to commit outstanding work. Checked `E:\Aladdin` directly rather than trusting this page's prior notes (per the standing correction rule) and found: (1) the queue-scope picker and 5-item UI-polish batch, both previously logged here as "not yet committed," were **already committed and pushed to `origin/main`** (`35c4c8f`, `bd5f742`) — the local clone was in fact fully up to date, not behind as an older note claimed; (2) a real, already-implemented and already-tested fix for a fund/ETF analysis failure (local LLM truncating fund/ETF output at the token limit — see the entry below) was sitting uncommitted with matching tests and a doc already written, but never committed. Installed a fresh backend venv on this session's device-bridge shell (this session *could* run pytest, unlike some prior ones) and re-ran the full suite: 932/934 pass, same 2 pre-existing environment-only failures. Committed the fix (`git commit`, then pushed via a separate GitHub-attached clone with push credentials, since the local PC clone has none — applied the identical patch there and pushed `660ae1e`), then hard-reset the local `E:\Aladdin` clone onto the pushed commit so both are byte-identical. Corrected every stale "not yet committed"/"behind origin" note across this page | — |
| 2026-09-27 | **Fixed: local LLM fund/ETF analysis failing at the output-token limit** | Faiz's live failure on Xtrackers Europe Defence Technologies UCITS ETF (`XDEF.DE`): "Ollama stopped at the output limit (8192 tokens) before finishing the JSON." Root cause: a fund/ETF blind pass answers the `fund_v1` schema, which has one more narrative section than equity's `v1` (7 vs 6) — the shared `LLM_MAX_OUTPUT_TOKENS` default (8192) wasn't enough room for it. Fix, schema-aware rather than a manual `.env` bump: new `Settings.llm_max_output_tokens_fund` (16384); `LLMProvider.generate_structured()` (all three providers) gained an optional `max_output_tokens` override; `run_blind_pass()` passes it whenever `is_fund_schema(schema_version)` is true. `OLLAMA_NUM_CTX` default raised 16384 → 24576, applied to Faiz's real `.env` too. 6 new/updated tests; full suite 932/934 pass, same 2 pre-existing unrelated failures. No migration, no schema-version bump. Committed and pushed (`660ae1e`) — **Faiz still needs to restart the local backend/worker and re-run a fund analysis** — see §2 | [doc](local-llm-fund-output-limit-fix-2026-09-27.md) |
| 2026-09-27 | **Researched free ETF/ETC holdings-data automation; re-confirmed margin-of-safety findings unchanged** | Faiz asked to research the best free way to further improve ETF/ETC holdings data capture, and whether the margin-of-safety board's "no data" state matched the earlier same-day findings. Confirmed: yes, unchanged — nobody has clicked the Newsweb fetch on Vår Energi/Salmon Evolution yet, and Fund look-through valuation still isn't built. New research: live-checked the portfolio's own Xtrackers Europe Defence Technologies UCITS ETF (XDEF) product page on etf.dws.com and found it calls a free, public, unauthenticated JSON API (`/api/pdp/{locale}/etf/{isin-slug}/holdings`) returning the full structured constituent list. Checked the equivalent for L&G Gold Mining: geo-gated behind a click-through Terms & Conditions page, no equivalent free feed found. **Research-only — no code changed** | [doc](etf-etc-holdings-data-capture-followup-2026-09-27.md) |
| 2026-09-27 | **Investigated whether ETF/ETC holdings can get Newsweb-style ESEF annual reports** | Confirmed against the Transparency Directive text (2004/109/EC, Article 1(2)) that the ESEF/iXBRL mandate excludes UCITS units entirely; Xetra-Gold is a debt-like ETC from a private GmbH, also out of scope. Also found 2 more holdings mislabelled as "Equity ETF" that are actually Norwegian mutual funds. **Recommendation: don't build a fetch here.** Research-only — no code changed | [doc](etf-etc-annual-report-sources-investigation-2026-09-27.md) |
| 2026-09-27 | **"Queue all ready holdings" scope picker (F5 extension)** | Faiz's direct request: the button always silently queued owned positions only. Backend: `queue_ready_holdings()` gained a `scope: Literal["holdings", "watchlist", "all"] = "holdings"` parameter; `POST /analysis/queue/ready-holdings?scope=...`. Frontend: a small popup with 3 radio options, defaulting to "Actual holdings only". 3 new backend tests. No migration. Committed and pushed (`35c4c8f`) | — |
| 2026-09-27 | **5 UI/UX requests: grouped sidebar, analysis-queue progress/ETA, correlation-matrix names, genie-bottle logo, collapsible Holdings sections** | Grouped the flat 13-item nav into 5 sections; worker now reports a coarse stage as a fixed percentage; correlation heatmap shows security names instead of tickers; new genie-bottle logo + favicon; Holdings-page cards now collapse by default. tsc/eslint/vitest(19/19) clean. Committed and pushed (`bd5f742`) | [doc](ui-polish-sidebar-queue-progress-2026-09-27.md) |
| 2026-09-27 | **Unified the annual + half-year Newsweb fetch into one button** | Replaced two separate annual/half-year cards+buttons with one `NewswebAllReportsCard`. No backend change. Committed and pushed | [bug doc](newsweb-interim-report-kongsberg-bug-2026-09-27.md) |
| 2026-09-27 | **Investigated Faiz's Kongsberg (KOG.OL) bug report on F19; fixed a real attachment-ordering bug** | `pick_report_attachment()`'s PDF fallback took the first PDF in Newsweb's listed order, which could be an investor presentation rather than the report — fixed to skip presentation/webcast/invitation-named PDFs. 2 new regression tests | [bug doc](newsweb-interim-report-kongsberg-bug-2026-09-27.md) |
| 2026-09-27 | **Real (CPI-deflated) return reporting on Performance (Sprint 15 quarterly-review plan #2)** | New fields on `GET /performance/portfolio`: `real_return_pct`, `real_return_available`, `real_return_reason`, `cpi_region`, `real_return_note`. 4 new backend tests. No migration | [doc](real-return-reporting-sprint15-2026-09-27.md) |
| 2026-09-27 | **Newsweb half-year/interim report fetch (F19)** | Extended F17's annual-report fetch to also cover half-year/interim reports (category 1002), PDF-only, text evidence, zero facts extracted per CLAUDE.md Rule 1. 13 new backend tests. Committed and pushed (`8bceab8`) | [doc](newsweb-interim-report-fetch-2026-09-27.md) |
| 2026-09-26 | **Investigated other Newsweb document types + news sources** | Confirmed live the 13 announcement categories Newsweb publishes; ranked by evidence value. Research-only | [doc](newsweb-document-types-investigation-2026-09-26.md) |
| 2026-09-26 | **Newsweb fetch (F17): fetch every available annual report, not just the newest** | New `newsweb_filing_history_start_year` setting (default 2022); skips years already on file. 3 net new tests. Committed and pushed (`b8ee24b`) | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) §8 |
| 2026-09-26 | **Newsweb fetch (F17): moved to top of the holding page + confirmed it works for watchlist items** | Frontend-only. Committed and pushed (`06e519c`) | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Mobile responsiveness pass (F18)** | Sidebar hides below `lg`, replaced by a hamburger drawer; 6 tables wrapped in horizontal scroll. Pushed directly to `main` (`5c46d46`) | — |
| 2026-09-26 | **Hotfix: demo mode blanked the page on first real use** | Fabricated data used string literals outside the frontend's real TypeScript unions. Pushed directly to `main` (`5c15b9e`), Faiz confirmed working | — |
| 2026-09-26 | **Demo mode toggle (F16) and Sprint 15 Newsweb fetch (F17) merged and redeployed** | Both merged via PR #7. Migration `b2c3d4e5f6a7` confirmed on real Postgres | [demo mode doc](demo-mode-toggle-2026-09-26.md) · [Newsweb doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Sprint 15: fetch ESEF annual reports straight from Oslo Børs Newsweb (F17)** | New `GET`/`POST /sources/holdings/{id}/newsweb-annual-report[/import]`. 25 new backend tests | [doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md) |
| 2026-09-26 | **Demo mode toggle (F16) — fabricated-data mode for safe demos** | Settings-page toggle; every faked `GET` checks `is_demo_mode(db)` first; every write blocked via `require_not_demo(db)`. Migration `b2c3d4e5f6a7`. 18 new backend tests | [doc](demo-mode-toggle-2026-09-26.md) |
| 2026-09-26 | **Precious metals tracking (F15) — physical gold/silver coins** | New `PreciousMetalHolding` table, valued at gold-api.com spot in NOK. Migration `a74ba6a059dd`. 12 new backend tests | [doc](precious-metals-tracking-2026-09-26.md) |
| 2026-09-26 | **Dashboard UI refresh, inspired by a dribbble stock-portfolio reference** | Hero balance card + top-4-holdings card strip. No backend change | — |
| 2026-09-26 | **Full project review: economic/mathematical verification, doc cleanup, Sprint 15 plan** | DCF/CAPM/regime/correlation/stress math verified sound. 33 stale docs deleted | [plan](sprint15-plan-and-quarterly-review-2026-09-26.md) |
| 2026-09-26 | **Sprint 14: regime → DCF discount-rate wiring** | New setting `REGIME_ADJUSTED_DCF_ENABLED` (default `false`). 8 new backend tests. Committed and pushed (`b7a0398`) | [doc](regime-dcf-wiring-sprint14-2026-09-26.md) |
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
| 2026-09-22 | Setup checklist confirmed | Pushed and redeployed | [doc](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-22 | Account rename, position data, Macro speed | Deployed | [doc](account-name-position-data-macro-speed-2026-09-22.md) |
| 2026-09-21 | CSV import fixes + full data wipe | — | [doc](csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md) |
| 2026-09-21 | CSV import 500: storage alias | Deployed | — |
| 2026-09-21 | Portfolio delete: second cascade bug | — | [doc](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-21 | **Sprint 4 backend: analysis engine** | Evidence packet, versioned schema, prompts, blind/reconciliation passes. Migration `b5e1a9c3d7f2` | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio delete, page speed, first chart, whisky grouping | — | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 closed | Valuation engine backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 closed | Live research backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio CSV import + delete UI | Pulled forward from Sprint 4 | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 1 closed | Models, calculations, ingestion, minimal API, first pages | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 closed | Guardrails, schema map, skeletons, LLM wiring | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset | Clean-slate rebuild plan written | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Pre-reset history (Phases 0–10) is kept in the project's other docs and in git history.*
