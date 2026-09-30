"""Holding-document upload + retrieval endpoints."""
from __future__ import annotations

from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.document_types import DOCUMENT_TYPES
from app.domain.errors import (
    FileTooLargeError,
    UnreadableFileError,
    UnsupportedFileTypeError,
)
from app.models.document import Document, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.factory import get_object_storage
from app.providers.object_storage import ObjectStorageUnavailableError
from app.schemas.document import (
    PREVIEW_CHARS,
    DeletionResult,
    DocumentDetail,
    DocumentOut,
    DocumentPageOut,
    DocumentUploadResponse,
    FinancialLineItemOut,
)
from app.services.deletion import DeletionBlockedError, delete_documents
from app.services.documents.anchoring import AnchorFact, add_page_anchors
from app.services.documents.ingestion import ingest_holding_document
from app.services.documents.viewing import describe_viewing
from app.services.settings.demo_guard import require_not_demo

router = APIRouter(prefix="/documents", tags=["documents"])


def _doc_to_out(db: Session, document: Document) -> DocumentOut:
    page_count = db.query(DocumentPage).filter(DocumentPage.document_id == document.id).count()
    fact_count = (
        db.query(FinancialLineItem).filter(FinancialLineItem.document_id == document.id).count()
    )
    return DocumentOut(
        id=document.id,
        holding_id=document.holding_id,
        type=document.type,
        original_filename=document.original_filename,
        mime_type=document.mime_type,
        size_bytes=document.size_bytes,
        uploaded_at=document.uploaded_at,
        reporting_period=document.reporting_period,
        sha256=document.sha256,
        status=document.status,
        quality_flags=document.quality_flags,
        page_count=page_count,
        fact_count=fact_count,
    )


def _doc_to_detail(db: Session, document: Document) -> DocumentDetail:
    out = _doc_to_out(db, document)
    pages = (
        db.query(DocumentPage)
        .filter(DocumentPage.document_id == document.id)
        .order_by(DocumentPage.page_number)
        .all()
    )
    facts = db.query(FinancialLineItem).filter(FinancialLineItem.document_id == document.id).all()
    return DocumentDetail(
        **out.model_dump(),
        pages=[
            DocumentPageOut(
                page_number=p.page_number,
                extraction_quality=p.extraction_quality,
                text_preview=p.extracted_text[:PREVIEW_CHARS],
            )
            for p in pages
        ],
        facts=[
            FinancialLineItemOut(
                metric=f.metric,
                value=f.value,
                unit=f.unit,
                currency=f.currency,
                period=f.period,
                source_page=f.source_page,
                confidence=f.confidence,
            )
            for f in facts
        ],
    )


@router.post("/upload", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    holding_id: UUID | None = Form(default=None),
    document_type: str = Form(default="other"),
    reporting_period: str | None = Form(default=None),
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> DocumentUploadResponse:
    require_not_demo(db)
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"document_type must be one of {sorted(DOCUMENT_TYPES)}",
        )

    # holding_id is optional: a portfolio-wide export (document_type
    # "portfolio_export") isn't about a single holding — see
    # app/domain/document_types.py. Every other type is still expected to
    # name a real holding, so validate it when one is given either way.
    if holding_id is not None:
        holding = db.get(Holding, holding_id)
        if holding is None:
            raise HTTPException(status_code=404, detail=f"holding '{holding_id}' not found")

    content = await file.read()

    try:
        intake = ingest_holding_document(
            db,
            storage,
            holding_id=holding_id,
            filename=file.filename or "upload",
            content=content,
            mime_type=file.content_type or "application/octet-stream",
            document_type=document_type,
            reporting_period=reporting_period,
        )
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UnreadableFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return DocumentUploadResponse(
        document=_doc_to_detail(db, intake.document), was_duplicate_file=intake.was_duplicate
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(
    holding_id: UUID | None = None, db: Session = Depends(get_db)
) -> list[DocumentOut]:
    require_not_demo(db)
    query = db.query(Document)
    if holding_id is not None:
        query = query.filter(Document.holding_id == holding_id)
    documents = query.order_by(Document.uploaded_at.desc()).all()
    return [_doc_to_out(db, d) for d in documents]


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: UUID, db: Session = Depends(get_db)) -> DocumentDetail:
    require_not_demo(db)
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    return _doc_to_detail(db, document)


@router.get("/{document_id}/file")
def get_document_file(
    document_id: UUID,
    download: bool = False,
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> Response:
    """The stored original file, for the "Read" button. Served inline when a
    browser can render it (PDF, HTML/XHTML) and as a download otherwise
    (PPTX/XLSX/CSV). Behind the same X-API-Key gate as every other route, so
    the frontend fetches it with the key and shows it from a blob.

    Filings are untrusted input (CLAUDE.md rule 5): HTML is served under a
    sandboxing Content-Security-Policy — no scripts, no forms, no network
    fetches — so a hostile document can't run code next to real holdings."""
    require_not_demo(db)
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")

    content: bytes | None = None
    # ingestion stores under f"{sha256}/{filename}"; fall back to the saved
    # path for rows written before that convention.
    for key in (f"{document.sha256}/{document.original_filename}", document.storage_path):
        try:
            content = storage.retrieve(key)
            break
        except ObjectStorageUnavailableError:
            continue
    if content is None:
        raise HTTPException(
            status_code=404, detail="the stored file for this document is not available"
        )

    viewing = describe_viewing(document.original_filename, document.mime_type)
    disposition = "inline" if viewing.inline and not download else "attachment"
    headers = {
        "Content-Disposition": f'{disposition}; filename*=UTF-8\'\'{quote(document.original_filename)}',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
    }
    if viewing.is_html:
        if not download:
            # Reading, not downloading: add anchors so the reader can jump to a
            # figure's page, and to the number itself where it can be found.
            # The stored original is never modified.
            stored = (
                db.query(FinancialLineItem)
                .filter(FinancialLineItem.document_id == document.id, FinancialLineItem.source_page > 0)
                .all()
            )
            content = add_page_anchors(
                content,
                [AnchorFact(f.metric, f.period, f.value, f.source_page) for f in stored],
            )
        headers["Content-Security-Policy"] = (
            "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"
        )
    return Response(content=content, media_type=viewing.media_type, headers=headers)


@router.delete("/{document_id}", response_model=DeletionResult)
def delete_document(
    document_id: UUID,
    confirm: bool = False,
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> DeletionResult:
    require_not_demo(db)
    """Deletes one uploaded document: its extracted facts, pages, chunks,
    and the original file in object storage. Destructive (CLAUDE.md):
    `confirm=true` required. Also the way to re-extract a file after an
    extraction fix — the sha256 duplicate check otherwise returns the old
    document unchanged on re-upload."""
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting a document is destructive — pass confirm=true to proceed",
        )
    if db.get(Document, document_id) is None:
        raise HTTPException(status_code=404, detail="document not found")
    try:
        counts = delete_documents(db, storage, [document_id])
    except DeletionBlockedError as exc:
        raise HTTPException(status_code=409, detail=f"cannot delete document: {exc}") from exc
    return DeletionResult(**vars(counts))
