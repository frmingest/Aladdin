"""Unit tests for app/services/risk/price_history.py's staleness-checked
daily-price cache: fetch-and-store, serve-from-cache-when-fresh, and
fail-visibly fallback to cached data on a provider error — against an
in-memory SQLite DB and a fake provider (no real yfinance calls)."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base
from app.models.risk import PriceHistoryObservation
from app.providers.base import MarketDataUnavailableError, PricePoint
from app.services.risk.price_history import get_or_refresh_daily_history

D = Decimal


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _FakeProvider:
    def __init__(self, *, points=None, error=None):
        self._points = points or []
        self._error = error
        self.calls = 0

    def get_daily_price_history(self, ticker, *, days=400, currency_hint=None):
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._points


def _points(n: int, *, start_price=D("100")) -> list[PricePoint]:
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    out = []
    price = start_price
    for i in range(n):
        out.append(PricePoint(price=price, currency="USD", observed_at=base + timedelta(days=i), provider="fake"))
        price = price + 1
    return out


def test_fetches_and_persists_on_first_call():
    db = _session()
    provider = _FakeProvider(points=_points(40))

    result = get_or_refresh_daily_history(db, provider, ticker="AAPL", currency_hint="USD", lookback_days=365)

    assert result.available
    assert len(result.points) == 40
    assert provider.calls == 1
    assert db.query(PriceHistoryObservation).count() == 40


def test_second_call_within_staleness_window_serves_from_cache():
    db = _session()
    provider = _FakeProvider(points=_points(40))
    get_or_refresh_daily_history(db, provider, ticker="AAPL", currency_hint="USD", lookback_days=365)

    result = get_or_refresh_daily_history(db, provider, ticker="AAPL", currency_hint="USD", lookback_days=365)

    assert provider.calls == 1  # no second network call
    assert result.available
    assert len(result.points) == 40


def test_force_refresh_bypasses_the_cache():
    db = _session()
    provider = _FakeProvider(points=_points(40))
    get_or_refresh_daily_history(db, provider, ticker="AAPL", currency_hint="USD", lookback_days=365)

    get_or_refresh_daily_history(
        db, provider, ticker="AAPL", currency_hint="USD", lookback_days=365, force=True
    )

    assert provider.calls == 2


def test_provider_failure_falls_back_to_cached_data_with_a_reason():
    db = _session()
    good_provider = _FakeProvider(points=_points(40))
    get_or_refresh_daily_history(db, good_provider, ticker="AAPL", currency_hint="USD", lookback_days=365)

    failing_provider = _FakeProvider(error=MarketDataUnavailableError("yahoo is down"))
    result = get_or_refresh_daily_history(
        db, failing_provider, ticker="AAPL", currency_hint="USD", lookback_days=365, force=True
    )

    assert result.available
    assert len(result.points) == 40
    assert result.reason is not None
    assert "yahoo is down" in result.reason


def test_provider_failure_with_no_cache_reports_unavailable_not_crashed():
    db = _session()
    failing_provider = _FakeProvider(error=MarketDataUnavailableError("no data for ticker"))

    result = get_or_refresh_daily_history(
        db, failing_provider, ticker="NEWCO", currency_hint="USD", lookback_days=365
    )

    assert not result.available
    assert result.points == []
    assert "no data for ticker" in (result.reason or "")


def test_refetch_updates_an_existing_day_rather_than_duplicating_it():
    db = _session()
    provider = _FakeProvider(points=_points(40))
    get_or_refresh_daily_history(db, provider, ticker="AAPL", currency_hint="USD", lookback_days=365)

    revised_provider = _FakeProvider(points=_points(40, start_price=D("999")))
    get_or_refresh_daily_history(
        db, revised_provider, ticker="AAPL", currency_hint="USD", lookback_days=365, force=True
    )

    assert db.query(PriceHistoryObservation).count() == 40  # updated in place, not duplicated
    first_row = (
        db.query(PriceHistoryObservation)
        .filter_by(ticker="AAPL")
        .order_by(PriceHistoryObservation.observed_on.asc())
        .first()
    )
    assert first_row.close == D("999")
