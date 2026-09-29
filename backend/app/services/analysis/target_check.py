"""Read-time credibility check on a STORED analysis run's price target.

Runs made before the valuation plausibility guard existed (v1 assumptions)
can carry a DCF price target that is wildly off the market price (SB1NO:
a 3,170–4,899 NOK target against a ~150 NOK share). Those rows stay in the
database as an honest record of what was shown; this check flags them when
they are read so the UI can say "not reliable — re-run" instead of
presenting the number as fact.

Uses stored prices only (never a live provider call), so it is cheap enough
to run on every GET.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.valuation_assumptions import get_valuation_assumptions
from app.models.analysis import EquityAnalysisRun
from app.services.thesis.prices import (
    convert_price,
    latest_stored_price,
    stored_price_at_or_before,
)


def stored_target_warning(db: Session, run: EquityAnalysisRun) -> str | None:
    low, high = run.price_target_low, run.price_target_high
    if low is None or high is None or not run.price_target_currency:
        return None
    ratio = get_valuation_assumptions(get_settings().active_valuation_assumptions_version).plausibility_max_ratio
    if not ratio or ratio <= 0:
        return None
    observation = stored_price_at_or_before(db, run.holding_id, run.started_at) or latest_stored_price(
        db, run.holding_id
    )
    if observation is None:
        return None
    price = (
        observation.price
        if observation.currency == run.price_target_currency
        else convert_price(db, observation, run.price_target_currency)
    )
    if price is None or price <= 0:
        return None
    ratio_d = Decimal(str(ratio))
    midpoint = (Decimal(low) + Decimal(high)) / 2
    if midpoint > price * ratio_d or midpoint < price / ratio_d:
        multiple = midpoint / price
        return (
            f"This price target ({low:,.0f}–{high:,.0f} {run.price_target_currency}) is {multiple:.1f}x the "
            f"share price recorded for this run ({price:,.2f}). A gap that large means the DCF inputs, "
            "not the market, are almost certainly wrong. Do not rely on this target or the verdict "
            "that rests on it — re-run the analysis."
        )
    return None
