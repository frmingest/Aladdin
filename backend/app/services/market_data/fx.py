"""Live FX-rate refresh for one currency pair — staleness-checked caching
via app/services/market_data/common.py."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.market import FxObservation
from app.providers.base import MarketDataProvider, MarketDataUnavailableError
from app.services.market_data.common import MarketDataSnapshot, get_or_refresh


def _latest_fx(db: Session, from_currency: str, to_currency: str) -> FxObservation | None:
    stmt = (
        select(FxObservation)
        .where(FxObservation.from_currency == from_currency, FxObservation.to_currency == to_currency)
        .order_by(FxObservation.observed_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def get_or_refresh_fx(
    db: Session,
    provider: MarketDataProvider,
    *,
    from_currency: str,
    to_currency: str,
    force: bool = False,
) -> MarketDataSnapshot[FxObservation]:
    settings = get_settings()
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    def _fetch_and_persist() -> FxObservation:
        fx_rate = provider.get_fx_rate(from_currency, to_currency)
        observation = FxObservation(
            from_currency=fx_rate.from_currency,
            to_currency=fx_rate.to_currency,
            rate=fx_rate.rate,
            observed_at=fx_rate.observed_at,
            provider=fx_rate.provider,
        )
        db.add(observation)
        db.flush()
        return observation

    return get_or_refresh(
        db,
        latest=lambda: _latest_fx(db, from_currency, to_currency),
        observed_at_of=lambda obs: obs.observed_at,
        fetch_and_persist=_fetch_and_persist,
        stale_after_hours=settings.market_data_stale_after_hours,
        unavailable_error=MarketDataUnavailableError,
        force=force,
    )
