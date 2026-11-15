"""v1 regime-aware risk bands (ECON-007, 2026-11-15).

Only the volatility-sized stress shock (funds/ETFs and stocks without a DCF
bear case, app/services/risk/stress.py) is widened. A holding sized from its
own DCF bear case is left alone: that number is company-specific downside,
not a statistical band, so a macro regime has no business rescaling it.
The correlated-cluster threshold is also left alone in this version.

Judgment calls, not fetched data. CLAUDE.md Rule 3 applies: never edit these
numbers once a real risk snapshot has used them with
settings.regime_aware_risk_bands_enabled=True; add a v2 instead.

- baseline: x1.00. The shock is exactly what it was before ECON-007.
- stagflation: x1.25 (2 sigma becomes 2.5 sigma at the default). A moderate
  widening: in this regime returns tend to cluster in the tails more often than
  a calm-market sigma implies, but the classifier is coarse (see regime.py).
- crisis: x1.50 (2 sigma becomes 3 sigma at the default). Larger than
  stagflation because acute credit stress (US HY OAS smoothed >= 6pp) is the
  more severe of the two signals. Daily sigma measured over a mostly calm
  1-year window understates what a stressed market does.

Never below 1: a regime must not make a stress test gentler than baseline.
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.risk_bands.value_types import RiskBands

RISK_BANDS_V1 = RiskBands(
    version="v1",
    shock_multiplier={
        "baseline": Decimal(1),
        "stagflation": Decimal("1.25"),
        "crisis": Decimal("1.5"),
    },
    default_multiplier=Decimal(1),
)
