"""End-to-end tests for the portfolio snapshot/position API
(app/api/portfolio.py)."""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone

import openpyxl

from app.models.legacy_analysis import AnalysisRun, PortfolioRiskSnapshot


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
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["deleted_snapshot_id"] == snapshot_id
    assert body["positions_deleted"] == 1
    assert body["legacy_analysis_purged"] == {
        "analysis_runs": 0,
        "holding_analyses": 0,
        "factor_assessments": 0,
        "evidence_references": 0,
        "portfolio_risk_snapshots": 0,
    }
    assert client.get(f"/portfolio/snapshots/{snapshot_id}").status_code == 404


def test_delete_snapshot_cascades_legacy_analysis_runs(client, db_session):
    """Regression test for the real ForeignKeyViolation Faiz hit deleting a
    real snapshot: a pre-2026-09-21 analysis_runs row referencing the
    snapshot used to make this 500 instead of deleting. Faiz's explicit
    choice (2026-09-21): cascade-purge the legacy row rather than block or
    orphan it.
    """
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

    legacy_run = AnalysisRun(
        id=uuid.uuid4(),
        portfolio_snapshot_id=uuid.UUID(snapshot_id),
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        status="completed",
        provider="google_ai_studio",
        model_name="gemini-legacy",
        prompt_version="v1",
        scoring_version="v1",
        extraction_schema_version="v1",
        application_version="pre-reset",
        requested_holding_ids=[holding_id],
        macro_regime="baseline",
    )
    db_session.add(legacy_run)
    db_session.commit()

    response = client.delete(
        f"/portfolio/snapshots/{snapshot_id}", params={"confirm": "true"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["legacy_analysis_purged"]["analysis_runs"] == 1
    assert client.get(f"/portfolio/snapshots/{snapshot_id}").status_code == 404
    assert db_session.query(AnalysisRun).count() == 0


def test_delete_snapshot_cascades_legacy_risk_snapshots(client, db_session):
    """Regression test for the real ForeignKeyViolation Faiz hit deleting a
    real snapshot: a pre-2026-09-21 portfolio_risk_snapshots row referencing
    the snapshot (`portfolio_snapshot_id` has no ON DELETE CASCADE) used to
    make this 500 instead of deleting — the same class of bug as
    `analysis_runs` above, just missed for this table. Faiz's explicit
    choice, 2026-09-21: cascade-purge it rather than block or orphan it.
    """
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

    legacy_risk_snapshot = PortfolioRiskSnapshot(
        id=uuid.uuid4(),
        portfolio_snapshot_id=uuid.UUID(snapshot_id),
        concentration_json={},
        correlation_json={},
        exposure_json={},
        scenario_json={},
        systemic_state_risk_json={},
        risk_band="moderate",
        narrative="pre-rebuild risk snapshot",
        risk_scoring_version="v1",
        scenario_version="v1",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(legacy_risk_snapshot)
    db_session.commit()

    response = client.delete(
        f"/portfolio/snapshots/{snapshot_id}", params={"confirm": "true"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["legacy_analysis_purged"]["portfolio_risk_snapshots"] == 1
    assert client.get(f"/portfolio/snapshots/{snapshot_id}").status_code == 404
    assert db_session.query(PortfolioRiskSnapshot).count() == 0


def test_delete_all_portfolio_data_cascades_legacy_risk_snapshots(client, db_session):
    """Same regression as above, but through the bulk `/portfolio/all` wipe
    — the actual endpoint Faiz hit the 500 on, 2026-09-21."""
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

    db_session.add(
        PortfolioRiskSnapshot(
            id=uuid.uuid4(),
            portfolio_snapshot_id=uuid.UUID(snapshot_id),
            concentration_json={},
            correlation_json={},
            exposure_json={},
            scenario_json={},
            systemic_state_risk_json={},
            risk_band="moderate",
            narrative="pre-rebuild risk snapshot",
            risk_scoring_version="v1",
            scenario_version="v1",
            created_at=datetime.now(timezone.utc),
        )
    )
    db_session.commit()

    response = client.delete("/portfolio/all", params={"confirm": "true"})
    assert response.status_code == 200, response.text
    assert response.json()["legacy_analysis_purged"]["portfolio_risk_snapshots"] == 1
    assert db_session.query(PortfolioRiskSnapshot).count() == 0


def test_delete_all_portfolio_data_requires_confirm_and_wipes_scope(client):
    holding_id = _create_holding(client)
    account_id = _create_account(client)
    document_id = _upload_portfolio_export(client)
    client.post(
        "/portfolio/snapshots",
        json={
            "source_file_id": document_id,
            "reporting_currency": "NOK",
            "account_id": account_id,
            "positions": [{"holding_id": holding_id, "account_id": account_id}],
        },
    )

    assert client.delete("/portfolio/all").status_code == 400

    response = client.delete("/portfolio/all", params={"confirm": "true"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["accounts_deleted"] == 1
    assert body["snapshots_deleted"] == 1
    assert body["positions_deleted"] == 1

    assert client.get("/accounts").json() == []
    assert client.get("/portfolio/snapshots").json() == []
    # Holdings and their documents are out of scope for the bulk wipe —
    # Faiz's explicit choice, 2026-09-21.
    holdings = client.get("/holdings").json()
    assert any(h["id"] == holding_id for h in holdings)


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
