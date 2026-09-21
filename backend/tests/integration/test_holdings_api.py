"""End-to-end tests for the holdings CRUD API (app/api/holdings.py)."""
from __future__ import annotations


def _create(client, ticker="EQNR.OL", **overrides):
    payload = {
        "ticker": ticker,
        "name": "Equinor ASA",
        "trading_currency": "nok",
        "sector": "Energy",
    }
    payload.update(overrides)
    return client.post("/holdings", json=payload)


def test_create_holding(client):
    response = _create(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["ticker"] == "EQNR.OL"
    # trading_currency is normalized to uppercase.
    assert body["trading_currency"] == "NOK"
    assert body["document_count"] == 0
    assert body["position_count"] == 0


def test_create_holding_duplicate_ticker_is_rejected(client):
    first = _create(client)
    assert first.status_code == 201
    second = _create(client)
    assert second.status_code == 409


def test_list_holdings(client):
    _create(client, ticker="EQNR.OL")
    _create(client, ticker="AAPL")
    response = client.get("/holdings")
    assert response.status_code == 200
    tickers = sorted(h["ticker"] for h in response.json())
    assert tickers == ["AAPL", "EQNR.OL"]


def test_get_holding(client):
    created = _create(client).json()
    response = client.get(f"/holdings/{created['id']}")
    assert response.status_code == 200
    assert response.json()["ticker"] == "EQNR.OL"


def test_get_missing_holding_returns_404(client):
    response = client.get("/holdings/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_update_holding(client):
    created = _create(client).json()
    response = client.patch(f"/holdings/{created['id']}", json={"sector": "Renewables"})
    assert response.status_code == 200
    assert response.json()["sector"] == "Renewables"
    # Unset fields are left alone.
    assert response.json()["ticker"] == "EQNR.OL"


def test_update_holding_normalizes_currency(client):
    created = _create(client).json()
    response = client.patch(f"/holdings/{created['id']}", json={"trading_currency": "usd"})
    assert response.status_code == 200
    assert response.json()["trading_currency"] == "USD"


def test_delete_holding_requires_confirm(client):
    created = _create(client).json()
    response = client.delete(f"/holdings/{created['id']}")
    assert response.status_code == 400
    # Not actually deleted.
    assert client.get(f"/holdings/{created['id']}").status_code == 200


def test_delete_holding_with_confirm(client):
    created = _create(client).json()
    response = client.delete(f"/holdings/{created['id']}", params={"confirm": "true"})
    assert response.status_code == 204
    assert client.get(f"/holdings/{created['id']}").status_code == 404


def test_delete_holding_blocked_by_documents(client):
    import io

    import openpyxl

    created = _create(client).json()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Line item", "FY2024"])
    ws.append(["Revenue", 1000])
    buf = io.BytesIO()
    wb.save(buf)

    upload = client.post(
        "/documents/upload",
        data={"holding_id": created["id"]},
        files={
            "file": (
                "q4.xlsx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert upload.status_code == 201, upload.text

    response = client.delete(f"/holdings/{created['id']}", params={"confirm": "true"})
    assert response.status_code == 409
    assert "document" in response.json()["detail"]
