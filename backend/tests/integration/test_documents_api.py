"""End-to-end test of the document upload/list/get API against a real
FastAPI app, a real (SQLite) database, and real extraction — only the
object storage backend and DB session are swapped for test doubles via
FastAPI's dependency_overrides, matching how the app itself wires them."""
import io

import openpyxl
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.database import get_db
from app.main import app
from app.models import Base, Holding
from app.providers.factory import get_object_storage
from app.providers.object_storage import LocalObjectStorageProvider


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    storage = LocalObjectStorageProvider(str(tmp_path))
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_object_storage] = lambda: storage

    with Session(engine) as seed_db:
        holding = Holding(ticker="EQNR.OL", name="Equinor ASA", trading_currency="NOK")
        seed_db.add(holding)
        seed_db.commit()
        holding_id = str(holding.id)

    with TestClient(app) as test_client:
        yield test_client, holding_id

    app.dependency_overrides.clear()


def _xlsx_bytes() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Line item", "FY2024"])
    ws.append(["Revenue", 1000])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_upload_then_list_then_get(client):
    test_client, holding_id = client
    content = _xlsx_bytes()

    upload_response = test_client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "quarterly_report"},
        files={
            "file": (
                "q4.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert upload_response.status_code == 201, upload_response.text
    body = upload_response.json()
    assert body["was_duplicate_file"] is False
    document = body["document"]
    assert document["status"] == "processed"
    assert document["fact_count"] == 1
    assert document["facts"][0]["metric"] == "revenue"
    document_id = document["id"]

    list_response = test_client.get("/documents", params={"holding_id": holding_id})
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = test_client.get(f"/documents/{document_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == document_id


def test_upload_for_unknown_holding_returns_404(client):
    test_client, _ = client
    response = test_client.post(
        "/documents/upload",
        data={"holding_id": "00000000-0000-0000-0000-000000000000"},
        files={"file": ("q4.xlsx", _xlsx_bytes(), "application/octet-stream")},
    )
    assert response.status_code == 404


def test_upload_rejects_unsupported_file_type(client):
    test_client, holding_id = client
    response = test_client.post(
        "/documents/upload",
        data={"holding_id": holding_id},
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415


def test_get_missing_document_returns_404(client):
    test_client, _ = client
    response = test_client.get("/documents/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404

def test_upload_without_holding_id_for_portfolio_export(client):
    test_client, _ = client
    content = _xlsx_bytes()

    response = test_client.post(
        "/documents/upload",
        data={"document_type": "portfolio_export"},
        files={
            "file": (
                "positions.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 201, response.text
    document = response.json()["document"]
    assert document["holding_id"] is None
    # The one row in _xlsx_bytes() ("Revenue") would normally become a
    # structured fact, but with no holding to attribute it to it's
    # discarded and flagged instead of inserted with a null FK.
    assert document["fact_count"] == 0
    assert document["quality_flags"].get("facts_skipped_no_holding") is True


def test_upload_rejects_unknown_document_type(client):
    test_client, holding_id = client
    response = test_client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "not_a_real_type"},
        files={"file": ("q4.xlsx", _xlsx_bytes(), "application/octet-stream")},
    )
    assert response.status_code == 422
