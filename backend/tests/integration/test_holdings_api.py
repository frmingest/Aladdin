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
    response = client.patch(f"/holdings/{created['id']}", json={"sector": "Utilities"})
    assert response.status_code == 200
    assert response.json()["sector"] == "Utilities"
    # Unset fields are left alone.
    assert response.json()["ticker"] == "EQNR.OL"


def test_update_holding_rejects_non_canonical_sector(client):
    """Sector is a dropdown backed by app/domain/sectors.py (Faiz's request,
    2026-09-21) — free text that isn't one of the canonical GICS-11 values
    is rejected rather than silently accepted, the same way a stray
    "Renewables"/"Tech"/"Energy " would have quietly drifted before."""
    created = _create(client).json()
    response = client.patch(f"/holdings/{created['id']}", json={"sector": "Renewables"})
    assert response.status_code == 422


def test_update_holding_ticker(client):
    """ticker is editable (2026-09-21) — nothing FKs on it, only on the
    row's id, so renaming it in place is safe. See HoldingUpdate's
    docstring in app/schemas/holding.py."""
    created = _create(client).json()
    response = client.patch(f"/holdings/{created['id']}", json={"ticker": "EQNR"})
    assert response.status_code == 200, response.text
    assert response.json()["ticker"] == "EQNR"
    # The old ticker is free again, not left dangling.
    assert client.get(f"/holdings/{created['id']}").json()["ticker"] == "EQNR"


def test_update_holding_ticker_collision_is_rejected(client):
    _create(client, ticker="EQNR.OL")
    other = _create(client, ticker="AAPL").json()
    response = client.patch(f"/holdings/{other['id']}", json={"ticker": "EQNR.OL"})
    assert response.status_code == 409
    # Not actually renamed.
    assert client.get(f"/holdings/{other['id']}").json()["ticker"] == "AAPL"


def test_update_holding_instrument_type(client):
    created = _create(client).json()
    response = client.patch(f"/holdings/{created['id']}", json={"asset_class_raw": "equity_etf"})
    assert response.status_code == 200, response.text
    assert response.json()["asset_class_raw"] == "equity_etf"


def test_update_holding_rejects_unknown_instrument_type(client):
    created = _create(client).json()
    response = client.patch(f"/holdings/{created['id']}", json={"asset_class_raw": "crypto"})
    assert response.status_code == 422


def test_holding_field_options(client):
    """Backs the frontend's Sector / Instrument Type dropdowns — single
    source of truth so they can never offer a value the backend would
    then reject."""
    response = client.get("/holdings/field-options")
    assert response.status_code == 200
    body = response.json()
    assert "Energy" in body["sectors"]
    assert "Information Technology" in body["sectors"]
    assert "stock" in body["instrument_types"]
    assert "equity_etf" in body["instrument_types"]


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


def test_create_holding_classifies_instrument_type_from_name(client):
    """Regression (2026-09-22): hand-created holdings used to default to the
    legacy, non-analyzable 'equity' tag."""
    stock = client.post("/holdings", json={"ticker": "MSFT", "name": "Microsoft Corp", "trading_currency": "USD"})
    assert stock.status_code == 201, stock.text
    assert stock.json()["asset_class_raw"] == "stock"

    etf = client.post("/holdings", json={"ticker": "SPY", "name": "SPDR S&P 500 ETF", "trading_currency": "USD"})
    assert etf.json()["asset_class_raw"] == "equity_etf"


def test_create_holding_accepts_explicit_instrument_type(client):
    response = client.post(
        "/holdings",
        json={"ticker": "XGLD", "name": "Gold thing", "trading_currency": "EUR", "asset_class_raw": "commodity_etc"},
    )
    assert response.status_code == 201
    assert response.json()["asset_class_raw"] == "commodity_etc"

    bad = client.post(
        "/holdings",
        json={"ticker": "BAD", "name": "Bad", "trading_currency": "EUR", "asset_class_raw": "crypto"},
    )
    assert bad.status_code == 422
