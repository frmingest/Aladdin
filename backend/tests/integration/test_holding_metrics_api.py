"""End-to-end tests for the read-only computed-metrics endpoints
(GET /holdings/{id}/periods, GET /holdings/{id}/metrics)."""
from __future__ import annotations

import io

import openpyxl


def _create_holding(client, ticker="EQNR.OL"):
    response = client.post(
        "/holdings",
        json={"ticker": ticker, "name": "Equinor ASA", "trading_currency": "NOK"},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload_filing(client, holding_id, period="FY2024", rows=None):
    rows = rows or [
        ("Revenue", 1000),
        ("Cost of goods sold", 600),
        ("Net income", 150),
        ("Total debt", 400),
        ("Cash and cash equivalents", 100),
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
                "filing.xlsx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_list_periods(client):
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, period="FY2024")
    _upload_filing(client, holding_id, period="FY2023")

    response = client.get(f"/holdings/{holding_id}/periods")
    assert response.status_code == 200
    assert sorted(response.json()) == ["FY2023", "FY2024"]


def test_periods_for_holding_with_no_documents(client):
    holding_id = _create_holding(client)
    response = client.get(f"/holdings/{holding_id}/periods")
    assert response.status_code == 200
    assert response.json() == []


def test_get_metrics_computes_and_reports_skips(client):
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, period="FY2024")

    response = client.get(f"/holdings/{holding_id}/metrics", params={"period": "FY2024"})
    assert response.status_code == 200
    body = response.json()

    assert body["period"] == "FY2024"
    assert body["facts"]["revenue"] == "1000.000000"
    # gross_margin = (1000 - 600) / 1000
    assert body["computed"]["gross_margin"] == "0.4"
    assert body["computed"]["net_debt"] == "300.000000"
    # net_margin needed revenue + net_income, both present.
    assert body["computed"]["net_margin"] == "0.15"
    # operating_margin needed operating_income, which wasn't in this filing.
    assert "operating_income" in body["skipped"]["operating_margin"]
    assert "market data" in body["skipped"]["price_to_earnings"]


def test_get_metrics_for_missing_period_returns_404(client):
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, period="FY2024")

    response = client.get(f"/holdings/{holding_id}/metrics", params={"period": "FY2020"})
    assert response.status_code == 404


def test_get_metrics_for_missing_holding_returns_404(client):
    response = client.get(
        "/holdings/00000000-0000-0000-0000-000000000000/metrics", params={"period": "FY2024"}
    )
    assert response.status_code == 404


# --- 2026-09-25: market multiples and the share count ---------------------


class _FakeYahoo:
    name = "yfinance"

    def get_current_price(self, ticker, *, currency_hint=None):
        from datetime import datetime, timezone
        from decimal import Decimal

        from app.providers.base import PricePoint

        return PricePoint(
            price=Decimal(30), currency="NOK", observed_at=datetime.now(timezone.utc), provider="yfinance"
        )

    def get_fx_rate(self, from_currency, to_currency):
        from datetime import datetime, timezone
        from decimal import Decimal

        from app.providers.base import FxRate

        return FxRate(
            from_currency=from_currency, to_currency=to_currency, rate=Decimal(1),
            observed_at=datetime.now(timezone.utc), provider="yfinance",
        )

    def get_shares_outstanding(self, ticker):
        from decimal import Decimal

        return Decimal(10)

    def get_beta(self, ticker):
        return None


def _with_market(client):
    from app.main import app
    from app.providers.factory import get_market_data_provider_or_none

    app.dependency_overrides[get_market_data_provider_or_none] = lambda: _FakeYahoo()


def test_metrics_include_market_multiples_when_price_and_shares_exist(client):
    _with_market(client)
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, period="FY2024")

    body = client.get(f"/holdings/{holding_id}/metrics", params={"period": "FY2024"}).json()
    assert body["market"]["shares"]["source"] == "yfinance"
    assert body["market"]["unavailable_reason"] is None
    # Price 30 x 10 shares = 300; P/S = 300 / 1000. Spreadsheet facts carry
    # no currency, so the price's NOK is assumed — and said so.
    assert float(body["computed"]["market_cap"]) == 300.0
    assert float(body["computed"]["price_to_sales"]) == 0.3
    assert float(body["computed"]["price_to_earnings"]) == 2.0
    assert any("assume NOK" in w for w in body["warnings"])


def test_metrics_without_market_data_explain_the_gap(client):
    holding_id = _create_holding(client)
    _upload_filing(client, holding_id, period="FY2024")
    body = client.get(f"/holdings/{holding_id}/metrics", params={"period": "FY2024"}).json()
    assert body["market"]["unavailable_reason"] == "no market data provider configured"
    assert "no market data provider" in body["skipped"]["price_to_earnings"]
    assert body["prior_period"] is None


def test_prior_year_is_used_for_averages(client):
    holding_id = _create_holding(client)
    rows = [("Net income", 100), ("Total equity", 1000), ("Total assets", 5000)]
    _upload_filing(client, holding_id, period="FY2024", rows=rows)
    _upload_filing(client, holding_id, period="FY2023", rows=[("Total equity", 600), ("Revenue", 1)])
    body = client.get(f"/holdings/{holding_id}/metrics", params={"period": "FY2024"}).json()
    assert body["prior_period"] == "FY2023"
    assert float(body["computed"]["roe"]) == 0.125  # 100 / avg(600, 1000)


def test_share_count_override_round_trip(client):
    holding_id = _create_holding(client)
    response = client.put(
        f"/holdings/{holding_id}/share-count",
        json={
            "shares": "2496406246",
            "as_of": "2026-09-24T00:00:00Z",
            "reference": "https://varenergi.no/en/investor/the-stock/",
            "note": "IR page",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["source"] == "manual"
    assert client.get(f"/holdings/{holding_id}/share-count").json()["shares"] == "2496406246.00"

    assert client.delete(f"/holdings/{holding_id}/share-count").status_code == 400
    removed = client.delete(f"/holdings/{holding_id}/share-count", params={"confirm": "true"})
    assert removed.json() == {"removed": 1}
    after = client.get(f"/holdings/{holding_id}/share-count").json()
    assert after["shares"] is None
    assert after["unavailable_reason"]


def test_share_count_must_be_positive(client):
    holding_id = _create_holding(client)
    response = client.put(
        f"/holdings/{holding_id}/share-count", json={"shares": "0", "as_of": "2026-09-24T00:00:00Z"}
    )
    assert response.status_code == 422
