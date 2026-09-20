"""
Integration tests for GET /valuation/holdings/{holding_id}/defaults
(ECON-001 fix, docs/decisions/0014-macro-economic-review.md). Uses the same
FakeMacroDataProvider/FakeMarketDataProvider pattern as
tests/integration/test_research_api.py and test_valuation_api.py — never
touches FRED/Norges Bank/yfinance.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.main import app
from app.providers.base import (
    DividendObservation,
    FxRate,
    MacroDataProvider,
    MacroSeriesPoint,
    MarketDataProvider,
    MarketDataUnavailableError,
    MarketMetadata,
    PriceObservation,
)
from app.providers.base import ResearchProvider
from app.providers.factory import get_macro_data_provider, get_market_data_provider, get_research_provider
from tests.support import make_portfolio_csv

NOK_CSV = make_portfolio_csv(["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,Test holding"])
USD_CSV = make_portfolio_csv(["AAPL,Apple,Aksje,10,100,150,USD,Technology,Test holding"])


class FakeMacroDataProvider(MacroDataProvider):
    def get_latest(self, series_key):
        return MacroSeriesPoint(
            series_key=series_key,
            value=Decimal("5.33"),
            unit="percent",
            observed_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
            provider="fred" if series_key.startswith("us_") else "norges_bank",
            region="US" if series_key.startswith("us_") else "NO",
        )

    def get_series(self, series_key, start, end):
        return [self.get_latest(series_key)]


class FakeMarketDataProvider(MarketDataProvider):
    """Only get_fx_rate/get_latest_price matter for these tests."""

    def get_latest_price(self, ticker: str) -> PriceObservation:
        return PriceObservation(
            ticker=ticker,
            price=Decimal("150.00"),
            currency="USD",
            observed_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
            provider="fake",
            status="delayed",
        )

    def get_historical_prices(self, ticker, start, end):
        raise NotImplementedError

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        from_currency, to_currency = from_currency.upper(), to_currency.upper()
        if from_currency == to_currency:
            return FxRate(from_currency, to_currency, Decimal("1"), datetime.now(timezone.utc), "fake")
        if (from_currency, to_currency) == ("USD", "NOK"):
            return FxRate(from_currency, to_currency, Decimal("10.5"), datetime(2026, 9, 1, tzinfo=timezone.utc), "fake")
        raise MarketDataUnavailableError(f"{from_currency}{to_currency}=X", "no FX rate configured")

    def get_dividends(self, ticker: str) -> list[DividendObservation]:
        return []

    def get_market_metadata(self, ticker: str) -> MarketMetadata:
        raise NotImplementedError


class FakeResearchProvider(ResearchProvider):
    """Narrative pass is irrelevant to these tests — empty results, same as
    StubResearchProvider, just without needing settings.research_provider
    changed for this one fixture."""

    def get_macro_snapshot(self):
        return []

    def get_sector_research(self, sector):
        return []

    def get_company_research(self, company_name, ticker, sector):
        return []


@pytest.fixture()
def fake_macro_provider():
    app.dependency_overrides[get_macro_data_provider] = lambda: FakeMacroDataProvider()
    app.dependency_overrides[get_research_provider] = lambda: FakeResearchProvider()
    yield
    app.dependency_overrides.pop(get_macro_data_provider, None)
    app.dependency_overrides.pop(get_research_provider, None)


@pytest.fixture()
def fake_market_provider():
    app.dependency_overrides[get_market_data_provider] = lambda: FakeMarketDataProvider()
    yield
    app.dependency_overrides.pop(get_market_data_provider, None)


def _upload_holding(client, csv: bytes) -> dict:
    upload = client.post("/portfolio/upload", files={"file": ("portfolio.csv", csv, "text/csv")})
    body = upload.json()
    return {
        "holding_id": body["snapshot"]["positions"][0]["holding_id"],
        "snapshot_id": body["snapshot"]["id"],
    }


def test_defaults_unavailable_before_any_macro_refresh(client):
    ids = _upload_holding(client, NOK_CSV)

    response = client.get(f"/valuation/holdings/{ids['holding_id']}/defaults")

    assert response.status_code == 200
    body = response.json()
    assert body["discount_rate"]["available"] is False
    assert "no_policy_rate" in body["discount_rate"]["reason"]
    # Same-currency FX (NOK holding, NOK default reporting currency) is
    # trivially available at rate 1 regardless of any refresh.
    assert body["fx_rate"]["available"] is True
    assert Decimal(body["fx_rate"]["rate"]) == Decimal("1")


def test_defaults_discount_rate_available_after_macro_refresh(client, fake_macro_provider):
    ids = _upload_holding(client, NOK_CSV)
    refresh = client.post("/research/macro/refresh?force=true")
    assert refresh.status_code == 201

    response = client.get(f"/valuation/holdings/{ids['holding_id']}/defaults")
    assert response.status_code == 200
    body = response.json()

    assert body["discount_rate"]["available"] is True
    assert body["discount_rate"]["currency"] == "NOK"
    assert body["discount_rate"]["risk_free_series_used"] == ["no_policy_rate"]
    assert Decimal(body["discount_rate"]["risk_free_pct"]) == Decimal("5.3300")
    assert Decimal(body["discount_rate"]["suggested_discount_rate_pct"]) == Decimal("10.3300")


def test_defaults_discount_rate_real_plus_breakeven_for_usd_holding(client, fake_macro_provider):
    ids = _upload_holding(client, USD_CSV)
    refresh = client.post("/research/macro/refresh?force=true")
    assert refresh.status_code == 201

    response = client.get(f"/valuation/holdings/{ids['holding_id']}/defaults")
    body = response.json()

    assert body["discount_rate"]["available"] is True
    assert body["discount_rate"]["currency"] == "USD"
    assert sorted(body["discount_rate"]["risk_free_series_used"]) == ["us_breakeven_10y", "us_real_yield_10y"]
    # Both fake series return 5.33 -> risk-free 10.66 + 5.0 ERP = 15.66
    assert Decimal(body["discount_rate"]["risk_free_pct"]) == Decimal("10.6600")
    assert Decimal(body["discount_rate"]["suggested_discount_rate_pct"]) == Decimal("15.6600")


def test_defaults_fx_rate_available_after_market_refresh_for_foreign_holding(client, fake_market_provider):
    ids = _upload_holding(client, USD_CSV)
    refresh = client.post(f"/portfolio/snapshots/{ids['snapshot_id']}/valuation")
    assert refresh.status_code == 200

    response = client.get(f"/valuation/holdings/{ids['holding_id']}/defaults")
    body = response.json()

    assert body["fx_rate"]["available"] is True
    assert body["fx_rate"]["from_currency"] == "USD"
    assert body["fx_rate"]["to_currency"] == "NOK"
    assert Decimal(body["fx_rate"]["rate"]) == Decimal("10.5")


def test_defaults_fx_rate_unavailable_for_foreign_holding_before_any_market_refresh(client):
    ids = _upload_holding(client, USD_CSV)

    response = client.get(f"/valuation/holdings/{ids['holding_id']}/defaults")
    body = response.json()

    assert body["fx_rate"]["available"] is False
    assert "USD" in body["fx_rate"]["reason"] and "NOK" in body["fx_rate"]["reason"]


def test_defaults_404_for_unknown_holding(client):
    response = client.get("/valuation/holdings/00000000-0000-0000-0000-000000000000/defaults")
    assert response.status_code == 404
