"""
Integration tests for the executive summary endpoint (architecture §19).
Reuses test_portfolio_risk_api.py's FakeMarketDataProvider (never touches
yfinance/network, §22) since the executive summary reads the same cached
valuation/risk-snapshot data those tests already exercise creating.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.main import app
from app.providers.base import (
    DividendObservation,
    FxRate,
    MarketDataProvider,
    MarketDataUnavailableError,
    MarketMetadata,
    PriceObservation,
)
from app.providers.factory import get_market_data_provider
from tests.support import make_portfolio_csv

VALID_CSV = make_portfolio_csv(
    [
        "VAR.OL,Vår Energi,Aksje,1200,60,28.40,NOK,Energy,BlueNord merger thesis",
        "EQNR.OL,Equinor,Aksje,500,40,300,NOK,Energy,",
    ]
)


class FakeMarketDataProvider(MarketDataProvider):
    def __init__(self, prices: dict[str, Decimal], fx: dict[tuple[str, str], Decimal]):
        self._prices = prices
        self._fx = fx

    def get_latest_price(self, ticker: str) -> PriceObservation:
        if ticker not in self._prices:
            raise MarketDataUnavailableError(ticker, "no price configured in fake provider")
        return PriceObservation(
            ticker=ticker, price=self._prices[ticker], currency="NOK",
            observed_at=datetime(2026, 9, 12, 16, 30, tzinfo=timezone.utc), provider="fake", status="delayed",
        )

    def get_historical_prices(self, ticker, start, end):
        if ticker not in self._prices:
            raise MarketDataUnavailableError(ticker, "no history configured in fake provider")
        base = self._prices[ticker]
        return [
            PriceObservation(
                ticker=ticker, price=base + Decimal(i), currency="NOK",
                observed_at=end - timedelta(days=10 - i), provider="fake", status="current",
            )
            for i in range(10)
        ]

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        from_currency, to_currency = from_currency.upper(), to_currency.upper()
        if from_currency == to_currency:
            return FxRate(from_currency, to_currency, Decimal("1"), datetime.now(timezone.utc), "fake")
        key = (from_currency, to_currency)
        if key not in self._fx:
            raise MarketDataUnavailableError(f"{from_currency}{to_currency}=X", "no FX rate configured")
        return FxRate(from_currency, to_currency, self._fx[key], datetime.now(timezone.utc), "fake")

    def get_dividends(self, ticker: str) -> list[DividendObservation]:
        return []

    def get_market_metadata(self, ticker: str) -> MarketMetadata:
        raise NotImplementedError


@pytest.fixture()
def fake_provider():
    provider = FakeMarketDataProvider(
        prices={"VAR.OL": Decimal("30.00"), "EQNR.OL": Decimal("310.00")}, fx={},
    )
    app.dependency_overrides[get_market_data_provider] = lambda: provider
    yield provider
    app.dependency_overrides.pop(get_market_data_provider, None)


def _upload(client):
    return client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})


def test_executive_summary_before_any_valuation_reports_never_priced(client):
    snapshot_id = _upload(client).json()["snapshot"]["id"]

    response = client.get(f"/portfolio/snapshots/{snapshot_id}/executive-summary")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["headline"]["valuation_as_of"] is None
    assert body["headline"]["total_market_value"] == "0.00"
    assert body["risk"]["available"] is False
    assert body["factor_profile"]["holdings_total"] == 2
    assert body["factor_profile"]["holdings_analyzed"] == 0
    assert body["factor_profile"]["coverage_pct"] == "0.0000"
    assert any("never been priced" in item["message"] for item in body["watch_items"])
    assert any("No risk snapshot computed yet" in item["message"] for item in body["watch_items"])


def test_executive_summary_after_valuation_and_risk_snapshot(client, fake_provider):
    snapshot_id = _upload(client).json()["snapshot"]["id"]
    client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    risk_snapshot = client.post(f"/portfolio/snapshots/{snapshot_id}/risk-snapshot").json()

    response = client.get(f"/portfolio/snapshots/{snapshot_id}/executive-summary")
    assert response.status_code == 200, response.text
    body = response.json()

    assert Decimal(body["headline"]["total_market_value"]) > 0
    # The executive summary always reads the *cached* valuation (like
    # Composition's GET), so as_of is set as soon as any price observation
    # is on record — regardless of whether it came from this session's own
    # POST /valuation or POST /risk-snapshot (both persist observations).
    assert body["headline"]["valuation_as_of"] is not None

    assert body["risk"]["available"] is True
    assert body["risk"]["risk_band"] == risk_snapshot["risk_band"]
    assert len(body["risk"]["worst_dimensions"]) > 0
    for dim in body["risk"]["worst_dimensions"]:
        assert dim["band"] in {"LOW", "MODERATE", "MODERATE-HIGH", "HIGH"}
    assert body["risk"]["worst_scenario"] is not None
    assert body["risk"]["wealth_tax_estimated_tax"] is not None  # all-NOK portfolio

    # Both holdings are Securities (asset_class EQUITY) -> everything in one bucket.
    by_collection = {row["collection"]: row for row in body["composition"]["by_collection"]}
    assert set(by_collection) == {"Securities", "Coin collection", "Whisky collection"}
    assert Decimal(by_collection["Securities"]["pct_of_total"]) == Decimal("100.0000")
    assert Decimal(by_collection["Coin collection"]["value_reporting_ccy"]) == 0
    assert body["composition"]["currency_exposure_pct"] == "0.0000"  # all-NOK

    assert body["macro"]["available"] is False  # no macro refresh run this test
    assert body["macro"]["regime"] == "baseline"


def test_executive_summary_reflects_cached_get_valuation_as_of(client, fake_provider):
    snapshot_id = _upload(client).json()["snapshot"]["id"]
    client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")  # persists observations

    response = client.get(f"/portfolio/snapshots/{snapshot_id}/executive-summary")
    assert response.status_code == 200, response.text
    # Same "read the cache, not a live refresh" convention as
    # GET .../valuation — as_of should now be set since observations exist.
    assert response.json()["headline"]["valuation_as_of"] is not None


def test_executive_summary_unknown_snapshot_returns_404(client):
    response = client.get("/portfolio/snapshots/00000000-0000-0000-0000-000000000000/executive-summary")
    assert response.status_code == 404


def test_executive_summary_can_be_scoped_to_one_account(client, fake_provider):
    account_a = client.post("/accounts", json={"name": "Aksje & fonds konto", "account_number": "70541644"}).json()["id"]
    account_b = client.post("/accounts", json={"name": "ASK konto", "account_number": "24175564"}).json()["id"]

    client.post(
        "/portfolio/upload",
        files={"file": ("a.csv", make_portfolio_csv(["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,"]), "text/csv")},
        data={"account_id": account_a},
    )
    upload_b = client.post(
        "/portfolio/upload",
        files={"file": ("b.csv", make_portfolio_csv(["EQNR.OL,Equinor,Aksje,500,100,300,NOK,Energy,"]), "text/csv")},
        data={"account_id": account_b},
    )
    snapshot_id = upload_b.json()["snapshot"]["id"]
    client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    client.post(f"/portfolio/snapshots/{snapshot_id}/risk-snapshot?account_id={account_a}")

    scoped = client.get(f"/portfolio/snapshots/{snapshot_id}/executive-summary?account_id={account_a}")
    assert scoped.status_code == 200, scoped.text
    scoped_body = scoped.json()
    assert scoped_body["account_ids"] == [account_a]
    # Only VAR.OL counted for this account -> a real risk snapshot exists for this exact scope.
    assert scoped_body["risk"]["available"] is True
    assert scoped_body["factor_profile"]["holdings_total"] == 1

    unscoped = client.get(f"/portfolio/snapshots/{snapshot_id}/executive-summary")
    assert unscoped.status_code == 200
    unscoped_body = unscoped.json()
    assert unscoped_body["account_ids"] is None
    # No risk snapshot was ever computed for the all-accounts scope.
    assert unscoped_body["risk"]["available"] is False
    assert unscoped_body["factor_profile"]["holdings_total"] == 2
