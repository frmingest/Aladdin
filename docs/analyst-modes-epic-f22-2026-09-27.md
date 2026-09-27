# Epic F22 — Analyst modes: Buffett/Munger · Dalio · Side-by-side (2026-09-27)

Faiz's request: add a second analyst "persona" built on the `cwo-economics-analyst` skill
(Ray Dalio's Changing World Order lens), plus a combined mode, so the whole app toggles
easily between three modes:

| Mode | What it does |
|---|---|
| **1. Buffett/Munger** (default) | Today's app, unchanged |
| **2. Ray Dalio** | Macro-cycle, currency, country-risk and portfolio-balance lens |
| **3. Side-by-side** | Both analyses next to each other, with where they agree and disagree |

**Planning-only doc. No code changed.** The code seams below were checked against `E:\Aladdin` at `f746a3e`.

---

## 1. Where this fits (priority call)

| Order | Item | Why this position |
|---|---|---|
| 0 | **Blockers:** API-key gate flapping (★★★) + credential rotation gate | Nothing new ships on a flapping auth layer or unrotated DB password |
| 1 | **Sprint 15 #1: LLM usage ledger** | Side-by-side mode **doubles LLM calls per holding**. With Gemini at 20/day, you need a real cost/quota record *before* adding a second persona |
| 2 | **Sprint 15 #4: Norway yield-curve / credit-spread sourcing** | Dalio mode relies on it most. Today the regime inputs are US-only for curve and credit, which is a weak base for a NOK, Oslo-heavy debt-cycle read |
| 3 | **Sprint 16 = F22 phase 1** | Mode toggle, persona plumbing, Dalio per-holding analysis |
| 4 | **Sprint 17 = F22 phase 2** | Side-by-side mode, portfolio-level Dalio view, country-risk data |
| 5 | Sprint 15 #3 rate sensitivity | Moves into F22 phase 2 as a Dalio input (story 22.9) |
| 6 | Sprint 15 #5 nightly tripwires, #6 PDF export | Pushed behind F22. #6 gets better once there are two personas to export |

**Recommendation: an Epic (F22), not a single story.** It touches the data model, prompts,
schemas, the worker queue and most pages, and it splits naturally into two sprints.

---

## 2. Design principles (from CLAUDE.md, kept unchanged)

| Rule | How F22 keeps it |
|---|---|
| **Rule 1: code does every number** | Dalio's quadrant sensitivity, currency exposure and correlation contribution are **computed in Python** and handed to the LLM as evidence. The LLM only narrates |
| **Rule 2: every claim cites an evidence ID** | The Dalio schema has `evidence_ids` on every section, checked the same way as today |
| **Rule 3: versioned schema + prompts** | New files `analysis_schema/dalio_v1.py` and `prompts/analysis/{blind,reconciliation}_dalio_v1.md`. The existing v1/v2 files are not touched |
| **Blind-pass isolation** | Each persona's blind pass never sees your notes, **and never sees the other persona's output**. That keeps side-by-side an honest second opinion, not an echo |

---

## 3. What "Dalio mode" means for a single holding (economist review)

The CWO analyst lens is built for **countries**, not stock-picking. Applied without change, it
would be a conceptual error. So Dalio mode asks a different question from Buffett mode:

> **Buffett/Munger:** *"Is this a wonderful business at a sensible price?"*
> **Dalio:** *"Does this holding fit the current cycle, and does it make the portfolio better balanced?"*

### 3a. Proposed `dalio_v1` schema sections

| # | Section | Deterministic inputs (Rule 1) | Source in Aladdin today |
|---|---|---|---|
| 1 | **Debt-cycle position** (short-term and long-term) of the holding's home economy | Policy rate, real policy rate, 10y, curve, CPI, HY spread | ✅ `macro_series.py` (13 series) + `risk/regime.py` |
| 2 | **Growth/inflation quadrant fit**: which of the 4 "All Weather" environments the holding does well or badly in | Holding return beta vs. CPI and growth proxies | 🟡 New calculation, built on `price_history_observations` + macro series |
| 3 | **Currency and reserve-currency risk** | Trading currency, NOK/USD/EUR exposure, FX series | ✅ `trading_currency`, `usd_nok`, `eur_nok` |
| 4 | **Country power and sovereign risk** of domicile (and revenue countries, later) | CWO determinants / sovereign stress | ❌ Not in Aladdin; see §4 |
| 5 | **Internal/external order**: geopolitical and conflict exposure | Sector + country tags, research items | 🟡 Research (Gemini) + sector tags |
| 6 | **Portfolio role and diversification**: correlation to the rest of the book ("15 uncorrelated return streams") | Pairwise correlation, cluster flag | ✅ Sprint 12 `risk/correlation.py` |
| 7 | **Verdict**: same `VerdictRating` scale (for comparability) + a `portfolio_role` tag: *growth engine / inflation hedge / deflation hedge / diversifier / redundant* | Price-target range stays from the DCF (Python) | ✅ Reuses the pipeline |

### 3b. Domain review flags

| ID | Sev | Issue | Mitigation |
|---|---|---|---|
| ECON-F22-01 | 🔴 | Dalio's framework ranks countries and cycles. Using it as a stock verdict without adapting it is a category error | Schema asks about *cycle fit + portfolio role*, not moat. The UI labels Dalio's "Buy" as **"fits current cycle / improves balance"** |
| ECON-F22-02 | 🟠 | Regime inputs are US-only on the curve and credit legs, so a Norwegian debt-cycle read is weak | Do Sprint 15 #4 first (§1); disclose it in `evidence_unavailable_reasons` until then |
| ECON-F22-03 | 🟠 | No revenue-by-geography data. "Country exposure" means **domicile only** | State the gap in the evidence packet; revenue-geography parsing goes to the backlog (ESEF segment notes) |
| ECON-F22-04 | 🟡 | A long-term debt-cycle read needs debt/GDP, the credit gap and the debt-service ratio. None are stored | Candidate free source: **BIS statistics API** (credit-to-GDP gaps, debt-service ratios). *Needs confirming as free/keyless before it's built* |
| ECON-F22-05 | 🟡 | Quadrant betas on short price history are noisy | Same minimum-history guard as Sprint 12 (≥30 points, ≥40 overlap). Report "insufficient history" rather than a number |
| ECON-F22-06 | 🟠 | In side-by-side mode, a "debate" LLM that sees both outputs can blur them together | Two independent blind passes. Agree/disagree is a **deterministic diff**, and any LLM synthesis is optional, cites both runs and is labelled |
| ECON-F22-07 | 🔵 | Funds/ETFs (XDEF, L&G Gold Mining, Xetra-Gold) are *more* natural in Dalio mode (gold = deflation/debasement hedge) | `dalio_fund_v1` variant, or reuse `dalio_v1` with fund evidence. Decide in story 22.4 |

---

## 4. Country-risk data (CWO determinants): options

| Option | Effort | Pros | Cons |
|---|---|---|---|
| **A. Read from the CWO app's API** (your other Railway app) | S–M | Reuses 25 determinants, SSI and crisis probability for 197 countries | Couples two apps; needs the CWO API live, stable and authenticated |
| **B. Slim in-Aladdin set** (World Bank / IMF / BIS for ~6 domicile countries) | M | Self-contained; only covers countries you actually hold | Rebuilds part of CWO |
| **C. Skip for phase 1** | — | Unblocks everything else | Section 4 of the schema is "unavailable" at first |

**Default: C for phase 1, A for phase 2**, if the CWO API is reachable. Decision for Faiz (§7).

---

## 5. Toggle mechanics

| Piece | Design | Migration? |
|---|---|---|
| Mode setting | `AppSetting` key `analyst_mode` ∈ `buffett_munger` / `dalio` / `side_by_side`, default `buffett_munger`. Same pattern as demo mode | ❌ No |
| Toggle UI | 3-segment control in the top bar (`Layout.tsx`), always visible, one click. Mode chip colour-coded on every page | — |
| Runs tagged by persona | New `persona` column on `EquityAnalysisRun`, backfilled to `buffett_munger`. Latest-run lookup (`latest.py`) filters by persona | ✅ Yes (1 migration) |
| Pipeline | `run_full_analysis(..., persona=)` picks the schema/prompt version pair per persona (+ fund variant), from new settings `active_dalio_*_version` | — |
| Queue / worker | "Queue all ready holdings" gets a persona choice; side-by-side queues **both** runs. The worker already claims by run and needs no change beyond the persona field | — |
| Demo mode | Synthetic Dalio + side-by-side data added to `synthetic_data.py`, so demos show all three modes | — |

---

## 6. User stories

### Phase 1: Sprint 16 (foundation + Dalio per holding)

| # | Story | Acceptance criteria | Size |
|---|---|---|---|
| **22.1** | *As Faiz, I can switch the whole app between Buffett/Munger, Dalio and Side-by-side from the top bar in one click* | Setting persists server-side; every page reads it; default = Buffett/Munger; the active mode is always visible | S |
| **22.2** | *As Faiz, every analysis run is tagged with the persona that produced it* | `persona` column + migration + backfill; latest-run lookup per persona; existing runs show as Buffett/Munger | S |
| **22.3** | *As Faiz, I get deterministic Dalio evidence for a holding* | New evidence items: debt-cycle inputs, currency exposure, correlation contribution, quadrant betas (with a min-history guard). Each has an EV-ID and a source; gaps go to `evidence_unavailable_reasons` | M |
| **22.4** | *As Faiz, I can run a Dalio blind + reconciliation analysis on a holding* | `dalio_v1` schema + prompts; citation check passes; price target still comes from the Python DCF; works on Ollama within the output-token budget; fund handling decided | L |
| **22.5** | *As Faiz, in Dalio mode the holding page shows the Dalio analysis* | New `DalioAnalysisPanel`: cycle position, quadrant fit, currency, portfolio role, verdict + citations | M |
| **22.6** | *As Faiz, I can queue Dalio runs overnight* | Queue scope picker gains a persona choice; the worker runs the Dalio pipeline | S |

### Phase 2: Sprint 17 (side-by-side + portfolio view + country data)

| # | Story | Acceptance criteria | Size |
|---|---|---|---|
| **22.7** | *As Faiz, in side-by-side mode I see both analyses next to each other for a holding* | Two-column view; verdicts aligned; a **deterministic agree/disagree strip** (verdict, risk flags, horizon); prompts to run the missing persona | M |
| **22.8** | *As Faiz, I get an optional "where they'd argue" synthesis* | Separate, labelled LLM pass that sees both finished runs and cites both; never overwrites either verdict; off by default | M |
| **22.9** | *As Faiz, in Dalio mode the Portfolio/Risk pages show All-Weather balance* | Portfolio weight by quadrant role, currency split, correlation clusters, regime; absorbs Sprint 15 #3 (rate sensitivity) | L |
| **22.10** | *As Faiz, Dalio mode includes country-power/sovereign-risk evidence* | Per option A/B (§4); vintage year shown on each figure; coverage warning when missing | M |
| **22.11** | *As Faiz, the dashboard and Margin-of-safety board adapt to the mode* | Dalio: "Cycle-fit board" replaces the MoS ranking; side-by-side: both columns | M |
| **22.12** | *As Faiz, demo mode shows all three modes* | Synthetic data for Dalio + side-by-side; writes still blocked | S |

**Definition of done (every story):** backend tests + tsc/eslint/vitest clean; progress.md updated;
CWO economics analyst reviews 22.3/22.4/22.9 **before** code audit and QA (skill chain order);
UX pass last.

---

## 7. Decisions for Faiz

| # | Decision | Default if you don't choose |
|---|---|---|
| 1 | Country data: CWO API (A), slim in-app set (B), or skip for now (C) | C in phase 1 → A in phase 2 |
| 2 | Should Dalio mode give a Buy/Sell verdict at all, or only a *portfolio role*? | Both, with Dalio's verdict labelled "cycle fit" |
| 3 | Side-by-side: auto-queue the missing persona, or wait for a click? | Wait for a click (protects the LLM quota) |
| 4 | Is the toggle global only, or overridable per page? | Global only |
| 5 | Fund/ETF in Dalio mode: separate `dalio_fund_v1`, or one schema? | Decide in 22.4 after a trial run on XDEF + Xetra-Gold |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| LLM cost/quota doubles in side-by-side mode | Ledger first (Sprint 15 #1); Dalio defaults to the local Ollama engine |
| Output-token overflow on Ollama (as with the fund schema) | Schema-aware `max_output_tokens` per persona, same as the `660ae1e` fix |
| Persona blur (the Dalio pass sounds like Buffett) | Separate prompts, a blind pass for each, and a golden-output test comparing both on the same holding |
| Scope creep into rebuilding CWO inside Aladdin | Option C/A in §4; B only if Faiz explicitly chooses it |
