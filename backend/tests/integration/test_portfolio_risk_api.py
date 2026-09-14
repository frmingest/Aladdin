"""
Integration tests for the Phase 5 portfolio-risk-snapshot endpoint
(architecture §15, §15.1, §18). Uses a FakeMarketDataProvider that also
implements get_historical_prices (unlike tests/integration/
test_valuation_api.py's Phase 2 fake, which never needed it) — never
touches yfinance/network (§22).
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
        # A short, deterministic upward walk — enough overlapping daily
        # points for app.domain.portfolio_risk.build_correlation_matrix's
        # default min_overlap, correlated across tickers by construction.
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


def test_create_portfolio_risk_snapshot_computes_every_dimension(client, fake_provider):
    upload = _upload(client)
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/risk-snapshot")
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["risk_band"] in {"LOW", "MODERATE", "MODERATE-HIGH", "HIGH", "INSUFFICIENT DATA"}
    assert body["concentration"]["single_name_hhi"] is not None
    # Both holdings priced with a correlated deterministic walk -> a real
    # correlation should have been computable.
    assert body["correlation"]["average_pairwise_correlation"] is not None
    # Both holdings are 100% Energy sector -> fully matched by the
    # commodity-sector keyword list.
    assert body["exposure"]["commodity_exposure_pct"] is not None
    assert set(body["scenario"].keys()) >= {"recession", "stagflation", "commodity_shock"}
    assert body["scenario"]["recession"]["estimated_portfolio_impact_pct"] is not None
    # All-NOK portfolio -> wealth tax estimate should be present.
    assert body["systemic_state_risk"]["wealth_tax_estimate"] is not None
    assert body["risk_scoring_version"] == "risk_v1"
    assert body["scenario_version"] == "v1"


def test_portfolio_risk_snapshot_wealth_tax_skipped_for_non_nok_reporting(client, fake_provider):
    csv = make_portfolio_csv(
        ["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,"],
        header="Ticker,Name,Asset class,Quantity,Weight %,Cost basis,Currency,Sector/Theme,Notes",
    )
    upload = client.post(
        "/portfolio/upload",
        data={"reporting_currency": "USD"},
        files={"file": ("portfolio.csv", csv, "text/csv")},
    )
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/risk-snapshot")
    assert response.status_code == 201, response.text
    assert response.json()["systemic_state_risk"]["wealth_tax_estimate"] is None


def test_list_and_get_portfolio_risk_snapshots(client, fake_provider):
    upload = _upload(client)
    snapshot_id = upload.json()["snapshot"]["id"]
    created = client.post(f"/portfolio/snapshots/{snapshot_id}/risk-snapshot").json()

    listed = client.get(f"/portfolio/snapshots/{snapshot_id}/risk-snapshots")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    fetched = client.get(f"/portfolio/risk-snapshots/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created["id"]


def test_unknown_snapshot_returns_404_for_risk_snapshot(client, fake_provider):
    response = client.post(
        "/portfolio/snapshots/00000000-0000-0000-0000-000000000000/risk-snapshot"
    )
    assert response.status_code == 404


# --- Accounts (§26 accounts feature) — risk snapshot scoped to a subset ----


def _create_account(client, name: str, account_number: str) -> str:
    response = client.post("/accounts", json={"name": name, "account_number": account_number})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_risk_snapshot_can_be_scoped_to_one_account(client, fake_provider):
    account_a = _create_account(client, "Aksje & fonds konto", "70541644")
    account_b = _create_account(client, "ASK konto", "24175564")

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

    scoped = client.post(f"/portfolio/snapshots/{snapshot_id}/risk-snapshot?account_id={account_a}")
    assert scoped.status_code == 201, scoped.text
    scoped_body = scoped.json()
    assert scoped_body["account_ids"] == [account_a]
    # Only VAR.OL counted -> single-name HHI is a full 10000 (one holding = 100% weight).
    assert scoped_body["concentration"]["single_name_hhi"] == "10000.00" or Decimal(
        scoped_body["concentration"]["single_name_hhi"]
    ) == Decimal("10000")

    unscoped = client.post(f"/portfolio/snapshots/{snapshot_id}/risk-snapshot")
    assert unscoped.status_code == 201
    assert unscoped.json()["account_ids"] is None

    # Both rows persist independently in this snapshot's risk-snapshot history.
    listed = client.get(f"/portfolio/snapshots/{snapshot_id}/risk-snapshots").json()
    assert len(listed) == 2
    account_id_scopes = {tuple(r["account_ids"]) if r["account_ids"] else None for r in listed}
    assert account_id_scopes == {(account_a,), None}
