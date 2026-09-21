"""Live current-price refresh for one holding — staleness-checked caching
via app/services/market_data/common.py."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.holding import Holding
from app.models.market import MarketObservation
from app.providers.base import MarketDataProvider, MarketDataUnavailableError
from app.services.market_data.common import MarketDataSnapshot, get_or_refresh


def _latest_price(db: Session, holding_id: uuid.UUID) -> MarketObservation | None:
    stmt = (
        select(MarketObservation)
        .where(MarketObservation.holding_id == holding_id)
        .order_by(MarketObservation.observed_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def get_or_refresh_price(
    db: Session, provider: MarketDataProvider, *, holding: Holding, force: bool = False
) -> MarketDataSnapshot[MarketObservation]:
    settings = get_settings()

    def _fetch_and_persist() -> MarketObservation:
        point = provider.get_current_price(holding.ticker, currency_hint=holding.trading_currency)
        observation = MarketObservation(
            holding_id=holding.id,
            observed_at=point.observed_at,
            price=point.price,
            currency=point.currency,
            provider=point.provider,
        )
        db.add(observation)
        db.flush()
        return observation

    return get_or_refresh(
        db,
        latest=lambda: _latest_price(db, holding.id),
        observed_at_of=lambda obs: obs.observed_at,
        fetch_and_persist=_fetch_and_persist,
        stale_after_hours=settings.market_data_stale_after_hours,
        unavailable_error=MarketDataUnavailableError,
        force=force,
    )
