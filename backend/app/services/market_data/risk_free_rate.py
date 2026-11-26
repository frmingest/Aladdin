"""Live risk-free-rate refresh for one currency — staleness-checked
caching via app/services/market_data/common.py. Feeds the DCF discount
rate (app/services/valuation/discount_rate.py).

Staleness is judged by when the row was fetched (`created_at`), not by
`observed_at`: FRED's series are monthly, so `observed_at` (the month the
yield covers) is always weeks old, and judging by it refetched FRED and
added a duplicate row on every valuation (#473)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.market import RiskFreeRateObservation
from app.providers.base import RiskFreeRateProvider, RiskFreeRateUnavailableError
from app.services.market_data.common import MarketDataSnapshot, get_or_refresh


def _latest_risk_free_rate(db: Session, currency: str) -> RiskFreeRateObservation | None:
    stmt = (
        select(RiskFreeRateObservation)
        .where(RiskFreeRateObservation.currency == currency)
        # created_at breaks ties: rows written before #473 repeat the same month, and the newest fetch wins.
        .order_by(RiskFreeRateObservation.observed_at.desc(), RiskFreeRateObservation.created_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def get_or_refresh_risk_free_rate(
    db: Session,
    provider: RiskFreeRateProvider,
    *,
    currency: str,
    force: bool = False,
    refresh_live: bool = True,
) -> MarketDataSnapshot[RiskFreeRateObservation]:
    settings = get_settings()
    currency = currency.upper()

    def _fetch_and_persist() -> RiskFreeRateObservation:
        rate = provider.get_risk_free_rate(currency)
        observation = RiskFreeRateObservation(
            currency=rate.currency,
            rate=rate.rate,
            observed_at=rate.observed_at,
            provider=rate.provider,
            source_series_id=rate.source_series_id,
        )
        db.add(observation)
        db.flush()
        return observation

    return get_or_refresh(
        db,
        latest=lambda: _latest_risk_free_rate(db, currency),
        observed_at_of=lambda obs: obs.observed_at,
        # #473: FRED's observed_at is the month the yield covers (weeks old), so judge staleness by fetch time.
        fetched_at_of=lambda obs: obs.created_at,
        fetch_and_persist=_fetch_and_persist,
        stale_after_hours=settings.risk_free_rate_stale_after_hours,
        unavailable_error=RiskFreeRateUnavailableError,
        force=force,
        refresh_live=refresh_live,
    )
