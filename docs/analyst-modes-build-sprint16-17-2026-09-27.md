# Epic F22 build — Sprints 16 + 17: Analyst modes (2026-09-27)

Built from the plan in [analyst-modes-epic-f22-2026-09-27.md](analyst-modes-epic-f22-2026-09-27.md).
All 12 stories (22.1–22.12) are written and tested. **Written, not committed, not deployed** — the
files are in `E:\Aladdin` as uncommitted changes for Faiz to review and commit from GitHub Desktop.

---

## 1. Summary

| | |
|---|---|
| **What you get** | A 3-way switch in the top bar (Buffett/Munger · Ray Dalio · Side-by-side). Every page follows it. No per-page override (decision 4) |
| **Dalio mode** | Holding page shows a **Dalio verdict** (Buy/Sell + portfolio role) with its basis line. Margin-of-safety page becomes the **Cycle-fit board**. Portfolio risk gets an **All-Weather** section. Macro gets a **Dalio lens** section (liquidity, US debt cycle, dollar, country risk, gold demand) |
| **Side-by-side** | Both analyses in two columns, a **deterministic** agree/disagree strip, the missing run **auto-queued** on the PC, optional **"where they'd argue"** synthesis (off by default) |
| **Base commit** | Built on `ce6433a` (`origin/main`) |
| **Migrations** | 2, additive only: `f22a1b2c3d4e` (persona + auto_queued on runs) and `f22b2c3d4e5f` (country_indicators + analyst_syntheses). **Ran up/down/up clean on a local Postgres 16** |
| **Tests** | Backend **986 total, 985 pass** (46 new; the 1 failure is pre-existing and environment-only — `test_documents_sources_research_funds_are_blocked_outright_in_demo_mode` gets 503 without a Gemini key). `ruff check .` now **passes** (it had 15 pre-existing errors on `main`; fixed the trivial ones). Frontend tsc / eslint (0 errors) / vitest 22/22 / build all clean |
| **UI checked** | Rendered in a real browser (demo mode, desktop 1440px + phone 390px): holding side-by-side, cycle-fit board, All-Weather, dashboard, macro, queue |

---

## 2. Stories

