# Sprint 15 plan + economic/mathematical review + doc cleanup (2026-09-26)

Full project pass at Faiz's request: re-read the whole build (progress.md, the rebuild sprint plan,
Sprints 11-14's own docs, and the actual code in `E:\Aladdin`), stress-tested the deterministic
math/economics an economist would check before calling this "investment-grade," and went through
all 60 Claude project docs to find what's stale. **No code was changed this session** — this is a
planning/audit pass. Findings below feed the sprint plan; nothing here contradicts `progress.md`,
which stays the source of truth for what's built/live.

---

## 1. Economic & mathematical verification

Read line-by-line: `calculations.py`, `valuation/{dcf,discount_rate,growth,multiples}.py`,
`risk/{regime,stress,correlation}.py`, and the versioned assumption files
(`valuation_assumptions/v1`, `analysis_assumptions/v1`, `regime_adjustments/v1`).

**Verdict: the core logic is sound and methodologically defensible for an investment-grade tool.**
Every formula is textbook, every judgment call is named, versioned, and documented with its
rationale rather than buried as a magic number. Specifically:

| Area | What's implemented | Assessment |
|---|---|---|
| **DCF** | Equity DCF: owner earnings (Buffett-style: net income + D&A − capex − ΔWC) projected at a historical CAGR, discounted at CAPM cost of equity, Gordon-growth terminal value, divided by shares outstanding | Correct and internally consistent — discounting *equity* cash flow at cost of *equity* (not FCFF at WACC) avoids the classic error of mixing a levered cash flow with an unlevered discount rate. Terminal growth (2.5%) is kept below every mapped currency's risk-free rate, which keeps the Gordon-growth denominator safely positive by construction |
| **CAPM discount rate** | risk-free rate + β × ERP, ERP fixed at 4.5% across USD/EUR/GBP/NOK (documented as informed by Damodaran's implied-ERP range, not a live feed) | A defensible simplification for a portfolio concentrated in investment-grade sovereigns (Norway, EU, UK, US) — flagged in the code itself as a v2 candidate if a country-specific ERP is ever wanted |
| **Bull/bear scenarios** | ±3pp symmetric offset around one deterministic base-case growth rate, not three independent forecasts | Transparent and reproducible; correctly framed as a sensitivity band, not three "opinions" |
| **Reverse DCF** | Bisection over a bounded [-50%, +200%] implied-growth range, exploiting that intrinsic value is monotonic in growth rate | Mathematically sound approach to an equation with no closed form; correctly surfaces "no supportable growth rate" rather than forcing an answer |
| **Regime classifier** | 3-month rolling average of 4 macro series (US HY spread, US 10y-2y, US CPI, Norway CPI) → baseline/stagflation/crisis, with named, sourced thresholds | Reasonable given genuinely thin free data (4 series → 3 buckets is appropriately coarse, not over-fit). Correctly smoothed to avoid one noisy print flipping the whole classification |
| **Regime → DCF wiring (Sprint 14)** | Fixed discount-rate add-ons (0/150/300bps) per regime, off by default | Directionally correct (widen the discount rate under credit stress, matching the classifier's own stated rationale) and honestly labeled as round-number judgment, not a spread pass-through model |
| **Correlation / stress** | Real Pearson correlation from ≥30-point, ≥40-overlap daily price history; stress sizing from DCF bear case where available, else 2σ of daily returns scaled by √20 (standard sqrt-time volatility scaling) | Standard, correctly implemented (sample stdev, pairwise-overlap correlation, monotonic bisection). Ties the shock to real analysis output where possible instead of one generic illustrative percentage everywhere |
| **Ratios / margins / HHI** | Plain Decimal arithmetic, `ValueError` on undefined ratios rather than silently returning 0 | Correct rigor for money math — no float rounding risk, no silently-wrong zeros hiding a data gap |

**No incorrect formulas or unsound logic found.** The honest gaps the team has already
self-documented remain genuinely open (not new findings, but worth restating since they bear
directly on "investment-grade" credibility):

1. **Regime classifier is US-only for the curve/credit legs** — no free Norwegian yield-curve or
   credit-spread series exists in the macro catalogue yet, so a NOK-denominated, Oslo-heavy
   portfolio is being regime-classified partly on US market plumbing. CPI genuinely is dual
   (Norway + US), so it's not a pure US proxy, but it's not fully home-market either.
2. **Regime discount-rate add-ons are round numbers, not a continuous function of spread level** —
   by design (see `regime_adjustments/v1.py`'s own docstring), but worth revisiting once enough
   live regime transitions have actually been observed to size them empirically.
3. **No debt-structure/WACC model** — the DCF is equity-only, which is internally consistent but
   means capital-structure changes (a leveraged buyback, a big debt raise) aren't separately
   modeled; owner earnings and net debt ratios pick up the balance-sheet effect, but WACC-based
   cross-checks don't exist.
4. **Performance reporting (Sprint 13) is a reindexed approximation, not real transaction P&L** —
   already labeled honestly in every API response's `method_note`; flagged again here because an
   "investment-grade" reviewer would ask about it first.
5. ~~**No inflation-adjusted / real-return view**~~ — **Closed 2026-09-27 (Sprint 15 item #2 / F21).**
   Performance now carries an optional CPI-deflated real-return overlay alongside the nominal
   series — see §2.1 below and
   [real-return-reporting-sprint15-2026-09-27.md](real-return-reporting-sprint15-2026-09-27.md).

None of these are bugs — they're scope, already flagged in the team's own docs, and none of them
represent unsound math. They're carried into Sprint 15 as the highest-value next work specifically
*because* this review was asked to check rigor, not just feature completeness.

---

## 2. Sprint 15 plan

### 2.0 Gate — before any new code (Faiz's action, not a sprint task)

`progress.md` §2 already lists these; repeating here because building new features on top of an
exposed production credential is the one thing that would undermine "investment-grade" faster than
any modeling gap:

- **Rotate the Supabase DB password + storage S3 keys** (pasted into chat 2026-09-23 and again
  2026-09-26 to run the migration check) — highest priority open item in the whole project.
- Redeploy Sprint 14, confirm `REGIME_ADJUSTED_DCF_ENABLED`, restart the PC worker, resolve the
  Gemini quota exhaustion.

**Status 2026-09-27:** this gate was not cleared before item #2 was built — Faiz explicitly chose
"proceed with building now" when asked, so the real-return feature below was built on top of the
still-unrotated credentials. The gate remains open for any further Sprint 15 items.

### 2.1 Sprint 15 — closing the "investment-grade" gaps this review surfaced

Ordered by value-per-effort, building only on what's already in the codebase (no new data
providers assumed except where noted):

| # | Item | What it does | Why now | Status |
|---|---|---|---|---|
| 1 | **LLM usage ledger** | Persist `llm_usage_events` for real (currently in-memory, resets on restart) — every Gemini/Mistral/Ollama call, cost, and outcome | Already in the backlog; now also the prerequisite for reasoning about local-vs-cloud LLM economics now that Faiz is moving heavy analysis to Ollama (2026-09-23 decision) | ✅ Built 2026-09-28 (F27) |
| 2 | **Real (inflation-adjusted) return reporting** | Extend Sprint 13's Performance page with a CPI-deflated return series, using the Norway/US CPI series the macro catalogue already stores | Directly closes gap #5 above; cheap because Sprint 13 already computes nominal returns and Sprint 7 already stores CPI — no new provider | ✅ **Built, committed and pushed 2026-09-27 (`243e2e9`)** — [doc](real-return-reporting-sprint15-2026-09-27.md) |
| 3 | **Rate sensitivity per holding** | Floating vs. fixed debt exposure, refinancing wall vs. the policy-rate/yield series Sprint 7 already ingests | Existing backlog item; pairs naturally with the regime work — "which holdings actually feel a rate regime change" is more useful than the regime flag alone | Not started (now Sprint 21) |
| 4 | **Norway yield-curve / credit-spread sourcing** | A real attempt (not just a doc note) to find a free NO series — Norges Bank's statistics API, DNB/Nordea published spread data, or a documented "no free source exists, here's the closest proxy" conclusion | Closes gap #1, or at minimum converts it from "not investigated" to "investigated, blocked, here's why" | ✅ Built 2026-09-28 (F28) |
| 5 | **Nightly tripwire check via the PC worker** | The worker already runs overnight (Sprint 5B) and tripwires already store `fired_at` (Sprint 11) — wire the two together instead of only checking on page-open | Existing backlog item, now low-effort since both halves exist | ✅ Built 2026-09-29 (F29) |
| 6 | **Reporting/export (PDF memo)** | One-holding or portfolio PDF of an analysis run | Existing backlog item; increasingly worth it now that 5 sprints of real analysis output exist to export | Not started (now Sprint 21) |

### 2.2 Explicitly not in Sprint 15 (stays in backlog, unchanged)

Fund annual-report holdings parser, fund look-through valuation, liquidity tier for whisky/metals,
alerts delivery channel (needs Faiz to pick email vs. push), dependency-audit/mypy-in-CI hardening.
No new information this session changes their priority.

---

## 3. Progress captured this session

Everything already built (Sprints 0-14) was independently re-verified against the real repo this
session (`git log`, direct file reads) rather than trusted from prior docs — matches `progress.md`
exactly, no discrepancies found. `docs/decisions/` (the old ADR folder) confirmed empty — consistent
with the 2026-09-21 clean-slate reset; no orphaned ADRs exist in the repo itself, only in the older
Claude project docs (see §4).

---

## 4. Project docs to retire

The project held 60 docs. **33 of them described the app from *before* the 2026-09-21 clean-slate
rebuild** (Phases 0-10, the old ADR-numbered decisions, and the incremental-redesign plan that was
overridden by the rebuild) — that code no longer exists in the repo. Keeping them in the doc list
means a future session (or Faiz) can accidentally reason from a description of a codebase that was
deleted. Recommended deleting all 33 (since deleted from the project; the list is omitted here
because those docs no longer exist).

**Flagged, not deleted:** `cwo-design-redesign.md` (2026-09-14) reads like it belongs to the
*Changing World Order* project, not Aladdin — possibly filed here by mistake. Left alone pending
confirmation rather than deleted blind.

## 5. Code: nothing found to retire

No dead application code was found. The four legacy Phase-3/5 tables
(`analysis_runs`/`holding_analyses`/`factor_assessments`/`evidence_references`,
`investment_theses`/`valuation_cases`/`portfolio_risk_snapshots`) are unused by any current feature,
**but this is intentional, not an oversight** — `app/models/legacy_analysis.py` keeps them
read/delete-only specifically so a snapshot/holding delete can cascade-purge old rows, per the
rebuild's own decision #1 ("leave the existing Supabase schema and data exactly as-is"). Recommend
leaving as-is; flagging here only so it isn't mistaken for dead code by a future audit.
