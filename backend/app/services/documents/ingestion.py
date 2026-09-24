"""Holding-document ingestion: validate -> hash/dedup -> store -> extract.

CLAUDE.md Rule 5: the text captured here (DocumentPage.extracted_text,
DocumentChunk.content) is untrusted input to the LLM, not instructions —
whatever builds the evidence packet from these rows
(app/services/analysis/document_excerpts.py, Sprint 6) must frame this content to the model as data to analyze and cite, never as
directives to follow.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.document_types import (
    DOCUMENT_STATUS_FAILED,
    DOCUMENT_STATUS_PROCESSED,
    DOCUMENT_STATUS_PROCESSING,
    DOCUMENT_STATUS_UPLOADED,
    FUND_DOCUMENT_TYPES,
)
from app.domain.errors import FileTooLargeError, UnsupportedFileTypeError
from app.domain.period_dates import extract_year
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.extraction import extract
from app.services.documents.hashing import (
    HOLDING_DOCUMENT_EXTENSIONS,
    IXBRL_EXTENSIONS,
    check_basic_readability,
    extension_of,
    sha256_hex,
)
from app.services.documents.quality import evaluate_quality
from app.services.documents.sectioning import split_into_section_chunks

# A factsheet rounded to whole millions vs the annual report's 0.1 million
# is not a disagreement worth reporting; a restatement usually is bigger.
ROUNDING_TOLERANCE = Decimal("0.005")


def _differs_beyond_rounding(a: Decimal, b: Decimal) -> bool:
    scale = max(abs(a), abs(b))
    return scale != 0 and abs(a - b) > scale * ROUNDING_TOLERANCE


def _existing_facts_by_year(
    db: Session, document: Document
) -> dict[tuple[str, int | None], tuple[Decimal, str]]:
    """(metric, fiscal year) -> (value, source file name) already stored for
    this holding from other documents."""
    rows = db.execute(
        select(FinancialLineItem.metric, FinancialLineItem.period, FinancialLineItem.value, Document.original_filename)
        .join(Document, Document.id == FinancialLineItem.document_id)
        .where(FinancialLineItem.holding_id == document.holding_id, FinancialLineItem.document_id != document.id)
    ).all()
    found: dict[tuple[str, int | None], tuple[Decimal, str]] = {}
    for metric, period, value, filename in rows:
        found.setdefault((metric, extract_year(period)), (value, filename))
    return found


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
    document_type: str,
    holding_id: uuid.UUID | None,
    reporting_period: str | None = None,
) -> IntakeResult:
    """Validates, hashes/dedups, stores, and persists a Document row.

    Raises UnsupportedFileTypeError / FileTooLargeError / UnreadableFileError
    (see app.domain.errors) rather than silently accepting a bad upload.
    """
    ext = extension_of(filename)
    if ext not in HOLDING_DOCUMENT_EXTENSIONS:
        raise UnsupportedFileTypeError(filename, HOLDING_DOCUMENT_EXTENSIONS)

    settings = get_settings()
    max_mb = settings.max_upload_size_mb
    if ext in IXBRL_EXTENSIONS:
        max_mb = max(max_mb, settings.max_ixbrl_upload_size_mb)
    max_bytes = max_mb * 1024 * 1024
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
        type=document_type,
        original_filename=filename,
        mime_type=mime_type,
        size_bytes=len(content),
        storage_path=storage_path,
        reporting_period=reporting_period,
        sha256=digest,
        status=DOCUMENT_STATUS_UPLOADED,
        quality_flags={},
    )
    db.add(document)
    db.flush()
    return IntakeResult(document=document, was_duplicate=False)


def process_document(db: Session, document: Document, content: bytes) -> None:
    """Runs type-specific extraction and persists pages/chunks/facts.

    Extraction failures mark the Document FAILED with a quality flag rather
    than raising — the file is already safely stored, so a badly-formed
    filing shouldn't 500 the request.
    """
    document.status = DOCUMENT_STATUS_PROCESSING
    db.flush()

    ext = extension_of(document.original_filename)
    try:
        result = extract(ext, content, filename=document.original_filename)
    except Exception as exc:  # noqa: BLE001 — any extractor failure is a FAILED document, not a 500
        document.status = DOCUMENT_STATUS_FAILED
        document.quality_flags = {"extraction_failed": True, "extraction_error": str(exc)}
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
    # Sprint 6: section-aware chunks (headings carried across pages, each
    # chunk a citable passage of at most SECTION_CHUNK_CHARS) replace the
    # earlier 1 page = 1 chunk. Every new chunk has a non-null section.
    for chunk in split_into_section_chunks([(p.page_number, p.text) for p in result.pages]):
        db.add(
            DocumentChunk(
                document_id=document.id,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                section=chunk.section[:255],
                content=chunk.content,
                content_hash=sha256_hex(chunk.content.encode("utf-8")),
            )
        )

    # financial_line_items.holding_id is NOT NULL (see
    # app/models/financial_line_item.py) — a portfolio-wide document
    # (document.holding_id is None, e.g. document_type="portfolio_export")
    # has no single holding to attribute a fact to, so any candidate facts
    # are discarded rather than inserted with a null FK. This only matters
    # for XLSX today (the one extractor that promotes facts at all) and in
    # practice a portfolio export's rows won't match the financial-metrics
    # label map anyway — still handled explicitly, not left to an
    # IntegrityError, per CLAUDE.md's "fail visibly" rule.
    facts_skipped_no_holding = False
    # Sprint 8: a fund document (fact sheet, KID, holdings file…) is never a
    # company's financial statement. A holdings file's weights or a fact
    # sheet table must not become "revenue" or "net_income" for the fund.
    facts_skipped_fund_document = bool(result.facts) and document.type in FUND_DOCUMENT_TYPES
    if facts_skipped_fund_document:
        result.facts = []
    existing = _existing_facts_by_year(db, document) if document.holding_id is not None else {}
    skipped_existing: list[str] = []
    for fact in result.facts:
        if document.holding_id is None:
            facts_skipped_no_holding = True
            continue
        year = extract_year(fact.period)
        prior = existing.get((fact.metric, year)) if year is not None else None
        if prior is not None:
            # First source wins (the same rule SEC EDGAR imports follow): a
            # second upload never silently replaces a year already on file.
            # A differing value (a restatement, or a different line chosen)
            # is reported so it can be checked by hand.
            prior_value, prior_file = prior
            if _differs_beyond_rounding(prior_value, fact.value):
                skipped_existing.append(
                    f"{fact.period} {fact.metric}: this file {fact.value.normalize():f} vs "
                    f"{prior_value.normalize():f} from '{prior_file}' (kept)"
                )
            continue
        existing[(fact.metric, year)] = (fact.value, document.original_filename)
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

    flags = evaluate_quality(result.pages)
    for flag in result.quality_flags:
        flags[flag] = True
    if facts_skipped_no_holding:
        flags["facts_skipped_no_holding"] = True
    if facts_skipped_fund_document:
        flags["facts_skipped_fund_document"] = True
    flags.update(result.details)
    if skipped_existing:
        flags["facts_differ_from_existing"] = skipped_existing[:20]
    document.quality_flags = flags
    document.status = (
        DOCUMENT_STATUS_FAILED if flags.get("no_pages_extracted") else DOCUMENT_STATUS_PROCESSED
    )
    db.commit()


def ingest_holding_document(
    db: Session,
    storage: ObjectStorageProvider,
    *,
    holding_id: uuid.UUID | None,
    filename: str,
    content: bytes,
    mime_type: str,
    document_type: str,
    reporting_period: str | None = None,
) -> IntakeResult:
    """Full document-ingestion pipeline: intake + extraction.

    `holding_id` is None for a portfolio-wide document (document_type
    "portfolio_export") — see app/domain/document_types.py.
    """
    intake = intake_raw_file(
        db,
        storage,
        content=content,
        filename=filename,
        mime_type=mime_type,
        document_type=document_type,
        holding_id=holding_id,
        reporting_period=reporting_period,
    )
    # Only (re)process a genuinely new upload — a duplicate hash pointing at
    # an already-processed document should not re-extract or duplicate pages.
    if not intake.was_duplicate or intake.document.status == DOCUMENT_STATUS_UPLOADED:
        process_document(db, intake.document, content)
    return intake
