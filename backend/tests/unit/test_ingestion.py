import io

import openpyxl
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.domain.errors import FileTooLargeError, UnsupportedFileTypeError
from app.models import Base, Holding
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.providers.object_storage import LocalObjectStorageProvider
from app.services.documents import ingestion as ingestion_module
from app.services.documents.ingestion import ingest_holding_document


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture()
def storage(tmp_path):
    return LocalObjectStorageProvider(str(tmp_path))


@pytest.fixture()
def holding(db):
    h = Holding(ticker="EQNR.OL", name="Equinor ASA", trading_currency="NOK")
    db.add(h)
    db.commit()
    return h


def _xlsx_bytes(rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_full_pipeline_persists_pages_chunks_and_facts(db, storage, holding):
    content = _xlsx_bytes([["Line item", "FY2024"], ["Revenue", 1000]])

    intake = ingest_holding_document(
        db,
        storage,
        holding_id=holding.id,
        filename="q4-model.xlsx",
        content=content,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        document_type="quarterly_report",
    )

    assert intake.was_duplicate is False
    assert intake.document.status == "processed"
    assert intake.document.sha256

    pages = db.query(DocumentPage).filter_by(document_id=intake.document.id).all()
    chunks = db.query(DocumentChunk).filter_by(document_id=intake.document.id).all()
    facts = db.query(FinancialLineItem).filter_by(document_id=intake.document.id).all()
    assert len(pages) == 1
    assert len(chunks) == 1
    assert len(facts) == 1
    assert facts[0].metric == "revenue"
    assert facts[0].holding_id == holding.id

    # The file itself actually landed in storage, not just referenced.
    assert storage.retrieve(f"{intake.document.sha256}/q4-model.xlsx") == content


def test_duplicate_upload_is_detected_and_not_reprocessed(db, storage, holding):
    content = _xlsx_bytes([["Line item", "FY2024"], ["Revenue", 1000]])

    first = ingest_holding_document(
        db, storage, holding_id=holding.id, filename="a.xlsx", content=content,
        mime_type="application/octet-stream", document_type="other",
    )
    second = ingest_holding_document(
        db, storage, holding_id=holding.id, filename="a.xlsx", content=content,
        mime_type="application/octet-stream", document_type="other",
    )

    assert first.was_duplicate is False
    assert second.was_duplicate is True
    assert first.document.id == second.document.id
    # Re-ingesting the same bytes must not duplicate extracted rows.
    facts = db.query(FinancialLineItem).filter_by(document_id=first.document.id).all()
    assert len(facts) == 1


def test_unsupported_file_type_is_rejected_before_storing(db, storage, holding):
    with pytest.raises(UnsupportedFileTypeError):
        ingest_holding_document(
            db, storage, holding_id=holding.id, filename="notes.txt", content=b"hello",
            mime_type="text/plain", document_type="other",
        )
    assert db.query(Document).count() == 0


def test_oversized_file_is_rejected(db, storage, holding, monkeypatch):
    class TinyLimitSettings:
        max_upload_size_mb = 0  # anything is "too large"

    monkeypatch.setattr(ingestion_module, "get_settings", lambda: TinyLimitSettings())
    content = _xlsx_bytes([["Line item", "FY2024"], ["Revenue", 1000]])

    with pytest.raises(FileTooLargeError):
        ingest_holding_document(
            db, storage, holding_id=holding.id, filename="a.xlsx", content=content,
            mime_type="application/octet-stream", document_type="other",
        )


def test_unreadable_file_marks_document_failed_not_500(db, storage, holding):
    # A .pdf extension whose content isn't a real PDF fails the pre-store
    # readability check (UnreadableFileError), so nothing is persisted —
    # matches "fail visibly rather than silently invent" for the bad-input
    # case that never even reaches extraction.
    from app.domain.errors import UnreadableFileError

    with pytest.raises(UnreadableFileError):
        ingest_holding_document(
            db, storage, holding_id=holding.id, filename="fake.pdf", content=b"not a pdf",
            mime_type="application/pdf", document_type="other",
        )
    assert db.query(Document).count() == 0
