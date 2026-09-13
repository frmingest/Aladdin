"""Holding-document upload + retrieval endpoints (architecture §26 Phase 1)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.errors import FileTooLargeError, UnreadableFileError, UnsupportedFileTypeError
from app.models.document import Document, DocumentPage, DocumentType
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.providers.factory import get_object_storage
from app.schemas.document import (
    PREVIEW_CHARS,
    DocumentDetail,
    DocumentOut,
    DocumentPageOut,
    DocumentUploadResponse,
    FinancialLineItemOut,
)
from app.services.documents.ingestion import ingest_holding_document

router = APIRouter(prefix="/documents", tags=["documents"])

_VALID_DOCUMENT_TYPES = {t.value for t in DocumentType if t != DocumentType.PORTFOLIO_SNAPSHOT}


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
    facts = (
        db.query(FinancialLineItem).filter(FinancialLineItem.document_id == document.id).all()
    )
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
    holding_id: UUID = Form(...),
    document_type: str = Form(default=DocumentType.OTHER.value),
    reporting_period: str | None = Form(default=None),
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> DocumentUploadResponse:
    if document_type not in _VALID_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"document_type must be one of {sorted(_VALID_DOCUMENT_TYPES)}",
        )

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
            document_type=DocumentType(document_type),
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
    query = db.query(Document)
    if holding_id is not None:
        query = query.filter(Document.holding_id == holding_id)
    documents = query.order_by(Document.uploaded_at.desc()).all()
    return [_doc_to_out(db, d) for d in documents]


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: UUID, db: Session = Depends(get_db)) -> DocumentDetail:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    return _doc_to_detail(db, document)
