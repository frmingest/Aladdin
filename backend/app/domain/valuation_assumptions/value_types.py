"""The shape every valuation-assumptions version conforms to — kept
separate from a specific version (v1.py) so a future v2 imports the same
dataclass rather than redefining it."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class ValuationAssumptions:
    version: str

    # Equity risk premium by currency, as a FRACTION (0.045 = 4.5%) —
    # combined with the live risk-free rate and a holding's beta in
    # app/services/valuation/discount_rate.py's CAPM cost of equity.
    equity_risk_premium: dict[str, Decimal] = field(default_factory=dict)
    # Used for a currency with no entry above.
    default_equity_risk_premium: Decimal = Decimal("0.055")

    # Gordon-growth terminal growth rate, as a fraction — must stay below
    # any scenario's discount rate or the terminal-value formula is
    # undefined (app/services/valuation/dcf.py raises rather than dividing
    # by a non-positive number).
    terminal_growth_rate: Decimal = Decimal("0.025")

    # How many years of explicit projection before the terminal value.
    projection_years: int = 10

    # Added to / subtracted from the deterministically-computed historical
    # base-case growth rate (app/services/valuation/growth.py) to produce
    # the bull/bear scenarios — not independent forecasts, just a
    # documented, versioned spread around the base case.
    bull_growth_offset: Decimal = Decimal("0.03")
    bear_growth_offset: Decimal = Decimal("0.03")

    # Used only when a holding's live beta (app/providers/base.py's
    # MarketDataProvider.get_beta) is unavailable.
    default_beta: Decimal = Decimal("1.0")
