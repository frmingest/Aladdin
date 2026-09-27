# Epic F22 — Analyst modes: Buffett/Munger · Dalio · Side-by-side (2026-09-27)

Faiz's request: add a second analyst "persona" built on the `cwo-economics-analyst` skill
(Ray Dalio's Changing World Order lens), plus a combined mode, so the whole app toggles
easily between three modes:

| Mode | What it does |
|---|---|
| **1. Buffett/Munger** (default) | Today's app, unchanged |
| **2. Ray Dalio** | Macro-cycle, currency, country-risk and portfolio-balance lens, with its own Buy/Sell verdict |
| **3. Side-by-side** | Both analyses next to each other, with where they agree and disagree |

**Planning-only doc. No code changed.** Aladdin seams checked against `E:\Aladdin` at `f746a3e`.
CWO reuse assessed against `frmingest/CWO` at `4400fda` (§4).

> **Rev 2 (2026-09-27, same day):** Faiz answered the 5 open decisions (§7). Added the CWO
> repo reuse assessment (§4), the recommendation on funds (§3c), and auto-queue rules (§5).

---

## 1. Where this fits (priority call)

| Order | Item | Why this position |
|---|---|---|
| 0 | **Blockers:** API-key gate flapping (★★★) + credential rotation gate | Nothing new ships on a flapping auth layer or unrotated DB password |
| 1 | **Sprint 15 #1: LLM usage ledger** | Side-by-side **auto-queues a second run per holding** (decision 3). It needs a real cost/quota record, plus a nightly cap, before that's switched on |
| 2 | **Sprint 15 #4: Norway yield-curve / credit-spread sourcing** | Dalio mode relies on it most; today the regime inputs are US-only for curve and credit |
| 3 | **Sprint 16 = F22 phase 1** | Mode toggle, persona plumbing, CWO macro series (cheap port), Dalio per-holding analysis |
| 4 | **Sprint 17 = F22 phase 2** | Side-by-side + auto-queue, portfolio All-Weather view, slim country-risk module ported from CWO |
| 5 | Sprint 15 #3 rate sensitivity | Absorbed into F22 story 22.9 |
| 6 | Sprint 15 #5 nightly tripwires, #6 PDF export | Behind F22 |

**Recommendation: an Epic (F22), not a single story.**

---

## 2. Design principles (from CLAUDE.md, kept unchanged)

| Rule | How F22 keeps it |
|---|---|
| **Rule 1: code does every number** | Quadrant sensitivity, currency exposure, correlation contribution and the Sovereign Stress Index are **computed in Python** and handed to the LLM as evidence. The LLM only narrates and judges |
| **Rule 2: every claim cites an evidence ID** | `dalio_v1` has `evidence_ids` on every section, checked the same way as today |
| **Rule 3: versioned schema + prompts** | New files `analysis_schema/dalio_v1.py`, `prompts/analysis/{blind,reconciliation}_dalio_v1.md`, `country_risk_assumptions/v1.py`. The existing v1/v2/fund_v1 files are not touched |
| **Blind-pass isolation** | Each persona's blind pass never sees your notes, **and never sees the other persona's output** |
| **No fabricated data** | Nothing ported from CWO carries its mock/demo fallbacks (§4c). A missing figure is a stated gap, never a placeholder |

---

## 3. What "Dalio mode" means for a single holding

> **Buffett/Munger:** *"Is this a wonderful business at a sensible price?"*
> **Dalio:** *"Given where we are in the debt, liquidity and geopolitical cycles, should I own this, and what job does it do in my portfolio?"*

### 3a. `dalio_v1` schema sections

| # | Section | Deterministic inputs (Rule 1) | Source |
|---|---|---|---|
| 1 | **Debt-cycle position** (short- and long-term) of the home economy | Policy/real rate, 10y, curve, CPI, HY spread + **US debt/GDP, federal interest outlays, Fed net liquidity** | ✅ Aladdin macro catalogue + 🆕 FRED series ported from CWO (§4a) |
| 2 | **Growth/inflation quadrant fit** (the 4 "All Weather" environments) | Holding return beta vs. CPI and growth proxies | 🟡 New calculation on `price_history_observations` + macro series |
| 3 | **Currency and reserve-currency risk** | Trading currency, NOK/USD/EUR, broad dollar index, IMF COFER reserve shares | ✅ existing FX + 🆕 CWO ports |
| 4 | **Country power and sovereign risk** of domicile (look-through for funds where available) | **Sovereign Stress Index (SSI)** + WGI political stability | 🆕 Slim country-risk module ported from CWO (§4) |
| 5 | **Internal/external order**: geopolitical and conflict exposure | WGI score, sector tags, research items | 🆕 + existing research |
| 6 | **Portfolio role and diversification** ("15 uncorrelated return streams") | Pairwise correlation, cluster flag | ✅ Sprint 12 |
| 7 | **Verdict (decision 2):** Dalio's **own Buy/Sell rating** on the same `VerdictRating` scale, from its own reading of the evidence, **plus** a `portfolio_role` tag: *growth engine / inflation hedge / deflation hedge / currency-debasement hedge / diversifier / redundant* | Price-target range still from the Python DCF where one exists; for gold/ETCs, "n/a", not invented | ✅ Pipeline |

The UI calls it **"Dalio verdict"** and shows one line saying the basis is cycle, currency and
portfolio fit, not business quality. That keeps a Buffett "Buy" and a Dalio "Sell" on the same
holding meaningful rather than confusing.

### 3b. Domain review flags

| ID | Sev | Issue | Mitigation |
|---|---|---|---|
| ECON-F22-01 | 🔴 | Dalio's framework ranks countries and cycles; a stock verdict needs an adapted question | Schema asks *cycle fit + portfolio role*, and the verdict rests on those. Basis stated in the UI |
| ECON-F22-02 | 🟠 | Regime curve/credit inputs are US-only | Sprint 15 #4 first; disclosed in `evidence_unavailable_reasons` until then |
| ECON-F22-03 | 🟠 | No revenue-by-geography, so country exposure = **domicile only** for equities | Stated gap; revenue-geography parsing in the backlog |
| ECON-F22-04 | 🟡 | Long-term debt cycle for **Norway/EU** needs a credit-gap/debt-service series; CWO has none (its debt data is US-FRED + World Bank annual) | BIS statistics API as a candidate; free/keyless access still to be confirmed |
| ECON-F22-05 | 🟡 | Quadrant betas on short price history are noisy | Same min-history guard as Sprint 12; "insufficient history" rather than a number |
| ECON-F22-06 | 🟠 | A synthesis LLM that sees both outputs can blend them | Independent blind passes; agree/disagree is a deterministic diff; synthesis optional and labelled |
| ECON-F22-07 | 🟠 | **CWO's SSI crisis-probability mapping** (2/8/25/55% at 12m) is a hard-coded step function with no calibration evidence in the repo | Port the SSI score and risk band; **drop the probability numbers**, or show them only as "indicative, uncalibrated" |
| ECON-F22-08 | 🟠 | **CWO maps country from the ISIN prefix**: an `IE…` UCITS ETF becomes "Ireland exposure", which is wrong | Don't port that mapping. Funds use look-through (DWS API for Xtrackers); otherwise "domicile ≠ exposure" disclosed |
| ECON-F22-09 | 🟡 | CWO weights portfolio country risk by **cost basis**, not market value | Aladdin uses market-value weights (already in `portfolio_overview`) |
| ECON-F22-10 | 🟡 | For developed domiciles (NO, US, DE, IE, GB), the 22-determinant power composite barely separates them; it adds cost, not signal | Use SSI + WGI + reserve-currency status, not the full composite (§4) |

### 3c. Recommendation on funds/ETFs (decision 5)

**One `dalio_v1` schema for all instrument types. No separate `dalio_fund_v1`.**

| Why | Detail |
|---|---|
| Dalio's lens is asset-class-based, not business-based | The Buffett side needed `fund_v1` because moat, ROIC and management don't apply to a fund. Dalio's questions (cycle, quadrant, currency, country, role) apply the same way to a stock, an equity fund, a bond fund or a gold ETC |
| Your funds are where Dalio adds most | Xetra-Gold → debasement/deflation hedge; XDEF → geopolitical-order play; Nordic High Yield → credit-cycle sensitive; Heimdal Utbytte → equity income. That's natural Dalio territory |
| Less to maintain | 2 prompt files instead of 4 |
| What differs is **evidence**, not schema | Funds get look-through country/sector weights (DWS API where available) and fund facts; gold/ETCs get COFER + central-bank gold demand + real rates; the DCF price target is "n/a" for non-earning assets |
| Safety valve | Token budget is schema-aware (as in the `660ae1e` fix). If the XDEF + Xetra-Gold trial runs show sections coming back empty, split to `dalio_fund_v1` later (Rule 3 allows a new version) |

---

## 4. CWO repo reuse assessment (decision 1)

Reviewed `frmingest/CWO` (`4400fda`): FastAPI + SQLAlchemy, 35 fetchers (~25k lines), 22 routers,
22-determinant scoring, SSI calculator, ML crisis ensemble, sentiment/RSS pipeline.

**The live-API route is ruled out as well as unwanted:** the production URL in CWO's CLAUDE.md
(`cwo-prodbase12354.up.railway.app`) returned **404 for `/api/system/health` and
`/api/countries/NOR/complete`** on 2026-09-27, and CWO's own CLAUDE.md lists the countries/rankings
endpoints as returning 500. **Port code, don't depend on the app.**

### 4a. ✅ Take: port and adapt

| # | From CWO | Into Aladdin as | Effort | Notes |
|---|---|---|---|---|
| 1 | `sovereign_stress_calculator.py`: SSI 0–100 from debt/GDP trajectory 30%, fiscal deficit 20%, current account 15%, reserve coverage 15%, political stability 10%, growth 10% | `services/country_risk/ssi.py` + weights/thresholds in `domain/country_risk_assumptions/v1.py` | S | Pure Python, no DB/imports, so ports almost as-is. Keep the partial-coverage reweighting + data-quality flag. **Drop the probability table** (ECON-F22-07) |
| 2 | `ssi_data_fetcher.py`: the **World Bank indicator list** (`GC.DOD.TOTL.GD.ZS`, `GC.NLD.TOTL.GD.ZS`, `BN.CAB.XOKA.GD.ZS`, `FI.RES.TOTL.MO`, `DT.DOD.DECT.CD`, `FI.RES.TOTL.CD`, `NY.GDP.MKTP.KD.ZG`) | New slim `providers/world_bank.py` (keyless) → a country-indicator table | M | Take the **mapping, not the code**: CWO's fetcher is coupled to its `crud`/`models`. Only fetch the ~6–8 countries you actually hold. `data_year` shown on every figure |
| 3 | `internal_order_fetcher.py`: WGI `PV.EST` (−2.5..+2.5 → 1–10) | SSI "political stability" input + section 5 evidence | S | Logic only; **its mock fallback stays behind** |
| 4 | `fed_liquidity_fetcher.py`: **Fed net liquidity** = `WALCL` − `WTREGEN` − `RRPONTSYD` | 3 new series + 1 derived series in `domain/macro_series.py` | S | Aladdin already has a FRED provider, so this is catalogue entries, not a fetcher port |
| 5 | `dedollarization_fetcher.py`: `GFDEGDQ188S` (US debt/GDP), `A091RC1Q027SBEA` (federal interest outlays), `FGRECPT` (receipts), `FDHBFIN` (foreign holdings of Treasuries), `DTWEXBGS` (broad dollar index) | 5 more FRED catalogue entries (+ interest/receipts as a derived ratio) | S | The long-term debt-cycle and reserve-currency inputs for the US leg |
| 6 | `imf_cofer_fetcher.py`: reserve-currency shares (USD/EUR/CNY/JPY/GBP) | Evidence for sections 3 and 7 (currency, gold role) | S | ⚠️ Uses the old `dataservices.imf.org` SDMX_JSON endpoint; **confirm it's still live** before building (the IMF has been moving to a new data portal) |
| 7 | `cb_demand_fetcher.py`: static WGC central-bank gold-demand dataset | Evidence for gold holdings (Xetra-Gold, L&G Gold Mining, coins) | S | Static dataset with an `as_of` date, per CWO's own ADR DATA-006. Needs a quarterly manual refresh |
| 8 | Methodology notes: ECON-009 (don't double-count GPI and WGI), `data_year` string/int handling, weight-sum invariant | Carried into `country_risk_assumptions/v1.py` docstring + a test | — | Lessons, not code |

### 4b. 🟡 Take the idea, rebuild it properly

| From CWO | Why not as-is | Aladdin version |
|---|---|---|
| `routers/portfolio.py` `/geopolitical`, `/country-power-matrix`, `/country-risk` | Region from ISIN prefix (ECON-F22-08), cost-basis weights (ECON-F22-09), `except Exception` swallowing errors | Story 22.9 portfolio view: market-value weights, look-through, explicit gaps |
| `cycles_fetchers.py` expected growth | Uses a **hard-coded IMF WEO Oct 2024 table**, now ~2 years stale | If needed: IMF WEO via its public DataMapper API (free/keyless to be confirmed), or reuse World Bank `NY.GDP.MKTP.KD.ZG` history only |
| `config/normalization.py` rule registry | Built for 22 determinants; overkill for 2–3 mappings | Inline, versioned linear mappings in `country_risk_assumptions/v1.py` |

### 4c. ❌ Leave behind

| From CWO | Why |
|---|---|
| Full 22-determinant composite + ~20 determinant fetchers | Heavy, low signal for developed domiciles (ECON-F22-10); **12+ fetchers contain mock/demo fallbacks**, which break Aladdin's no-fabrication rule |
| `imf_fetcher_yields.py` | Explicit "demo fallback, never returns None" = fabricated yields |
| ML crisis ensemble (`ml/`, `ml_model_*`) | Known broken import (`ml.ml_training_improved`), needs labelled training data, overkill for ~6 countries |
| Sentiment/RSS pipeline (~5k lines) | VADER not calibrated for geopolitical text (CWO skill's own flag); Aladdin already has Gemini research + Newsweb |
| `bond_yield_aggregator` / `ecb_fetcher` | Aladdin has Norges Bank + FRED; ECB 10y only matters if EU holdings grow. Revisit then |
| SGE/metals, field crypto/consent, chat | Aladdin has F15; different privacy posture (single owner, API-key gate) |

**Net port size:** 1 pure module (~300 lines after trimming) + 1 new keyless provider + ~9 FRED
catalogue entries + 2 small evidence sources. That's about 1 sprint of work, split across 22.3 and 22.10.

---

## 5. Toggle and queue mechanics

| Piece | Design | Migration? |
|---|---|---|
| Mode setting (decision 4: **whole app only**) | `AppSetting` key `analyst_mode` ∈ `buffett_munger` / `dalio` / `side_by_side`, default `buffett_munger`. No per-page override | ❌ No |
| Toggle UI | 3-segment control in the top bar (`Layout.tsx`), one click, with a mode chip on every page | — |
| Runs tagged by persona | New `persona` column on `EquityAnalysisRun`, backfilled to `buffett_munger`; `latest.py` filters by persona | ✅ Yes (1) |
| Pipeline | `run_full_analysis(..., persona=)` picks the schema/prompt pair: Buffett equity → `v1`/`v2`, Buffett fund → `fund_v1`, **Dalio (all types) → `dalio_v1`** | — |
| Country-risk data | New `country_indicators` table (country, indicator, year, value, source, fetched_at) | ✅ Yes (1, phase 2) |
| **Auto-queue (decision 3)** | While mode = side-by-side, a holding page or list view that finds the other persona's run **missing** (or >30 days older than its partner) queues it automatically | — |
| Auto-queue guardrails | Local worker engine only (never spends Gemini quota automatically) · dedupe: never queue if a queued/running run already exists for that holding + persona · respects Readiness · nightly cap (default 20, setting `F22_AUTO_QUEUE_NIGHTLY_CAP`) · every auto-queued run is labelled "auto" in the queue page | — |
| Demo mode | Synthetic Dalio + side-by-side data | — |

---

## 6. User stories

### Phase 1: Sprint 16 (foundation + Dalio per holding)

| # | Story | Acceptance criteria | Size |
|---|---|---|---|
| **22.1** | *As Faiz, I can switch the whole app between Buffett/Munger, Dalio and Side-by-side from the top bar in one click* | Server-side setting; every page reads it; default Buffett/Munger; the active mode is always visible; no per-page override | S |
| **22.2** | *As Faiz, every analysis run is tagged with the persona that produced it* | `persona` column + migration + backfill; latest-run lookup per persona | S |
| **22.3** | *As Faiz, I get deterministic Dalio evidence for a holding* | ~9 FRED series ported from CWO (§4a #4–5) added to the macro catalogue + refresh; evidence items for debt cycle, liquidity, currency (incl. broad dollar), correlation contribution, quadrant betas (min-history guard). Every item has an EV-ID, source and date; gaps go to `evidence_unavailable_reasons` | M |
| **22.4** | *As Faiz, I can run a Dalio blind + reconciliation analysis on any holding type* | One `dalio_v1` schema for all types (§3c); Dalio's own Buy/Sell verdict + `portfolio_role`; citation check passes; DCF price target reused where it exists, "n/a" for gold/ETCs; schema-aware output-token budget; trial runs on XDEF + Xetra-Gold + one equity reviewed by the CWO economist before sign-off | L |
| **22.5** | *As Faiz, in Dalio mode the holding page shows the Dalio analysis* | `DalioAnalysisPanel`: cycle position, quadrant fit, currency, role, **Dalio verdict** + basis line + citations | M |
| **22.6** | *As Faiz, I can queue Dalio runs overnight* | Queue scope picker gains a persona choice; the worker runs the Dalio pipeline | S |

### Phase 2: Sprint 17 (side-by-side + portfolio view + country risk)

| # | Story | Acceptance criteria | Size |
|---|---|---|---|
| **22.7** | *As Faiz, in side-by-side mode I see both analyses next to each other, and the missing one is queued automatically* | Two-column view; verdicts aligned; deterministic agree/disagree strip; **auto-queue per §5 with all guardrails**; "auto" label on the queue page | M |
| **22.8** | *As Faiz, I get an optional "where they'd argue" synthesis* | Separate, labelled LLM pass citing both runs; never overwrites either verdict; off by default | M |
| **22.9** | *As Faiz, in Dalio mode the Portfolio/Risk pages show All-Weather balance* | Weight by `portfolio_role` and quadrant, currency split, correlation clusters, regime, market-value-weighted country risk with look-through; absorbs Sprint 15 #3 (rate sensitivity) | L |
| **22.10** | *As Faiz, Dalio mode includes sovereign-stress and political-stability evidence for each domicile country* | SSI ported (§4a #1, no probability table), World Bank provider + `country_indicators` table + migration, WGI PV.EST, COFER (after the endpoint check), WGC gold demand; `data_year` on every figure; coverage/quality flag when inputs are missing | M |
| **22.11** | *As Faiz, the dashboard and Margin-of-safety board adapt to the mode* | Dalio: "Cycle-fit board"; side-by-side: both columns | M |
| **22.12** | *As Faiz, demo mode shows all three modes* | Synthetic data for Dalio + side-by-side; writes still blocked | S |

**Definition of done (every story):** backend tests + tsc/eslint/vitest clean; progress.md updated;
CWO economics analyst reviews 22.3/22.4/22.9/22.10 **before** code audit and QA; UX pass last.
Ported CWO code gets a test proving no fallback/placeholder value can reach the evidence packet.

---

## 7. Decisions (answered by Faiz 2026-09-27)

| # | Decision | Answer | Effect on the plan |
|---|---|---|---|
| 1 | Country data source | **Build a lighter version from the CWO repo** | §4 reuse assessment; story 22.10 rescoped as a port; CWO API dependency dropped |
| 2 | Dalio verdict? | **Yes: Buy/Sell from its own assessment + the holding's role in the portfolio** | §3a section 7; UI label "Dalio verdict" + basis line |
| 3 | Side-by-side missing run | **Queue automatically** | §5 auto-queue + guardrails; LLM ledger (Sprint 15 #1) is now a hard prerequisite for 22.7 |
| 4 | Toggle scope | **Whole app** | No per-page override |
| 5 | Fund/ETF schema | **Faiz asked for a recommendation** → one `dalio_v1` for all types | §3c; split later only if trial runs show it's needed |

**Still to confirm during build (not blocking):** IMF COFER endpoint still live (22.10), BIS
free access (backlog), IMF WEO DataMapper free access (only if expected growth is wanted).

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Auto-queue doubles LLM load | Local engine only, nightly cap, dedupe, ledger first |
| Output-token overflow on Ollama | Schema-aware `max_output_tokens` per persona |
| Persona blur (Dalio sounds like Buffett) | Separate prompts, a blind pass for each, a golden-output test comparing both on the same holding |
| CWO fallback/mock data leaking in with ported code | Port mappings and pure logic only (§4c); test that a missing input stays missing |
| Scope creep into rebuilding CWO | Hard boundary: SSI + WGI + COFER + WGC + FRED series. Nothing else from §4c without a new decision |
| IMF endpoint retired | Check at the start of 22.10; if dead, section 3 runs on FRED/Norges Bank FX only, and the gap is disclosed |
