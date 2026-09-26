"""v1 regime-to-discount-rate adjustments (Sprint 14, 2026-09-26 —
backlog "Regime → DCF factor-weight wiring", deferred at Sprint 12 as
Faiz's call: app/services/risk/regime.py classifies a macro regime but
Sprint 12 deliberately did not let it change any valuation output).

Judgment calls, not fetched data — CLAUDE.md Rule 3 applies (bump the
version, don't edit these numbers once a real analysis/valuation has used
them with settings.regime_adjusted_dcf_enabled=True):

- baseline: +0bps. No crisis or stagflation signal — the plain CAPM
  discount rate stands, exactly as before this sprint.
- stagflation: +150bps. app/services/risk/regime.py's own explanation text
  for this regime already argues "a higher terminal discount rate is more
  defensible than the baseline assumption" — 1.5 percentage points is a
  moderate, round-number widening, not a precise risk-premium estimate
  derived from the underlying spread level.
- crisis: +300bps. Mirrors the same module's crisis explanation ("discount
  rates used for valuation should reflect wider spreads, not just the
  risk-free rate") — sized larger than stagflation because acute credit
  stress (US HY OAS smoothed >= 6pp) is the more severe of the two signals
  this classifier can produce.

These are round-number, directional adjustments, not a credit-spread
pass-through model, because the regime classifier itself is deliberately
coarse (three buckets from four macro series — see regime.py's own
docstring). A future v2 could size the addon off the actual HY spread
level instead of a fixed per-bucket constant, without touching v1.

Never negative: a regime should never make the required return *lower*
than the baseline CAPM rate in this version — the qualitative case for
"discount less in a given regime" isn't one this deliberately coarse
classifier can support.
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.regime_adjustments.value_types import RegimeAdjustments

REGIME_ADJUSTMENTS_V1 = RegimeAdjustments(
    version="v1",
    discount_rate_addon={
        "baseline": Decimal(0),
        "stagflation": Decimal("0.015"),
        "crisis": Decimal("0.03"),
    },
    default_addon=Decimal(0),
)
