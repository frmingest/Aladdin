"""The shape every analysis-assumptions version conforms to — mirrors
app/domain/valuation_assumptions/value_types.py's pattern."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class AnalysisAssumptions:
    version: str

    # Brain Step 1.3: "3-5yr avg ROIC/ROE/margins vs. a hurdle (~15%)".
    # A FRACTION (0.15 = 15%), matching app/services/calculations.roe's
    # own fractional convention, so the two are never compared unconverted.
    capital_efficiency_hurdle: Decimal = Decimal("0.15")

    # How many most-recent filed periods the evidence packet averages
    # ROE/margins/leverage ratios over (Brain Step 1.3's "3-5yr").
    history_years: int = 5
