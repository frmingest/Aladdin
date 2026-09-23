# Aladdin — Progress

Quick-glance tracker. Detail for each item lives in its own linked doc; this page stays short tables only.

**Last updated:** 2026-09-23

---

## 1. Where we are right now

| | |
|---|---|
| **Current phase** | Phase 11: the Buffett/Munger single-focus rebuild ([sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md)) |
| **Sprints closed** | 0, 1, 2, 3, 4 |
| **In progress** | Sprint 5: F3 board ✅ done; portfolio roll-up dashboard + executive summary left |
| **Latest build** | Local LLM engine (Ollama) + ticker decision + UI tweaks — ✅ **Ollama verified running locally**; commits not pushed or deployed. F1–F3 are on GitHub (`1a31b79`); deploy not verified this session. |
| **Tests** | 423/423 backend, tsc/eslint/vite build clean |
| **Live-verified?** | ❌ The analysis engine, EDGAR and Newsweb have only been tested against fakes. The new UI was checked with mocked API data only. |

---

## 2. Needs from Faiz

| # | Action | Why |
|---|---|---|
| ★ | **Rotate credentials** pasted into chat on 2026-09-23: Supabase DB password + storage S3 keys, Google AI Studio, Mistral, FRED keys — then update `backend/.env` and Railway | They're in a chat transcript |
| ★ | Railway Variables: `LLM_PROVIDER=google_ai_studio` (or unset), `LLM_FALLBACK_PROVIDER=none` | Railway can't reach Ollama on your PC |
| ★ | Fix the 1 remaining readiness blocker on the first holding, then run the first local analysis | First real run on the local LLM |
| ★ | Change Vår Energi's ticker `VARRY` → **`VAR.OL`**; fix sectors: Xetra-Gold + L&G Gold Mining → Materials, Salmon Evolution → Consumer Staples | [ticker decision](local-llm-tickers-ui-2026-09-23.md#2-ticker-convention--decision) |
| ★ | Push `main` (this session's commit) and redeploy | Ships the palette + collapsible Primary sources; Ollama code is inert on Railway |
| 1 | Set `MARKET_DATA_PROVIDER=yfinance` and `RESEARCH_PROVIDER=gemini_search` in Railway and `backend/.env` | The analysis engine can't produce real output while these are `stub`. No new key is needed. |
| 2 | Add `SEC_EDGAR_USER_AGENT` (e.g. `Aladdin portfolio app <email>`) in Railway and `backend/.env` | SEC requires a contact email. EDGAR import errors until this is set. |
| 3 | Confirm Railway is running `1a31b79` (F1–F3) | Pushed to GitHub; deploy not verified this session |
| 4 | Try "Import from SEC EDGAR" on a US holding, and open an Oslo holding's announcements | First live test of both sources |
| 5 | Open an equity holding, check the Readiness card, then click **Run analysis** | First real signal on prompt quality, cost and usefulness. The readiness card shows what's missing first. |
| 6 | Open **Margin of safety** in the nav | First real ranking; the "Can't be ranked yet" list shows which holdings still need financials |
| 7 | Review `analysis_schema/v1.py` and `prompts/analysis/*.md` | Once a real run uses v1, any change needs a new version file (CLAUDE.md Rule 3) |

---

## 3. Roadmap

### 3a. Agreed feature plan (2026-09-22, in build order)

| # | Feature | Layer | What it delivers | Fits into | Status |
|---|---|---|---|---|---|
| F1 | **Analysis view** | Frontend | Verdict card, moat breakdown, clickable evidence citations and notes editor on the holding page | Sprint 4 frontend | ✅ Done 2026-09-22 |
| F2 | **Analysis readiness check** | Backend + UI | Per-holding checklist before spending a Gemini call: ticker resolves, ≥3 yrs of financials, fresh price, research cached, analyzable type. Also fixes the `asset_class_raw="equity"` default bug. | Sprint 4 frontend | ✅ Done 2026-09-22 |
| F3 | **Margin-of-safety board** | Both | Every owned equity ranked by price vs. its DCF bear/base/bull range | Sprint 5 | ✅ Done 2026-09-22 |
| F4 | **System status page + post-deploy smoke test** | Both | Quota left today, `stub` providers, stale caches, last EDGAR/Newsweb success; a Playwright smoke suite run against Railway | Sprint 7 (status page can ship earlier) | ⏳ Planned |
| F5 | **Overnight analysis queue** | Backend | Queue holdings and run them within the daily budget, resuming the next day. Built with the LLM usage ledger. With a local LLM the budget limit mostly goes away — the queue becomes "run all holdings on my PC overnight". | New | ⏳ Planned |
| F6 | **Decision journal** | Both | Record why you bought or sold, at what price, and what would prove you wrong; see the outcome after 6/12 months | New | ⏳ Planned |
| F7 | **Watchlist** | Both | Analyze companies you don't own; flag when the price drops below a buy-below level | New | ⏳ Planned |

### 3b. Sprint status

| Sprint | Scope | Status |
|---|---|---|
| 0 | Guardrails, schema mapping, skeleton backend/frontend, Gemini + Mistral wiring | ✅ Closed |
| 1 | Equity data model, deterministic calculations, document ingestion, first pages | ✅ Closed |
| 2 | Live evidence-first research (macro, sector, company) | ✅ Closed |
| 3 | Valuation engine: DCF, reverse DCF, multiples + UI | ✅ Closed |
| 4 | Two-pass Buffett/Munger analysis engine + analysis view (F1) + readiness (F2) | ✅ Closed |
| 5 | Portfolio roll-up and dashboard (+ F3) | 🚧 F3 done; roll-up dashboard + executive summary next |
| 6 | Evidence quality (section-aware chunking, evidence budget) | ⏳ Not started |
| 7 | Guardrail tooling: pre-commit, CI, secret scanning (+ F4 smoke test) | ⏳ Not started |

### 3c. Backlog (unscheduled)

| Candidate | Note |
|---|---|
| Numeric macro data (FRED / Norges Bank) + scheduler | Deferred twice out of Sprint 2 |
| Portfolio risk and regime intelligence | Correlation, drawdown scenarios, rebalancing flags |
| Thesis tracking over time | Persist verdicts; flag fired invalidation triggers |
| Historical price/FX and performance | Daily P&L, benchmark comparison |
| Alerts and notifications | Needs thesis tracking first |
| Reporting and export | PDF or print view of an analysis run |
| More primary sources | See table 3d |

### 3d. Free data sources

| Source | Covers | Status |
|---|---|---|
| SEC EDGAR (XBRL company facts) | US financials, citation-grade | ✅ Built 2026-09-22 |
| Oslo Børs Newsweb | Oslo regulated announcements | ✅ Built 2026-09-22 |
| Brønnøysundregistrene | Norwegian entity data and annual accounts | Nice to have |
| VFF (vff.no) | Norwegian fund NAVs (Alfred Berg, Heimdal) | Needs a look |
| World Bank / OECD / IMF, GDELT | Global macro, news sentiment | Low |
| FMP / Finnhub free tiers | Mostly paywalled | Not recommended |

Detail: [free-market-data-research-providers-2026-09-21.md](free-market-data-research-providers-2026-09-21.md)

---

## 4. Known issues

| Issue | Impact | Fix |
|---|---|---|
| Holdings created by hand *before* 2026-09-22 may still be tagged `equity` | Readiness shows it as blocking, with the fix | Change Instrument Type on the Holdings page (new holdings are classified automatically) |
| Railway can't use the local LLM | An analysis started from the Railway site still uses Gemini | Run analyses from the local app (guide), or a tunnel later |
| Gemini quota counter is in-memory | Resets on every server restart, so "left today" can be optimistic | LLM usage ledger (built with F5) |
| App sidebar isn't responsive | On a phone the fixed sidebar squeezes every page | Not scheduled — app-wide layout fix |
| Positions imported before migration `a2b4c6d8e0f1` have `NULL` `last_price`/`market_value_nok` | Re-uploading the CSV fills them in | Faiz re-upload (done 2026-09-22) |
| No GitHub push credentials in any session shell | Faiz pushes manually | Needs a PAT or credential helper from Faiz |

---

## 5. Changes / history

| Date | Change | Summary | Detail |
|---|---|---|---|
| 2026-09-23 | **Ollama set up on Faiz's PC — verified** | Recreated a broken backend venv, started local backend + frontend; readiness shows "Ollama reachable, model 'qwen3:14b' available". Setup guide gained a "what must be running" table and 5 troubleshooting rows from this session. Docs only. | [guide](local-llm-ollama-setup.md) |
| 2026-09-23 | **Local LLM engine + ticker decision + UI tweaks** | New `OllamaProvider` (`LLM_PROVIDER=ollama`, default `qwen3:14b`) runs the analysis passes on the local GPU; Gemini keeps research. Context-overflow/truncation guards, "Local LLM" readiness check, Gemini fallback option. Step-by-step Windows setup guide. Ticker rule decided: home-exchange Yahoo symbol (`VAR.OL`, not the unsponsored ADR `VARRY`). Primary sources moved to the bottom, collapsed. Darker warm-gray palette. 423 tests (20 new). Committed locally, not pushed. | [doc](local-llm-tickers-ui-2026-09-23.md) · [guide](local-llm-ollama-setup.md) |
| 2026-09-22 | **F3 Margin-of-safety board** | New `GET /valuation/board`: every owned stock/equity ETF (latest snapshot per account) with bear/base/bull, price, margin of safety, zone, NOK value, weight and latest verdict, ranked by margin of safety. New **Margin of safety** page with range bars and a "can't be ranked yet" list. Beta now cached 24h in the yfinance provider. 403 tests (11 new). Committed locally, not pushed. | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **F1 Analysis view + F2 Readiness check (Sprint 4 closed)** | New `GET /analysis/holdings/{id}/readiness` (8 checks, estimated Gemini calls, no side effects). Run output now includes its evidence items and notes snapshot. `POST /holdings` classifies the instrument type instead of defaulting to `equity`. New Analysis section on the holding page: readiness card, verdict, DCF price range, moat, narratives, clickable citations, notes editor, run details. 392 tests (28 new). Committed locally, not pushed. | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Feature plan + progress.md restructure** | Agreed features F1–F7 added to the roadmap and sprint plan. This page restructured into numbered sections with tables only; finished narrative sections moved into this table. Docs only, no code. | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-22 | **Primary sources: SEC EDGAR + Newsweb** | EDGAR annual facts saved as financial facts with filing provenance (never overwrites uploaded years, with a name-match guard). Newsweb announcements cached 24h. Evidence packet v2, `/sources/*` API, Primary sources UI. New env var `SEC_EDGAR_USER_AGENT`. 364 tests (31 new). Not pushed. | [doc](primary-sources-sec-edgar-newsweb-2026-09-22.md) |
| 2026-09-22 | Setup checklist confirmed | Pushed and redeployed (data wipe ran), 5 CSVs re-uploaded with real tickers, Gemini and FRED keys set. Docs only. | [doc](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-22 | Account rename, position data, Macro speed | Account rename UI and name-on-upload. New positions table. `last_price`/`market_value_nok` now persisted (migration `a2b4c6d8e0f1`). Daily budget guard wired in, so an exhausted quota fails instantly instead of after 45–60s. 333 tests. Deployed. | [doc](account-name-position-data-macro-speed-2026-09-22.md) |
| 2026-09-21 | CSV import fixes + full data wipe | Fixed the `quality_flags` 500 and the duplicate-holding/garbage-ticker bug. Inline Ticker/Sector/Type editing. Wipe migration `e5f6a7b8c9d0` (ran on deploy). 326 tests. | [doc](csv-import-ticker-sector-fixes-and-db-wipe-2026-09-21.md) |
| 2026-09-21 | CSV import 500: storage alias | `supabase`/`r2`/`s3` all map to the S3 provider. 5 regression tests. Deployed. | — |
| 2026-09-21 | Portfolio delete: second cascade bug | `portfolio_risk_snapshots` added to the legacy purge. Counts shown in the UI. 2 regression tests. Also wrote the free-provider research doc. | [doc](free-market-data-research-providers-2026-09-21.md) |
| 2026-09-21 | **Sprint 4 backend: analysis engine** | Evidence packet, versioned schema, prompts and assumptions, blind and reconciliation passes, pipeline with LLM fallback and a deterministic DCF price target, notes CRUD, `/analysis` API. Migration `b5e1a9c3d7f2`. 307 tests. | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio delete, page speed, first chart, whisky grouping | Cascade-safe deletes, 2N+1 query fixes, first portfolio chart | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 3 closed | Valuation engine backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 closed | Live research backend and frontend | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Portfolio CSV import + delete UI | Pulled forward from Sprint 4 | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 1 closed | Models, calculations, ingestion, minimal API, first pages | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 closed | Guardrails, schema map, skeletons, LLM wiring | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset | Clean-slate rebuild plan written | [sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Pre-reset history (Phases 0–10) is kept in the project's other docs and in git history.*
