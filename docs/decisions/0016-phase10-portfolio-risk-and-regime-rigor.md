# ADR 0016: Phase 10 — portfolio risk & regime rigor (economist review #2)

**Status:** Proposed. Planning only — no code changed.
**Date:** 2026-09-15
**Follows:** ADR 0014 (macro-economic review #1) — ECON-001 through ECON-006 from that review are
confirmed live in production; only ECON-007 remained open. This ADR is a second economist-lens pass
now that Phase 8 (alternative assets) and Phase 5's real correlation/systemic-risk machinery are
live, asking a narrower question than ADR 0014 did: **given what's actually built, where does the
portfolio-risk and regime logic still fall short of what a working portfolio economist would sign
off on, and where are the numbers actually stale rather than just simplified?**

## Method

Reviewed `scoring/versions/v2.yaml` (regime classification + factor weights), `scoring/versions/
risk_v1.yaml` (risk bands), `app.domain.scoring.classify_macro_regime`, `app.services.
portfolio_risk.builder` and `app.domain.portfolio_risk.pearson_correlation` (real historical-price
correlation, confirmed already built — not a proxy, see ADR 0008), the Norwegian wealth-tax
constants (`app.config.settings`, per ADR 0008 "Settings-driven constants, not versioned config"),
and the DCF scenario-shock magnitudes (ADR 0008, "illustrative/directionally-reasoned"). Cross-checked
the wealth-tax constants against current (2026 tax year) Norwegian rules via web search, since ADR
0008 states they were sourced from 2024 rules and flagged as never re-verified.

## Findings

| ID | Severity | Finding |
|---|---|---|
| ECON-007 *(carried over from ADR 0014, still open)* | 🟠 | `risk_v1.yaml`'s commodity/currency risk bands are static percentages, not regime-aware, even though `scoring/v2.yaml`'s regime classifier already exists and is used for factor weights. |
| ECON-008 | 🟠 | Regime classification (`classify_macro_regime`) reads two US-only series (`us_real_yield_10y`, `us_headline_cpi_yoy`) with hard thresholds, for a NOK-reporting, Norway/Europe-tilted portfolio. Discrete threshold crossings can flip the classified regime — and therefore the factor weights and (once ECON-007 lands) the risk bands — from one macro refresh to the next with no persistence/hysteresis, which sits uneasily next to the app's own reproducibility ethos. |
| ECON-009 | 🟡 | The Pearson correlation matrix (real, historical-price-based — confirmed a genuine strength, not a gap) is computed only across the portfolio's own tickered holdings. It has no synthetic NOK or commodity-benchmark series, so the specific covariance this portfolio actually has — Vår Energi (NOK-denominated oil & gas) moving together with a NOK that is itself commodity/oil-correlated — is never quantified; concentration and currency risk stay two independent dimensions an investor has to mentally recombine. |
| ECON-010 | 🔴 | The Norwegian wealth-tax constants (`bunnfradrag`, rate steps, `share_discount`) were sourced from **2024** rules (ADR 0008) and have not been re-verified since. Confirmed via web search this session: **2026** rules are materially different — bunnfradrag 1.9M NOK single / 3.8M married (vs. 2024's lower threshold), a two-step combined rate (1.0% up to 21.5M, 1.1% above, vs. 2024's structure), and a 20% valuation discount on listed shares/equity funds. Norway revises these figures most fiscal years (Statsbudsjettet 2026 changed them again). This is the one number in the app that turns directly into a real tax-liability estimate a person could act on, so a stale constant here is a different order of problem than an illustrative DCF shock being stale. |
| ECON-011 | 🟡 | No benchmark-relative or real (inflation-adjusted) return reporting. `overall_score` and the portfolio risk band exist with no external reference point — the app already fetches CPI series (for regime classification) and already has `MarketDataProvider.get_historical_prices` (used for correlation), so both a real-return view and a simple benchmark comparison (e.g. OSEBX for the NOK-equity sleeve, a global index for the rest) are buildable from data already in hand. |
| ECON-012 | 🟡 | No liquidity-risk dimension. Phase 8's alternative assets (whisky, physical gold/silver coins) are illiquid and cost-basis-carried; the systemic/state-risk dimension (ADR 0008, §15.1) already exists as a natural place to add a liquidity flag/tier per holding, but nothing currently distinguishes "can sell today at a quoted price" from "no market, no quoted price" in the risk output. |
| ECON-013 | 🔵 | DCF/scenario shock magnitudes remain "illustrative, not fitted to real market data" (ADR 0008) even though realized historical volatility is now already computed for the correlation matrix (Phase 5). Sizing shocks off realized volatility (e.g., a multiple of trailing 1-year annualized volatility per holding) instead of a fixed illustrative percentage is a small, low-cost extension of a pipeline that already exists. |
| ECON-014 | 🔵 | The track-record/calibration engine (architecture §22.5) is still unbuilt, correctly deferred pending live history. That history has now actually started accumulating (first real analysis runs, 2026-09-14/15). Recommend defining the calibration protocol now — what outcome variable, what horizon, how a stated confidence tag gets scored against it — so data collection follows a fixed schema from day one instead of needing a backfill/reinterpretation later. |

## Recommended Phase 10 scope, sequenced by leverage vs. effort

**10a — cheap, do alongside or immediately after Phase 9 (ADR 0012):**
1. **ECON-010** — refresh the Norwegian wealth-tax constants to the 2026 tax year and add a
   "rules current as of tax year 20XX" stamp surfaced wherever the estimate is shown, so staleness
   is visible in the UI itself rather than silent. Small, deterministic, no new dependency.
2. **ECON-007** — make `risk_v1.yaml`'s commodity/currency bands read the same regime classification
   `scoring/v2.yaml` already produces, closing out ADR 0014 entirely.
3. **ECON-013** — size scenario shocks from realized volatility instead of illustrative constants,
   reusing the historical-price fetch Phase 5 already performs for correlation.

**10b — medium, once 10a lands:**
4. **ECON-008** — broaden regime classification beyond two US-only series (add a Norway/Europe
   indicator, e.g. `eurozone_hicp_yoy` and/or `no_policy_rate` real-adjusted), and replace the hard
   threshold cutover with either a persistence rule (N consecutive refreshes before a regime change
   is recorded) or a continuous regime score blended across profiles rather than a discrete switch.
5. **ECON-009** — extend the correlation matrix with a synthetic NOK series (or a trade-weighted NOK
   index) and the relevant commodity benchmark(s) already in the macro registry (`commodity_oil_brent`
   for Vår Energi), and surface a "correlated risk cluster" flag when concentration and currency
   exposure are pointing the same direction rather than leaving them as separate line items.
6. **ECON-012** — add a `liquidity_tier` alongside the existing systemic/state-risk dimension
   (quoted-daily / quoted-infrequent / no-market-cost-basis-only), driven by the same asset-class /
   custody-type fields Phase 8 and ADR 0008 already introduced.

**10c — larger, lower urgency (defer until 10a/10b are live and a few weeks of history exist):**
7. **ECON-011** — benchmark-relative and real-return reporting. Needs a decision on which benchmark(s)
   to track (OSEBX vs. a broader blend) before building.
8. **ECON-014** — define the calibration protocol (schema + scoring rule) now; build the actual
   comparison engine once enough analysis-run history exists to calibrate against.

## Explicitly not proposed

No change to the evidence-first architecture, the confirmation-bias guardrail, or the
Decimal-everywhere discipline — this review found the existing risk/scoring foundation (real
Pearson correlation from historical prices, deterministic wealth-tax and DCF arithmetic, versioned
scoring configs) sound. The gaps above are about widening and refreshing inputs to that foundation,
not replacing it.

## Verification before building

ECON-010's 2026 figures came from a web search this session (Capitalize.no, cross-referenced against
Statsbudsjettet 2026 coverage), not a direct Skatteetaten API call — same category of limitation ADR
0004/0005/0007/0008 already flag for other external data. Worth a direct check against
skatteetaten.no's own published 2026 rates before the constant is actually changed in code.

