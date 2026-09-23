"""Holding-document upload + retrieval endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.document_types import DOCUMENT_TYPES
from app.domain.errors import (
    FileTooLargeError,
    UnreadableFileError,
    UnsupportedFileTypeError,
)
from app.models.document import Document, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.base import LLMProvider, LLMUnavailableError
from app.providers.factory import (
    get_llm_fallback_provider,
    get_llm_provider,
    get_object_storage,
)
from app.schemas.document import (
    PREVIEW_CHARS,
    DocumentDetail,
    DocumentOut,
    DocumentPageOut,
    DocumentUploadResponse,
    FinancialLineItemOut,
)
from app.schemas.financial_extraction import (
    ApproveFinancialsIn,
    ApproveFinancialsOut,
    FinancialsProposalOut,
    ProposedFactOut,
    ProposeFinancialsIn,
)
from app.services.documents.financial_extraction import (
    FinancialExtractionError,
    ProposedFact,
    propose_financials,
    save_approved_financials,
)
from app.services.documents.ingestion import ingest_holding_document

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


# --- LLM-assisted financial extraction from PDF filings (2026-09-23) ---------


def _fact_out(f: ProposedFact) -> ProposedFactOut:
    return ProposedFactOut(
        metric=f.metric,
        fiscal_year=f.fiscal_year,
        period=f.period,
        value_as_printed=f.value_as_printed,
        scale=f.scale,
        currency=f.currency,
        source_page=f.source_page,
        label_as_printed=f.label_as_printed,
        status=f.status,
        reasons=f.reasons,
        warnings=f.warnings,
        stored_value=f.stored_value,
        stored_unit=f.stored_unit,
        existing_value=f.existing_value,
    )


def _get_document_or_404(db: Session, document_id: UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    return document


@router.post("/{document_id}/financials/propose", response_model=FinancialsProposalOut)
def propose_document_financials(
    document_id: UUID,
    payload: ProposeFinancialsIn | None = None,
    db: Session = Depends(get_db),
    llm_provider: LLMProvider = Depends(get_llm_provider),
    llm_fallback_provider: LLMProvider | None = Depends(get_llm_fallback_provider),
) -> FinancialsProposalOut:
    """LLM transcribes statement lines; code verifies each number is on its
    page. Nothing is saved — the user approves via .../financials/approve."""
    document = _get_document_or_404(db, document_id)
    try:
        proposal = propose_financials(
            db,
            document,
            llm_provider=llm_provider,
            llm_fallback_provider=llm_fallback_provider,
            version=get_settings().active_financials_extraction_version,
            pages=payload.pages if payload else None,
        )
    except FinancialExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {exc}") from exc
    return FinancialsProposalOut(
        document_id=proposal.document_id,
        pages_sent=proposal.pages_sent,
        auto_selected=proposal.auto_selected,
        provider=proposal.provider,
        model=proposal.model,
        prompt_version=proposal.prompt_version,
        input_tokens=proposal.input_tokens,
        output_tokens=proposal.output_tokens,
        facts=[_fact_out(f) for f in proposal.facts],
    )


@router.post("/{document_id}/financials/approve", response_model=ApproveFinancialsOut)
def approve_document_financials(
    document_id: UUID, payload: ApproveFinancialsIn, db: Session = Depends(get_db)
) -> ApproveFinancialsOut:
    """Saves the approved facts after re-verifying each against the stored
    page text. Replaces this document's earlier extracted facts."""
    document = _get_document_or_404(db, document_id)
    try:
        result = save_approved_financials(
            db,
            document,
            payload.facts,
            provider=payload.provider,
            model=payload.model,
            version=get_settings().active_financials_extraction_version,
        )
    except FinancialExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ApproveFinancialsOut(
        saved=[_fact_out(f) for f in result.saved], refused=[_fact_out(f) for f in result.refused]
    )
