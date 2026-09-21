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
