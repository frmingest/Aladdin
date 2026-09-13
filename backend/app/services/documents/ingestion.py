"""
Shared file-intake plumbing (architecture §6 flow: validate -> hash/dedup ->
store -> [type-specific extraction happens separately, see extraction/]).

Used by both the portfolio upload path (app/services/portfolio/ingestion.py)
and the holding-document upload path (app/api/documents.py) — a portfolio
CSV/XLSX is stored as a Document too (holding_id=NULL) so it gets the same
provenance/dedup treatment as everything else (see models/document.py).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.errors import FileTooLargeError, UnsupportedFileTypeError
from app.models.document import Document, DocumentChunk, DocumentPage, DocumentStatus, DocumentType
from app.models.financial_fact import FinancialLineItem
from app.providers.base import ObjectStorageProvider
from app.services.documents.extraction import extract
from app.services.documents.hashing import (
    HOLDING_DOCUMENT_EXTENSIONS,
    check_basic_readability,
    extension_of,
    sha256_hex,
)
from app.services.documents.quality import evaluate_quality


@dataclass
class IntakeResult:
    document: Document
    was_duplicate: bool


def intake_raw_file(
    db: Session,
    storage: ObjectStorageProvider,
    *,
    content: bytes,
    filename: str,
    mime_type: str,
    document_type: DocumentType,
    allowed_extensions: tuple[str, ...],
    max_bytes: int,
    holding_id: uuid.UUID | None = None,
    reporting_period: str | None = None,
) -> IntakeResult:
    """Validates, hashes/dedups, stores, and persists a Document row.

    Raises UnsupportedFileTypeError / FileTooLargeError / UnreadableFileError
    (see app.domain.errors) rather than silently accepting a bad upload
    (§21: "fail visibly rather than silently invent").
    """
    ext = extension_of(filename)
    if ext not in allowed_extensions:
        raise UnsupportedFileTypeError(filename, allowed_extensions)

    if len(content) > max_bytes:
        raise FileTooLargeError(filename, len(content), max_bytes)

    check_basic_readability(filename, content)

    digest = sha256_hex(content)
    existing = db.query(Document).filter(Document.sha256 == digest).one_or_none()
    if existing is not None:
        return IntakeResult(document=existing, was_duplicate=True)

    storage_key = f"{digest}/{filename}"
    storage_path = storage.store(storage_key, content)

    document = Document(
        holding_id=holding_id,
        type=document_type.value,
        original_filename=filename,
        mime_type=mime_type,
        size_bytes=len(content),
        storage_path=storage_path,
        reporting_period=reporting_period,
        sha256=digest,
        status=DocumentStatus.UPLOADED.value,
        quality_flags=[],
    )
    db.add(document)
    db.flush()
    return IntakeResult(document=document, was_duplicate=False)


def process_document(db: Session, document: Document, content: bytes) -> None:
    """Runs type-specific extraction (§6.2) and persists pages/chunks/facts.

    Extraction failures mark the Document FAILED with a quality flag rather
    than raising — the file is already safely stored, so a badly-formed
    report shouldn't 500 the request (§21/§6.4).
    """
    document.status = DocumentStatus.PROCESSING.value
    db.flush()

    ext = extension_of(document.original_filename)
    try:
        result = extract(ext, content)
    except Exception as exc:  # noqa: BLE001 — any extractor failure is a FAILED document, not a 500
        document.status = DocumentStatus.FAILED.value
        document.quality_flags = [f"extraction_failed: {exc}"]
        db.commit()
        return

    for page in result.pages:
        db.add(
            DocumentPage(
                document_id=document.id,
                page_number=page.page_number,
                extracted_text=page.text,
                extraction_quality=page.quality,
            )
        )
        # Phase 1 chunking is 1 page = 1 chunk (§6.3 notes finer chunking as
        # long-document processing matures); good enough to keep raw text out
        # of reasoning calls once Phase 3 exists.
        db.add(
            DocumentChunk(
                document_id=document.id,
                page_start=page.page_number,
                page_end=page.page_number,
                section=None,
                content=page.text,
                content_hash=sha256_hex(page.text.encode("utf-8")),
            )
        )

    if document.holding_id is not None:
        for fact in result.facts:
            db.add(
                FinancialLineItem(
                    document_id=document.id,
                    holding_id=document.holding_id,
                    metric=fact.metric,
                    value=fact.value,
                    unit=fact.unit,
                    currency=fact.currency,
                    period=fact.period,
                    source_page=fact.source_page,
                    confidence=fact.confidence,
                )
            )

    flags = evaluate_quality(result.pages) + result.quality_flags
    document.quality_flags = flags
    document.status = (
        DocumentStatus.FAILED.value if "no_pages_extracted" in flags else DocumentStatus.PROCESSED.value
    )
    db.commit()


def ingest_holding_document(
    db: Session,
    storage: ObjectStorageProvider,
    *,
    holding_id: uuid.UUID,
    filename: str,
    content: bytes,
    mime_type: str,
    document_type: DocumentType,
    reporting_period: str | None,
) -> IntakeResult:
    """Full holding-document pipeline: intake + extraction (§26 Phase 1)."""
    settings = get_settings()
    intake = intake_raw_file(
        db,
        storage,
        content=content,
        filename=filename,
        mime_type=mime_type,
        document_type=document_type,
        allowed_extensions=HOLDING_DOCUMENT_EXTENSIONS,
        max_bytes=settings.max_upload_size_mb * 1024 * 1024,
        holding_id=holding_id,
        reporting_period=reporting_period,
    )
    # Only (re)process a genuinely new upload — a duplicate hash pointing at
    # an already-processed document should not re-extract or duplicate pages.
    if not intake.was_duplicate or intake.document.status == DocumentStatus.UPLOADED.value:
        process_document(db, intake.document, content)
    return intake
