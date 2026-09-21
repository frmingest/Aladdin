"""Integration tests for /valuation/* — full FastAPI TestClient stack, with
MarketDataProvider/RiskFreeRateProvider overridden by fakes (no real
yfinance/FRED calls; see tests/integration/conftest.py for the shared
client fixture). Real FinancialLineItem facts come from an actual
/documents/upload xlsx ingestion, mirroring
tests/integration/test_holding_metrics_api.py's pattern, so this exercises
the same extraction path a real filing would go through."""
from __future__ import annotations

import io
from datetime import datetime, timezone
from decimal import Decimal

import openpyxl

from app.main import app
from app.providers.base import MarketDataUnavailableError, PricePoint, RiskFreeRate
from app.providers.factory import get_market_data_provider, get_risk_free_rate_provider

D = Decimal
_DEFAULT_BETA = D("1.0")


class _FakeMarketDataProvider:
    name = "fake"

    def __init__(self, *, price: PricePoint | None = None, beta=_DEFAULT_BETA):
        self._price = price
        self._beta = beta

    def get_current_price(self, ticker, *, currency_hint=None):
        if self._price is None:
            raise MarketDataUnavailableError("no price configured")
        return self._price

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover
        raise NotImplementedError

    def get_fx_rate(self, from_currency, to_currency):
        raise MarketDataUnavailableError("no fx configured")

    def get_beta(self, ticker):
        return self._beta


class _FakeRiskFreeRateProvider:
    def __init__(self, *, rate: RiskFreeRate | None = None):
        self._rate = rate

    def get_risk_free_rate(self, currency):
        if self._rate is None:
            from app.providers.base import RiskFreeRateUnavailableError

            raise RiskFreeRateUnavailableError("no rate configured")
        return self._rate


def _override(market_provider=None, rate_provider=None) -> None:
    if market_provider is not None:
        app.dependency_overrides[get_market_data_provider] = lambda: market_provider
    if rate_provider is not None:
        app.dependency_overrides[get_risk_free_rate_provider] = lambda: rate_provider


def _clear_overrides() -> None:
    app.dependency_overrides.pop(get_market_data_provider, None)
    app.dependency_overrides.pop(get_risk_free_rate_provider, None)


def _create_holding(client, ticker="AAPL"):
    response = client.post(
        "/holdings", json={"ticker": ticker, "name": "Apple Inc.", "trading_currency": "USD"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload_filing(client, holding_id, period, *, net_income, d_and_a, capex, shares):
    rows = [
        ("Net income", net_income),
        ("Depreciation and amortization", d_and_a),
        ("Capital expenditures", capex),
        ("Shares outstanding", shares),
    ]
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Line item", period])
    for label, value in rows:
        ws.append([label, value])
    buf = io.BytesIO()
    wb.save(buf)

    response = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "annual_report"},
        files={
            "file": (
                f"filing-{period}.xlsx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _price_point(price="200", currency="USD") -> PricePoint:
    return PricePoint(price=D(price), currency=currency, observed_at=datetime.now(timezone.utc), provider="fake")


def _risk_free_rate(rate="4.00", currency="USD") -> RiskFreeRate:
    return RiskFreeRate(currency=currency, rate=D(rate), observed_at=datetime.now(timezone.utc), provider="fake", source_series_id="FAKE10Y")


def test_get_valuation_for_real_holding_computes_dcf(client):
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, "FY2024", net_income=80, d_and_a=20, capex=10, shares=10)
    _upload_filing(client, holding_id, "FY2025", net_income=100, d_and_a=25, capex=15, shares=10)

    _override(market_provider=_FakeMarketDataProvider(price=_price_point()), rate_provider=_FakeRiskFreeRateProvider(rate=_risk_free_rate()))
    response = client.get(f"/valuation/holdings/{holding_id}")
    _clear_overrides()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["holding_id"] == holding_id
    assert body["valuation_currency"] == "USD"
    assert Decimal(body["current_price_per_share"]) == D("200")
    assert body["dcf"] is not None
    assert {s["label"] for s in body["dcf"]["scenarios"]} == {"bear", "base", "bull"}
    assert body["reverse_dcf_implied_growth"] is not None
    assert body["unavailable_reasons"] == []


def test_get_valuation_for_unknown_holding_is_404(client):
    _override(market_provider=_FakeMarketDataProvider(price=_price_point()), rate_provider=_FakeRiskFreeRateProvider(rate=_risk_free_rate()))
    response = client.get("/valuation/holdings/00000000-0000-0000-0000-000000000000")
    _clear_overrides()
    assert response.status_code == 404


def test_get_valuation_with_no_filings_returns_multiples_only(client):
    holding_id = _create_holding(client)

    _override(market_provider=_FakeMarketDataProvider(price=_price_point()), rate_provider=_FakeRiskFreeRateProvider(rate=_risk_free_rate()))
    response = client.get(f"/valuation/holdings/{holding_id}")
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["dcf"] is None
    assert body["multiples"] == []
    assert any("fewer than two periods" in reason for reason in body["unavailable_reasons"])


def test_missing_risk_free_rate_degrades_dcf_not_the_whole_response(client):
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, "FY2024", net_income=80, d_and_a=20, capex=10, shares=10)
    _upload_filing(client, holding_id, "FY2025", net_income=100, d_and_a=25, capex=15, shares=10)

    _override(market_provider=_FakeMarketDataProvider(price=_price_point()), rate_provider=_FakeRiskFreeRateProvider(rate=None))
    response = client.get(f"/valuation/holdings/{holding_id}")
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["dcf"] is None
    assert any("risk-free rate" in reason for reason in body["unavailable_reasons"])


def test_refresh_endpoint_forces_a_new_provider_call(client):
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, "FY2024", net_income=80, d_and_a=20, capex=10, shares=10)
    _upload_filing(client, holding_id, "FY2025", net_income=100, d_and_a=25, capex=15, shares=10)

    market_provider = _FakeMarketDataProvider(price=_price_point())
    _override(market_provider=market_provider, rate_provider=_FakeRiskFreeRateProvider(rate=_risk_free_rate()))

    first = client.get(f"/valuation/holdings/{holding_id}")
    refreshed = client.post(f"/valuation/holdings/{holding_id}/refresh")
    _clear_overrides()

    assert first.status_code == 200
    assert refreshed.status_code == 200
    assert Decimal(refreshed.json()["current_price_per_share"]) == D("200")
