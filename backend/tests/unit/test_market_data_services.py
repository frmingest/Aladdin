"""Unit tests for app/services/market_data/{common,price,fx,risk_free_rate}.py's
staleness-check/caching/refresh logic, against an in-memory SQLite DB and
fake providers (no real network/yfinance/FRED calls)."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.market import FxObservation, MarketObservation, RiskFreeRateObservation
from app.providers.base import (
    FxRate,
    MarketDataUnavailableError,
    PricePoint,
    RiskFreeRate,
    RiskFreeRateUnavailableError,
)
from app.services.market_data.fx import get_or_refresh_fx
from app.services.market_data.price import get_or_refresh_price
from app.services.market_data.risk_free_rate import get_or_refresh_risk_free_rate


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _FakeMarketDataProvider:
    def __init__(self, *, price: PricePoint | None = None, fx: FxRate | None = None, error: Exception | None = None):
        self._price = price
        self._fx = fx
        self._error = error
        self.calls = 0

    def get_current_price(self, ticker, *, currency_hint=None):
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._price

    def get_fx_rate(self, from_currency, to_currency):
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._fx

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover - unused here
        raise NotImplementedError

    def get_beta(self, ticker):  # pragma: no cover - unused here
        return None


class _FakeRiskFreeRateProvider:
    def __init__(self, *, rate: RiskFreeRate | None = None, error: Exception | None = None):
        self._rate = rate
        self._error = error
        self.calls = 0

    def get_risk_free_rate(self, currency):
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._rate


def _price_point(price="225.50", currency="USD") -> PricePoint:
    return PricePoint(price=Decimal(price), currency=currency, observed_at=datetime.now(timezone.utc), provider="yfinance")


def _fx_rate(rate="10.55") -> FxRate:
    return FxRate(
        from_currency="USD", to_currency="NOK", rate=Decimal(rate),
        observed_at=datetime.now(timezone.utc), provider="yfinance",
    )


def _risk_free_rate(rate="4.25") -> RiskFreeRate:
    return RiskFreeRate(
        currency="USD", rate=Decimal(rate), observed_at=datetime.now(timezone.utc),
        provider="fred", source_series_id="DGS10",
    )


# --- price -------------------------------------------------------------


def test_price_calls_provider_and_persists_when_no_cache_exists():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        db.add(holding)
        db.commit()

        provider = _FakeMarketDataProvider(price=_price_point())
        snapshot = get_or_refresh_price(db, provider, holding=holding)

        assert snapshot.available is True
        assert snapshot.value.price == Decimal("225.50")
        assert provider.calls == 1
        assert db.query(MarketObservation).count() == 1


def test_price_second_call_is_served_from_cache():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        db.add(holding)
        db.commit()

        provider = _FakeMarketDataProvider(price=_price_point())
        get_or_refresh_price(db, provider, holding=holding)
        get_or_refresh_price(db, provider, holding=holding)

        assert provider.calls == 1


def test_price_force_refreshes_even_when_fresh():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        db.add(holding)
        db.commit()

        provider = _FakeMarketDataProvider(price=_price_point())
        get_or_refresh_price(db, provider, holding=holding)
        get_or_refresh_price(db, provider, holding=holding, force=True)

        assert provider.calls == 2
        assert db.query(MarketObservation).count() == 2


def test_price_refetches_once_stale():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        db.add(holding)
        db.flush()
        db.add(
            MarketObservation(
                holding_id=holding.id,
                observed_at=datetime.now(timezone.utc) - timedelta(hours=48),
                price=Decimal(100),
                currency="USD",
                provider="yfinance",
            )
        )
        db.commit()

        provider = _FakeMarketDataProvider(price=_price_point(price="230"))
        snapshot = get_or_refresh_price(db, provider, holding=holding)

        assert provider.calls == 1
        assert snapshot.value.price == Decimal(230)


def test_price_falls_back_to_stale_cache_on_provider_failure():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        db.add(holding)
        db.flush()
        old_observed_at = datetime.now(timezone.utc) - timedelta(hours=48)
        db.add(
            MarketObservation(
                holding_id=holding.id, observed_at=old_observed_at, price=Decimal(100),
                currency="USD", provider="yfinance",
            )
        )
        db.commit()

        provider = _FakeMarketDataProvider(error=MarketDataUnavailableError("Yahoo is down"))
        snapshot = get_or_refresh_price(db, provider, holding=holding)

        assert snapshot.available is True
        assert snapshot.value.price == Decimal(100)
        assert "Yahoo is down" in snapshot.reason


def test_price_reports_unavailable_when_no_cache_and_provider_fails():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        db.add(holding)
        db.commit()

        provider = _FakeMarketDataProvider(error=MarketDataUnavailableError("no ticker"))
        snapshot = get_or_refresh_price(db, provider, holding=holding)

        assert snapshot.available is False
        assert snapshot.value is None
        assert "no ticker" in snapshot.reason


# --- fx ------------------------------------------------------------------


def test_fx_calls_provider_and_persists_when_no_cache_exists():
    with _session() as db:
        provider = _FakeMarketDataProvider(fx=_fx_rate())
        snapshot = get_or_refresh_fx(db, provider, from_currency="usd", to_currency="nok")

        assert snapshot.available is True
        assert snapshot.value.rate == Decimal("10.55")
        assert db.query(FxObservation).count() == 1


def test_fx_second_call_is_served_from_cache():
    with _session() as db:
        provider = _FakeMarketDataProvider(fx=_fx_rate())
        get_or_refresh_fx(db, provider, from_currency="USD", to_currency="NOK")
        get_or_refresh_fx(db, provider, from_currency="USD", to_currency="NOK")
        assert provider.calls == 1


# --- risk-free rate --------------------------------------------------------


def test_risk_free_rate_calls_provider_and_persists_when_no_cache_exists():
    with _session() as db:
        provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate())
        snapshot = get_or_refresh_risk_free_rate(db, provider, currency="usd")

        assert snapshot.available is True
        assert snapshot.value.rate == Decimal("4.25")
        assert snapshot.value.source_series_id == "DGS10"
        assert db.query(RiskFreeRateObservation).count() == 1


def test_risk_free_rate_falls_back_to_stale_cache_on_provider_failure():
    with _session() as db:
        old_observed_at = datetime.now(timezone.utc) - timedelta(hours=48)
        db.add(
            RiskFreeRateObservation(
                currency="USD", rate=Decimal("4.00"), observed_at=old_observed_at,
                provider="fred", source_series_id="DGS10",
            )
        )
        db.commit()

        provider = _FakeRiskFreeRateProvider(error=RiskFreeRateUnavailableError("FRED down"))
        snapshot = get_or_refresh_risk_free_rate(db, provider, currency="USD")

        assert snapshot.available is True
        assert snapshot.value.rate == Decimal("4.00")
        assert "FRED down" in snapshot.reason
