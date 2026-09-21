"""End-to-end tests for the portfolio snapshot/position API
(app/api/portfolio.py)."""
from __future__ import annotations

import io

import openpyxl


def _create_holding(client, ticker="EQNR.OL", name="Equinor ASA"):
    response = client.post(
        "/holdings", json={"ticker": ticker, "name": name, "trading_currency": "NOK"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_account(client, account_number="ACC-001"):
    response = client.post(
        "/accounts", json={"name": "Nordnet ASK", "account_number": account_number}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload_portfolio_export(client):
    # A real (if minimal) xlsx — Nordnet-style holdings list. None of these
    # row labels match app.domain.financial_metrics, so nothing gets
    # promoted to a FinancialLineItem even though holding_id is None; this
    # only needs to exist as a real, traceable source document.
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Ticker", "Quantity", "Weight"])
    ws.append(["EQNR.OL", 100, 45.5])
    buf = io.BytesIO()
    wb.save(buf)

    response = client.post(
        "/documents/upload",
        data={"document_type": "portfolio_export"},
        files={
            "file": (
                "export.xlsx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["document"]["id"]


def test_create_snapshot_with_positions(client):
    holding_id = _create_holding(client)
    account_id = _create_account(client)
    document_id = _upload_portfolio_export(client)

    response = client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": document_id,
            "reporting_currency": "nok",
            "account_id": account_id,
            "positions": [
                {
                    "holding_id": holding_id,
                    "weight_pct": "45.5",
                    "quantity": "100",
                    "account_id": account_id,
                }
            ],
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["reporting_currency"] == "NOK"
    assert body["status"] == "processed"
    assert len(body["positions"]) == 1
    assert body["positions"][0]["ticker"] == "EQNR.OL"
    assert body["positions"][0]["weight_pct"] == "45.5000"


def test_create_snapshot_requires_real_document(client):
    response = client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": "00000000-0000-0000-0000-000000000000",
            "reporting_currency": "NOK",
        },
    )
    assert response.status_code == 404


def test_create_snapshot_rejects_unknown_holding_in_positions(client):
    document_id = _upload_portfolio_export(client)
    response = client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": document_id,
            "reporting_currency": "NOK",
            "positions": [{"holding_id": "00000000-0000-0000-0000-000000000000"}],
        },
    )
    assert response.status_code == 404


def test_list_and_get_snapshots(client):
    holding_id = _create_holding(client)
    document_id = _upload_portfolio_export(client)
    created = client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": document_id,
            "reporting_currency": "NOK",
            "positions": [{"holding_id": holding_id, "weight_pct": "100"}],
        },
    ).json()

    list_response = client.get("/portfolio/snapshots")
    assert list_response.status_code == 200
    assert list_response.json()[0]["position_count"] == 1

    get_response = client.get(f"/portfolio/snapshots/{created['id']}")
    assert get_response.status_code == 200
    assert len(get_response.json()["positions"]) == 1


def test_get_missing_snapshot_returns_404(client):
    response = client.get("/portfolio/snapshots/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_add_and_delete_position(client):
    holding_id = _create_holding(client)
    document_id = _upload_portfolio_export(client)
    snapshot_id = client.post(
        "/portfolio/snapshots",
        json={"source_file_id": document_id, "reporting_currency": "NOK", "positions": []},
    ).json()["id"]

    add_response = client.post(
        f"/portfolio/snapshots/{snapshot_id}/positions",
        json={"holding_id": holding_id, "quantity": "10"},
    )
    assert add_response.status_code == 201, add_response.text
    position_id = add_response.json()["id"]

    assert (
        client.get(f"/portfolio/snapshots/{snapshot_id}").json()["positions"][0]["id"]
        == position_id
    )

    delete_without_confirm = client.delete(
        f"/portfolio/snapshots/{snapshot_id}/positions/{position_id}"
    )
    assert delete_without_confirm.status_code == 400

    delete_response = client.delete(
        f"/portfolio/snapshots/{snapshot_id}/positions/{position_id}",
        params={"confirm": "true"},
    )
    assert delete_response.status_code == 204
    assert client.get(f"/portfolio/snapshots/{snapshot_id}").json()["positions"] == []


def test_delete_snapshot_requires_confirm_and_cascades_positions(client):
    holding_id = _create_holding(client)
    document_id = _upload_portfolio_export(client)
    snapshot_id = client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": document_id,
            "reporting_currency": "NOK",
            "positions": [{"holding_id": holding_id}],
        },
    ).json()["id"]

    assert client.delete(f"/portfolio/snapshots/{snapshot_id}").status_code == 400

    response = client.delete(
        f"/portfolio/snapshots/{snapshot_id}", params={"confirm": "true"}
    )
    assert response.status_code == 204
    assert client.get(f"/portfolio/snapshots/{snapshot_id}").status_code == 404


def test_concentration(client):
    holding_a = _create_holding(client, ticker="EQNR.OL", name="Equinor ASA")
    holding_b = _create_holding(client, ticker="AAPL", name="Apple Inc")
    document_id = _upload_portfolio_export(client)
    snapshot_id = client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": document_id,
            "reporting_currency": "NOK",
            "positions": [
                {"holding_id": holding_a, "weight_pct": "60"},
                {"holding_id": holding_b, "weight_pct": "40"},
            ],
        },
    ).json()["id"]

    response = client.get(f"/portfolio/snapshots/{snapshot_id}/concentration")
    assert response.status_code == 200
    body = response.json()
    # HHI = 60^2 + 40^2 = 5200
    assert body["hhi"] == "5200.00000000"
    assert body["position_count"] == 2


def test_concentration_without_weights_returns_422(client):
    holding_id = _create_holding(client)
    document_id = _upload_portfolio_export(client)
    snapshot_id = client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": document_id,
            "reporting_currency": "NOK",
            "positions": [{"holding_id": holding_id}],
        },
    ).json()["id"]

    response = client.get(f"/portfolio/snapshots/{snapshot_id}/concentration")
    assert response.status_code == 422