## For git

**Summary:** Phase 10 planning — portfolio risk & regime rigor, an economist-lens follow-up to ADR
0014 (no code changes)
**Files changed:** `docs/decisions/0016-phase10-portfolio-risk-and-regime-rigor.md` (new),
`docs/PROGRESS.md` (updated)
**Description:** Second economist-lens review, this time of the risk/regime logic that's actually
been built since ADR 0014 (real Pearson correlation from historical prices, the Norwegian wealth-tax
estimator, DCF scenario shocks) rather than re-covering ADR 0014's original seven findings (ECON-007
remains open and is folded into this plan). Found the wealth-tax constants were sourced from 2024
rules and never re-verified — confirmed via web search that 2026 rules changed materially
(bunnfradrag, rate steps) — the highest-severity finding here since it's the one number in the app
that becomes a real tax-liability figure someone could act on. Also flagged: regime classification is
US-only with hard thresholds despite a NOK/Europe-tilted portfolio; the real correlation matrix has
no NOK or commodity-benchmark series so the oil-equity/oil-currency covariance specific to this
portfolio is never quantified; no liquidity-risk dimension for Phase 8's illiquid alternative assets;
no benchmark-relative or real-return reporting; DCF/scenario shocks still illustrative rather than
fitted to the realized volatility the app already computes; and the track-record/calibration engine
(§22.5) should have its protocol defined now that real analysis-run history has started accumulating.
Proposed as Phase 10, sequenced 10a (cheap: wealth-tax refresh, regime-aware risk bands, volatility-
fitted shocks) → 10b (medium: broaden/smooth regime classification, extend correlation matrix,
liquidity tier) → 10c (larger, deferred: benchmark/real-return reporting, calibration engine).
Planning only, no application code touched.
