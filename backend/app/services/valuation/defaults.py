"""
Valuation-case default suggestions (ECON-001, docs/decisions/0014, §17).

Orchestration layer over app.domain.discount_rate: reads the latest
persisted macro observations (app.services.research.macro, no provider
call — §2.7) and the latest FxObservation for a holding's currency pair
(app.models.market_data, populated by Phase 2's market-data refresh), and
turns them into the suggestions app.api.valuation exposes at
GET /valuation/holdings/{holding_id}/defaults for the frontend to show next
to the discount_rate_pct / fx_rate_to_reporting fields before the user
types a number (§21 — visible anchor, never a silent substitution).
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.domain.discount_rate import (
    DiscountRateSuggestion,
    FxRateSuggestion,
    load_discount_rate_config,
    suggest_discount_rate,
    suggest_fx_rate,
)
from app.models.holding import Holding
from app.models.market_data import FxObservation
from app.services.research.macro import get_latest_macro_snapshot


@dataclass(frozen=True)
class ValuationDefaults:
    discount_rate: DiscountRateSuggestion
    fx_rate: FxRateSuggestion


def get_valuation_defaults(
    db: Session, holding: Holding, settings: Settings | None = None
) -> ValuationDefaults:
    settings = settings or get_settings()

    config = load_discount_rate_config(settings.active_discount_rate_version)
    snapshot = get_latest_macro_snapshot(db)
    latest_series_values = {obs.series_key: (obs.value, obs.observed_at) for obs in snapshot.observations}
    discount_rate = suggest_discount_rate(holding.trading_currency, latest_series_values, config)

    reporting_currency = settings.default_reporting_currency
    latest_fx = (
        db.query(FxObservation)
        .filter(
            FxObservation.from_currency == holding.trading_currency.upper(),
            FxObservation.to_currency == reporting_currency.upper(),
        )
        .order_by(FxObservation.observed_at.desc())
        .first()
    )
    fx_rate = suggest_fx_rate(
        holding.trading_currency,
        reporting_currency,
        (latest_fx.rate, latest_fx.observed_at) if latest_fx is not None else None,
    )

    return ValuationDefaults(discount_rate=discount_rate, fx_rate=fx_rate)
