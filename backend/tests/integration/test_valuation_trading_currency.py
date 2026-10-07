"""The valuation API adds the holding's own (trading) currency and the stored
FX rate into it, so the UI can show "USD 42.57 ≈ NOK 425.70" for a company that
reports in a different currency than it trades in (Equinor: NOK listing, USD
filings). Display only; the valuation itself stays in the filing's currency.
See app/api/valuation.py::_with_trading_currency."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.api.valuation import _with_trading_currency
from app.models.holding import Holding
from app.models.market import FxObservation
from app.providers.base import FxRate, MarketDataUnavailableError
from app.schemas.valuation import HoldingValuationOut

D = Decimal


class _FxProvider:
    name = "fake"

    def __init__(self, rate: Decimal | None):
        self._rate = rate
        self.calls = 0

    def get_fx_rate(self, from_currency, to_currency):
        self.calls += 1
        if self._rate is None:
            raise MarketDataUnavailableError("no fx configured")
        return FxRate(
            from_currency=from_currency, to_currency=to_currency, rate=self._rate,
            observed_at=datetime.now(timezone.utc), provider=self.name,
        )


def _out(valuation_currency: str | None) -> HoldingValuationOut:
    # Only the fields the helper reads; the rest are irrelevant to it.
    return HoldingValuationOut.model_construct(
        holding_id=None, ticker="EQNR.OL", valuation_currency=valuation_currency,
        trading_currency=None, trading_currency_fx_rate=None,
    )


def _holding(db_session, trading_currency="NOK") -> Holding:
    holding = Holding(ticker="EQNR.OL", name="Equinor ASA", trading_currency=trading_currency, asset_class_raw="stock")
    db_session.add(holding)
    db_session.flush()
    return holding


def _store_fx(db_session, rate: str) -> None:
    db_session.add(
        FxObservation(
            from_currency="USD", to_currency="NOK", rate=D(rate),
            observed_at=datetime.now(timezone.utc), provider="fake",
        )
    )
    db_session.flush()


def test_stored_rate_is_added_when_currencies_differ(client, db_session):
    holding = _holding(db_session)
    _store_fx(db_session, "10.5")
    provider = _FxProvider(rate=None)

    out = _with_trading_currency(db_session, provider, holding, _out("USD"))

    assert out.trading_currency == "NOK"
    assert out.trading_currency_fx_rate == D("10.5")
    assert provider.calls == 0  # a plain GET never calls the vendor


def test_no_stored_rate_reports_the_currency_but_no_rate_and_never_calls_the_vendor(client, db_session):
    holding = _holding(db_session)
    provider = _FxProvider(rate=D("10"))

    out = _with_trading_currency(db_session, provider, holding, _out("USD"))

    assert out.trading_currency == "NOK"
    assert out.trading_currency_fx_rate is None
    assert provider.calls == 0


def test_refresh_may_fetch_the_rate(client, db_session):
    holding = _holding(db_session)
    provider = _FxProvider(rate=D("10"))

    out = _with_trading_currency(db_session, provider, holding, _out("USD"), force_refresh=True)

    assert out.trading_currency == "NOK"
    assert out.trading_currency_fx_rate == D("10")
    assert provider.calls == 1


def test_same_currency_adds_nothing(client, db_session):
    holding = _holding(db_session, trading_currency="USD")
    out = _with_trading_currency(db_session, _FxProvider(rate=D("10")), holding, _out("usd"))
    assert out.trading_currency is None
    assert out.trading_currency_fx_rate is None


def test_unknown_valuation_currency_adds_nothing(client, db_session):
    holding = _holding(db_session)
    out = _with_trading_currency(db_session, _FxProvider(rate=D("10")), holding, _out(None))
    assert out.trading_currency is None
    assert out.trading_currency_fx_rate is None
