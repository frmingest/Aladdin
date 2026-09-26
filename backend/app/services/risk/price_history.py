"""Staleness-checked daily-price-history cache for the risk module.

One ticker's cached rows (app/models/risk.py's PriceHistoryObservation)
are refreshed as a whole batch when the newest cached row's `fetched_at`
is older than `risk_price_history_stale_after_hours` (default 24h,
app/config/settings.py) — the same staleness discipline as
app/services/market_data/common.py, generalized from one scalar
observation to a whole time series, since that module's `get_or_refresh`
is typed for a single value, not a list.

Fail-visibly (CLAUDE.md): a provider failure never crashes the request. If
cached rows already exist, they're served (now possibly stale) with a
`reason` saying so. If none exist, the ticker is reported unavailable with
the reason, and the caller (app/services/risk/portfolio_risk.py) excludes
it from the correlation matrix rather than guessing a price.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.risk import PriceHistoryObservation
from app.providers.base import MarketDataProvider, MarketDataUnavailableError


@dataclass
class TickerHistory:
    ticker: str
    available: bool
    currency: str | None = None
    points: list[tuple[date, Decimal]] = field(default_factory=list)  # oldest first
    as_of: datetime | None = None
    reason: str | None = None


def _stored_points(db: Session, ticker: str, *, since: date) -> list[PriceHistoryObservation]:
    stmt = (
        select(PriceHistoryObservation)
        .where(PriceHistoryObservation.ticker == ticker, PriceHistoryObservation.observed_on >= since)
        .order_by(PriceHistoryObservation.observed_on.asc())
    )
    return list(db.scalars(stmt))


def _newest_fetch(db: Session, ticker: str) -> datetime | None:
    stmt = select(PriceHistoryObservation.fetched_at).where(PriceHistoryObservation.ticker == ticker).order_by(
        PriceHistoryObservation.fetched_at.desc()
    ).limit(1)
    return db.scalar(stmt)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def get_or_refresh_daily_history(
    db: Session,
    provider: MarketDataProvider,
    *,
    ticker: str,
    currency_hint: str | None,
    lookback_days: int,
    force: bool = False,
) -> TickerHistory:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=lookback_days)).date()
    newest_fetch = _newest_fetch(db, ticker)
    is_fresh = (
        newest_fetch is not None
        and (now - _aware(newest_fetch)).total_seconds() / 3600 <= settings.risk_price_history_stale_after_hours
    )

    if not force and is_fresh:
        rows = _stored_points(db, ticker, since=since)
        if rows:
            return TickerHistory(
                ticker=ticker,
                available=True,
                currency=rows[-1].currency,
                points=[(r.observed_on, r.close) for r in rows],
                as_of=_aware(newest_fetch),
            )

    try:
        # Fetch a little more than the lookback so the oldest requested day
        # still has a prior day to compute a return from.
        fetched = provider.get_daily_price_history(
            ticker, days=lookback_days + 10, currency_hint=currency_hint
        )
    except MarketDataUnavailableError as exc:
        rows = _stored_points(db, ticker, since=since)
        if rows:
            return TickerHistory(
                ticker=ticker,
                available=True,
                currency=rows[-1].currency,
                points=[(r.observed_on, r.close) for r in rows],
                as_of=_aware(newest_fetch) if newest_fetch else None,
                reason=f"refresh failed, showing cached data: {exc}",
            )
        return TickerHistory(ticker=ticker, available=False, reason=str(exc))

    existing_by_date = {r.observed_on: r for r in _stored_points(db, ticker, since=date(1900, 1, 1))}
    for point in fetched:
        observed_on = point.observed_at.date()
        existing = existing_by_date.get(observed_on)
        if existing is not None:
            existing.close = point.price
            existing.currency = point.currency
            existing.provider = point.provider
            existing.fetched_at = now
        else:
            row = PriceHistoryObservation(
                ticker=ticker,
                observed_on=observed_on,
                close=point.price,
                currency=point.currency,
                provider=point.provider,
                fetched_at=now,
            )
            db.add(row)
            existing_by_date[observed_on] = row
    db.commit()

    rows = _stored_points(db, ticker, since=since)
    if not rows:
        return TickerHistory(ticker=ticker, available=False, reason="no daily closes in the requested window")
    return TickerHistory(
        ticker=ticker, available=True, currency=rows[-1].currency,
        points=[(r.observed_on, r.close) for r in rows], as_of=now,
    )