| # | Story | Status | Where |
|---|---|---|---|
| 22.1 | Whole-app mode toggle | ✅ | `AppSetting analyst_mode`; `GET/PUT /settings/analyst-mode`; `AnalystModeToggle` in the top bar (desktop) and under the mobile header |
| 22.2 | Runs tagged by persona | ✅ | `equity_analysis_runs.persona` (backfilled `buffett_munger`), `latest_runs_by_holding(persona=…)` defaults to Buffett — so the MoS board, overview, thesis, journal, watchlist never see a Dalio verdict |
| 22.3 | Deterministic Dalio evidence | ✅ | 8 FRED series in a **separate** `dalio_v1` catalogue (so Buffett packets don't change — Rule 3) + derived **Fed net liquidity** and **interest/receipts**; quadrant + rate **betas** with a 24-month min-history guard and t-stats; correlation to the rest of the portfolio; currency; regime |
| 22.4 | Dalio blind + reconciliation | ✅ | `dalio_v1` schema (one for all types), `prompts/analysis/{blind,reconciliation}_dalio_v1.md`, 16 384-token budget, citation check, DCF price target for stocks / n/a for funds and ETCs |
| 22.5 | Dalio panel on the holding page | ✅ | `AnalysisPanel persona="dalio"`: Dalio verdict + role + basis line, cycle phases, quadrant chips, 4 sections, citations |
| 22.6 | Dalio in the queue | ✅ | `?persona=` on run/queue; "Queue all ready holdings" gains **Buffett / Dalio / Both**; worker runs the claimed run's persona; queue rows show a persona tag |
| 22.7 | Side-by-side + auto-queue | ✅ | `GET /analysis/holdings/{id}/side-by-side`; `POST …/auto-queue` and `POST /analysis/auto-queue`. Guardrails: side-by-side mode only, **local engine only**, dedupe per holding+persona, readiness, **cap 20 per rolling 24 h**, "auto" tag |
| 22.8 | Optional synthesis | ✅ | `synthesis_v1` schema + prompt, `analyst_syntheses` table, B:/D:-prefixed citations checked, never touches either run. Off by default (Settings → Analyst modes) |
| 22.9 | All-Weather portfolio view | ✅ | `GET /dalio/all-weather`: roles (judged), environments judged **and** measured, currency split, **rate sensitivity** (absorbs quarterly-review #3), country risk with look-through, correlated clusters. Market-value weights only |
| 22.10 | Country risk (slim CWO port) | ✅ (COFER ❌ — see §4) | SSI port, keyless World Bank provider, WGI PV.EST, `country_indicators` table, WGC gold dataset. `data_year` on every figure |
| 22.11 | Mode-aware boards | ✅ | MoS page → Cycle-fit board in Dalio mode, both boards in side-by-side; dashboard card with role mix + agreement counts |
| 22.12 | Demo mode for all three modes | ✅ | `synthetic_dalio.py`; switching mode stays allowed in demo mode, every new write endpoint is 403 (added to the exhaustive demo test) |

---

## 3. Economist review (done during the build)

Reviewed the ported CWO code line by line before porting. New flags beyond the plan's ECON-F22-01..10:

| ID | Sev | Found | What was done |
|---|---|---|---|
| ECON-F22-11 | 🔴 | CWO's SSI takes `abs()` of the World Bank **net lending/borrowing** figure — a **surplus** (Norway, ~+10% of GDP) scored as the same stress as a 10% **deficit** (90/100) | Fixed: surplus = zero deficit. Test proves it |
| ECON-F22-12 | 🟡 | CWO's WGI map `6 + 1.6x` puts 0 at 6 and never reaches 1 | Linear `5.5 + 1.8x`, clamped 1–10 |
| ECON-F22-13 | 🟡 | CWO's fetcher defines the deficit trend as "positive = worsening", its calculator reads "negative = worsening" | Defined once, in balance terms (balance falling = worsening) |
| ECON-F22-14 | 🟠 | CWO's COFER fetcher **never called the IMF** — it's a hard-coded, unsourced "Q2 2024" table | Not ported. Reserve status shown as IMF **SDR-basket membership** (a fixed fact); gap disclosed in every packet |
| ECON-F22-15 | 🟡 | CWO's "growth expectations" came from a stale 2024 IMF table | Uses the World Bank **latest actual** growth, labelled as such |
| ECON-F22-16 | 🟡 | Missing political stability defaulted to a neutral 5.0 in CWO | No placeholder: missing component is dropped and reweighted, flagged in data quality |
| — | 🟡 | Quadrant betas are univariate OLS on ~24–36 monthly points; growth proxy = −Δ US unemployment; a EUR/USD holding uses US CPI | Every beta carries its t-stat; |t| < 2 is shown as "not statistically clear", never as a direction |

Also kept from the plan: no crisis probabilities (ECON-F22-07), no ISIN-prefix country mapping for funds (08), market-value weights (09), SSI+WGI only, not the 22-determinant composite (10).

---

## 4. Known gaps and what's not built

| Gap | Why | Next step |
|---|---|---|
| **IMF COFER** reserve shares | Endpoint couldn't be verified from the build environment (403 through the proxy); CWO's version was static mock data | Check `dataservices.imf.org` / the new IMF data portal from Faiz's PC; add as a new provider if live |
| World Bank + WGI provider not run against the **live** API | Build environment has no route to `api.worldbank.org`; built against the documented v2 shape with fixtures | First **Macro → Dalio lens → Refresh Dalio data** is the live check |
| Norway curve/credit (Sprint 15 #4) and BIS debt-cycle series | Not built — disclosed in every Dalio packet (`ECON-F22-02/04`) | Still backlog |
| **LLM usage ledger** (Sprint 15 #1) | Still not built. Auto-queue is **local-only** with a hard 24 h cap, so it can't spend Gemini quota; the synthesis is a manual click | Build before letting auto-queue use the cloud |
| Trial runs on XDEF + Xetra-Gold + one equity (22.4 sign-off) | Needs Faiz's PC worker / Gemini quota | See §5 |

---

## 5. What Faiz needs to do

| # | Action |
|---|---|
| 1 | Review + commit the changes in GitHub Desktop (commit text in §6), push. Railway runs the 2 migrations on deploy |
| 2 | **Macro** page → switch to Dalio or Side-by-side → **Refresh Dalio data** (fetches the 8 FRED series + World Bank for your countries). Also runs on the normal Macro refresh |
| 3 | Restart the PC worker (it needs the new code to run Dalio runs), then queue Dalio runs on **XDEF.DE, Xetra-Gold and one equity** — these are the 22.4 trial runs to review |
| 4 | Try the top-bar switch on a holding page in all three modes |
| 5 | Optional: Settings → Analyst modes → switch on the synthesis, then run it on a holding that has both analyses |

---

## 6. Files

**Backend — new:** `domain/analyst_modes.py`, `domain/dalio_macro_series.py`, `domain/analysis_schema/{dalio_v1,synthesis_v1}.py`,
`domain/country_risk_assumptions/`, `models/{country_risk,analyst_synthesis}.py`, `providers/world_bank.py`,
`services/dalio/{macro,cycle_math,holding_analytics,evidence,gold_demand,all_weather,board}.py`,
`services/country_risk/{ssi,domicile,indicators}.py`, `services/analysis/{auto_queue,side_by_side,synthesis}.py`,
`services/settings/{analyst_mode,synthetic_dalio}.py`, `api/dalio.py`, `schemas/dalio.py`,
`prompts/analysis/{blind_dalio_v1,reconciliation_dalio_v1,synthesis_v1}.md`, 2 migrations, 7 test files.

**Backend — changed:** analysis model/API/schemas/pipeline/queue/latest/blind+reconciliation passes, settings API,
macro refresh endpoint + scheduler (also refresh the Dalio series), worker, deletion (syntheses), thesis timeline
(Buffett only), factory, config.

**Frontend — new:** `components/{AnalystModeToggle,ModeAwareAnalysis,DalioViews}.tsx`, `lib/{analystMode.tsx,analystTypes.ts,analystTypes.test.ts}`.
**Changed:** `AnalysisPanel` (persona-aware), `Layout` (top bar), `api.ts`, `types.ts`, `main.tsx`, holding, MoS, risk,
macro, dashboard, queue and settings pages.
