"""v1 valuation assumptions.

These are judgment calls, not fetched data — CLAUDE.md Rule 3 applies (bump
the version, don't edit these numbers once a real analysis has used them):

- Equity risk premium: 4.5% for USD/EUR/GBP/NOK alike. This mirrors the
  long-run mature-market ERP academic/practitioner estimates converge on
  (e.g. Damodaran's published implied-ERP series has hovered in a 4-5%
  band for the US in recent years) applied uniformly rather than adding a
  per-country risk premium on top — Norway, the UK, and the Euro area are
  all investment-grade sovereigns with deep, liquid government bond
  markets, so a material country-risk add-on isn't obviously justified
  for this portfolio's actual holdings today. This is a simplification,
  not a live Damodaran feed — a v2 can refine it (e.g. splitting NOK out,
  or sourcing country risk premia properly) without touching v1.
- Terminal growth rate: 2.5%, roughly a conservative long-run
  nominal-GDP/inflation trend — deliberately below every mapped currency's
  current risk-free rate, so Gordon growth's discount-rate-minus-growth
  denominator stays comfortably positive.
- Bull/bear offsets: +/-3 percentage points around the historical
  base-case growth rate (app/services/valuation/growth.py) — a documented,
  symmetric spread, not independent bull/bear forecasts. The reconciliation
  pass in Sprint 4's analysis engine is where a human/LLM-reviewed
  narrative growth case belongs; Sprint 3's job is a deterministic default,
  not a forecast.
- Default beta: 1.0 (market beta) — used only when a holding's live beta
  is unavailable (app/providers/base.py's MarketDataProvider.get_beta can
  return None).
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.valuation_assumptions.value_types import ValuationAssumptions

VALUATION_ASSUMPTIONS_V1 = ValuationAssumptions(
    version="v1",
    equity_risk_premium={
        "USD": Decimal("0.045"),
        "EUR": Decimal("0.045"),
        "GBP": Decimal("0.045"),
        "NOK": Decimal("0.045"),
    },
    default_equity_risk_premium=Decimal("0.055"),
    terminal_growth_rate=Decimal("0.025"),
    projection_years=10,
    bull_growth_offset=Decimal("0.03"),
    bear_growth_offset=Decimal("0.03"),
    default_beta=Decimal("1.0"),
)
