"""
Deterministic DCF valuation (architecture §17, §26 Phase 5).

"Valuation should become deterministic wherever practical. ... The
application calculates valuation outputs. The LLM critiques [the
assumptions]." This module is the calculation half — a plain discounted
free-cash-flow model over the assumption set §17 lists explicitly
(revenue_growth, margin, capex, tax, discount_rate, terminal_growth,
commodity_price, fx, shares_outstanding). The LLM critique half lives in
app.services.valuation.dcf, and is a separate, best-effort step over this
function's output — never a substitute for it (§2.2).

Simplifications, stated rather than hidden (§21):
- One constant annual revenue-growth rate and one constant margin over the
  whole projection window — not a multi-stage ramp. A more granular model
  is a natural v2 (see scoring/scenarios-style versioning precedent) once
  there's a reason to need one.
- `commodity_price_assumption` has no defined mechanics in §17 beyond being
  "an assumption" — here it's applied as a direct multiplier on the base
  revenue being projected from (e.g. 1.20 for a +20% commodity-price
  scenario), which only makes sense for a commodity-revenue-sensitive
  holding. It's optional and does nothing to the calculation when omitted.
- No debt schedule — `net_debt` (if supplied) is subtracted once, at
  today's level, to go from enterprise to equity value; it is not
  amortized or refinanced across the projection window.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.calculations import quantize

_DEFAULT_PROJECTION_YEARS = 5


@dataclass(frozen=True)
class ValuationAssumptions:
    revenue_growth_pct: Decimal
    margin_pct: Decimal
    capex_pct_of_revenue: Decimal
    tax_rate_pct: Decimal
    discount_rate_pct: Decimal
    terminal_growth_pct: Decimal
    shares_outstanding: Decimal
    projection_years: int = _DEFAULT_PROJECTION_YEARS
    commodity_price_multiplier: Decimal | None = None
    fx_rate_to_reporting: Decimal | None = None
    net_debt: Decimal | None = None


@dataclass(frozen=True)
class ValuationResult:
    value_per_share: Decimal | None
    enterprise_value: Decimal | None
    equity_value: Decimal | None
    projected_fcf: list[Decimal] = field(default_factory=list)
    terminal_value: Decimal | None = None
    confidence: str = "low"  # low | medium | high — see _assess_confidence
    note: str | None = None  # populated when value_per_share is None, explaining why


def compute_dcf_value(base_revenue: Decimal | None, assumptions: ValuationAssumptions) -> ValuationResult:
    """A plain 5-year (configurable) explicit-FCF + Gordon-growth-terminal-
    value DCF. Returns a ValuationResult with value_per_share=None and `note`
    explaining why, rather than a fabricated number, whenever the inputs
    don't support a mathematically defined answer (§21)."""
    if base_revenue is None or base_revenue <= 0:
        return ValuationResult(None, None, None, note="no positive base revenue available to project from")
    if assumptions.shares_outstanding is None or assumptions.shares_outstanding <= 0:
        return ValuationResult(None, None, None, note="shares_outstanding must be positive")
    if assumptions.projection_years < 1:
        return ValuationResult(None, None, None, note="projection_years must be at least 1")

    discount_rate = assumptions.discount_rate_pct / Decimal("100")
    terminal_growth = assumptions.terminal_growth_pct / Decimal("100")
    if discount_rate <= terminal_growth:
        return ValuationResult(
            None, None, None,
            note="discount_rate must exceed terminal_growth for a mathematically defined terminal value",
        )

    growth = assumptions.revenue_growth_pct / Decimal("100")
    margin = assumptions.margin_pct / Decimal("100")
    capex_pct = assumptions.capex_pct_of_revenue / Decimal("100")
    tax_rate = assumptions.tax_rate_pct / Decimal("100")

    revenue = base_revenue
    if assumptions.commodity_price_multiplier is not None:
        revenue = revenue * assumptions.commodity_price_multiplier

    pv_sum = Decimal("0")
    projected_fcf: list[Decimal] = []
    fcf_final = Decimal("0")
    for year in range(1, assumptions.projection_years + 1):
        revenue = revenue * (Decimal("1") + growth)
        ebit = revenue * margin
        nopat = ebit * (Decimal("1") - tax_rate)
        capex = revenue * capex_pct
        fcf = nopat - capex
        discount_factor = (Decimal("1") + discount_rate) ** year
        pv_sum += fcf / discount_factor
        projected_fcf.append(quantize(fcf))
        fcf_final = fcf

    terminal_value = fcf_final * (Decimal("1") + terminal_growth) / (discount_rate - terminal_growth)
    pv_terminal = terminal_value / (Decimal("1") + discount_rate) ** assumptions.projection_years

    enterprise_value = pv_sum + pv_terminal
    equity_value = enterprise_value - (assumptions.net_debt or Decimal("0"))

    if assumptions.fx_rate_to_reporting is not None:
        enterprise_value *= assumptions.fx_rate_to_reporting
        equity_value *= assumptions.fx_rate_to_reporting

    value_per_share = equity_value / assumptions.shares_outstanding

    return ValuationResult(
        value_per_share=quantize(value_per_share),
        enterprise_value=quantize(enterprise_value),
        equity_value=quantize(equity_value),
        projected_fcf=projected_fcf,
        terminal_value=quantize(terminal_value),
        confidence=_assess_confidence(assumptions, projected_fcf),
    )


def _assess_confidence(assumptions: ValuationAssumptions, projected_fcf: list[Decimal]) -> str:
    """A deterministic heuristic on how much weight the *shape* of the
    inputs supports — not a judgment on whether the assumptions are
    realistic (that's the LLM critique's job, §17). "high" requires a
    comfortable discount/terminal-growth spread, a plausible margin, and
    every projected year's FCF being positive; anything structurally
    negative or razor-thin drops to "low" rather than implying false
    precision (§13.3)."""
    discount_terminal_spread = assumptions.discount_rate_pct - assumptions.terminal_growth_pct
    margin_ok = Decimal("0") < assumptions.margin_pct <= Decimal("70")
    tax_ok = Decimal("0") <= assumptions.tax_rate_pct <= Decimal("60")
    all_fcf_positive = bool(projected_fcf) and all(fcf > 0 for fcf in projected_fcf)

    if not all_fcf_positive or not margin_ok:
        return "low"
    if discount_terminal_spread >= Decimal("3") and tax_ok:
        return "high"
    return "medium"
