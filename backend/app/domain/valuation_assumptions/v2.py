"""v2 valuation assumptions (2026-09-29).

Same market inputs as v1 (equity risk premium, terminal growth, scenario
offsets, default beta) plus the guardrails that keep a deterministic model
from publishing a number nobody should trust. Why each one exists is in
docs/sb1no-implausible-dcf-investigation-2026-09-29.md; in short, SB1NO.OL
(a Norwegian bank) showed a DCF value of 3,953 NOK against a 229.50 NOK
price — a 31.5% historical CAGR compounded for 10 years, on earnings that
a bank cannot distribute.

These are judgment calls, not fetched data. CLAUDE.md Rule 3: do not edit
these numbers once a real analysis has used them — add v3.py instead.

- max_base_growth 10%: above long-run nominal GDP by a wide margin, but
  it still lets a genuinely fast grower be valued as a grower. Anything
  faster is treated as a fact about the past, not a forecast.
- fade to terminal: growth decays linearly to the 2.5% terminal rate by
  the final projection year (competitive advantage erodes; nobody
  compounds at 10% for a decade and then drops to 2.5% overnight).
- min_cost_of_equity 8%: a floor under CAPM. With a Norwegian risk-free
  rate near 4.3% and a bank beta near 0.5, CAPM gives ~6.7%, which is below
  the return an equity investor requires for bank risk.
- plausibility_max_ratio 3x: a value more than 3x (or less than a third of)
  the market price means the inputs are wrong far more often than the
  market is; the value is withheld and the reason shown.
- financials: justified P/B on the average of up to 5 years of ROE, capped
  at 20%, with +/-2 points of ROE for bull/bear.
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.sectors import FINANCIAL_SECTOR_KEYWORDS
from app.domain.valuation_assumptions.v1 import VALUATION_ASSUMPTIONS_V1
from app.domain.valuation_assumptions.value_types import ValuationAssumptions

VALUATION_ASSUMPTIONS_V2 = ValuationAssumptions(
    version="v2",
    equity_risk_premium=dict(VALUATION_ASSUMPTIONS_V1.equity_risk_premium),
    default_equity_risk_premium=VALUATION_ASSUMPTIONS_V1.default_equity_risk_premium,
    terminal_growth_rate=VALUATION_ASSUMPTIONS_V1.terminal_growth_rate,
    projection_years=VALUATION_ASSUMPTIONS_V1.projection_years,
    bull_growth_offset=VALUATION_ASSUMPTIONS_V1.bull_growth_offset,
    bear_growth_offset=VALUATION_ASSUMPTIONS_V1.bear_growth_offset,
    default_beta=VALUATION_ASSUMPTIONS_V1.default_beta,
    max_base_growth=Decimal("0.10"),
    fade_growth_to_terminal=True,
    min_cost_of_equity=Decimal("0.08"),
    plausibility_max_ratio=Decimal(3),
    financials_sector_keywords=FINANCIAL_SECTOR_KEYWORDS,
    financials_roe_history_years=5,
    financials_max_roe=Decimal("0.20"),
    financials_roe_spread=Decimal("0.02"),
)
