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
from app.models.holding import Holding
from app.providers.object_storage import (
    ObjectStorageProvider,
    ObjectStorageUnavailableError,
)
from app.services.documents.extraction import extract
from app.services.documents.extraction.ixbrl_slim import strip_embedded_media
from app.services.documents.hashing import (
    HOLDING_DOCUMENT_EXTENSIONS,
    IXBRL_EXTENSIONS,
    check_basic_readability,
    extension_of,
    sha256_hex,
)
from app.services.documents.quality import evaluate_quality
from app.services.documents.sectioning import split_into_section_chunks
from app.services.tag_rules import ReextractResult, rules_for_holding

# A factsheet rounded to whole millions vs the annual report's 0.1 million
# is not a disagreement worth reporting; a restatement usually is bigger.
ROUNDING_TOLERANCE = Decimal("0.005")


def _differs_beyond_rounding(a: Decimal, b: Decimal) -> bool:
    scale = max(abs(a), abs(b))
    return scale != 0 and abs(a - b) > scale * ROUNDING_TOLERANCE


@dataclass
class _OwnedFact:
    """A stored figure that currently "owns" a (metric, fiscal year) for a
    holding, with what is needed to rank it against another source."""

    value: Decimal
    filename: str
    own_year: int | None  # the filing's own fiscal year; None = not an iXBRL/ESEF filing
    item: FinancialLineItem | None  # the stored row (None only for in-memory test doubles)


ExistingFacts = dict[tuple[str, int | None], _OwnedFact]


def own_year_from_details(details: dict | None) -> int | None:
    """A tagged filing's own fiscal year = the latest year it reports.
    Reads the extractor's `ixbrl` details or an ESEF-index import's
    `esef_index` details; anything else (PDF, CSV, a factsheet) has none."""
    for key in ("ixbrl", "esef_index"):
        block = (details or {}).get(key)
        if isinstance(block, dict):
            years = [y for y in (extract_year(str(p)) for p in block.get("fiscal_years") or []) if y is not None]
            if years:
                return max(years)
    return None


def _source_rank(own_year: int | None, year: int | None) -> tuple[int, int] | None:
    """Lower is better. A filing's own year beats a comparative; among
    comparatives the nearest later report wins (it is the earliest to restate
    the year). None = unknown (not a tagged filing): never ranked against
    anything, so the old "first source wins" applies between such files."""
    if own_year is None or year is None:
        return None
    if own_year == year:
        return (0, 0)
    if own_year > year:
        return (1, own_year - year)
    return (2, year - own_year)  # a figure from a year after the filing's own: should not happen


def _outranks(new: tuple[int, int] | None, old: tuple[int, int] | None) -> bool:
    return new is not None and old is not None and new < old


def _existing_facts_by_year(
    db: Session, document: Document, also_exclude: frozenset[uuid.UUID] = frozenset()
) -> ExistingFacts:
    """(metric, fiscal year) -> the stored figure already on file for this
    holding from other documents. If legacy data holds the same year twice,
    the better-ranked source is the one reported."""
    rows = db.execute(
        select(FinancialLineItem, Document.original_filename, Document.quality_flags)
        .join(Document, Document.id == FinancialLineItem.document_id)
        .where(
            FinancialLineItem.holding_id == document.holding_id,
            FinancialLineItem.document_id.not_in({document.id, *also_exclude}),
        )
    ).all()
    found: ExistingFacts = {}
    for item, filename, flags in rows:
        year = extract_year(item.period)
        key = (item.metric, year)
        owned = _OwnedFact(item.value, filename, own_year_from_details(flags), item)
        current = found.get(key)
        if current is None or _outranks(_source_rank(owned.own_year, year), _source_rank(current.own_year, year)):
            found[key] = owned
    return found


# quality_flags key recording what intake removed from an ESEF file; kept
# when extraction later rewrites the flags.
EMBEDDED_MEDIA_FLAG = "embedded_media_removed"


@dataclass
class IntakeResult:
    document: Document
    was_duplicate: bool
    # The bytes that were stored and are to be extracted. Equal to the
    # upload, except for an iXBRL file with embedded images/fonts, whose
    # base64 payloads are removed (see extraction/ixbrl_slim.py).
    content: bytes = b""


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

    # The hash is always of the file as uploaded, so uploading the same
    # report again is recognised as a duplicate however it was stored.
    digest = sha256_hex(content)
    stored = content
    quality_flags: dict[str, object] = {}
    if ext in IXBRL_EXTENSIONS:
        slim = strip_embedded_media(content)
        if slim.removed_count:
            stored = slim.content
            quality_flags[EMBEDDED_MEDIA_FLAG] = slim.as_flag()

    existing = db.query(Document).filter(Document.sha256 == digest).one_or_none()
    if existing is not None:
        return IntakeResult(document=existing, was_duplicate=True, content=stored)

    storage_key = f"{digest}/{filename}"
    storage_path = storage.store(storage_key, stored)

    document = Document(
        holding_id=holding_id,
        type=document_type,
        original_filename=filename,
        mime_type=mime_type,
        size_bytes=len(stored),
        storage_path=storage_path,
        reporting_period=reporting_period,
        sha256=digest,
        status=DOCUMENT_STATUS_UPLOADED,
        quality_flags=quality_flags,
    )
    db.add(document)
    db.flush()
    return IntakeResult(document=document, was_duplicate=False, content=stored)


def _store_facts(
    db: Session,
    document: Document,
    facts: list,
    existing: ExistingFacts,
    own_year: int | None = None,
) -> tuple[list[str], bool]:
    """Persist extracted facts for a document, deciding who owns each
    (metric, fiscal year) the same way whatever order files arrive in:

    * a filing's own year beats a later filing's comparative column;
    * between comparatives the nearest later filing wins;
    * files without a known own year (PDF, CSV) keep "first source wins" and
      are never displaced.

    A figure that loses is not stored; one that displaces a stored figure
    replaces it. A differing value (a restatement, or a different line
    chosen) is reported so it can be checked by hand. Returns (notes, whether
    any fact had no holding to belong to). `existing` is updated as facts are
    added."""
    skipped_existing: list[str] = []
    no_holding = False
    for fact in facts:
        if document.holding_id is None:
            no_holding = True
            continue
        year = extract_year(fact.period)
        prior = existing.get((fact.metric, year)) if year is not None else None
        if prior is not None:
            differs = _differs_beyond_rounding(prior.value, fact.value)
            if not _outranks(_source_rank(own_year, year), _source_rank(prior.own_year, year)):
                if differs:
                    skipped_existing.append(
                        f"{fact.period} {fact.metric}: this file {fact.value.normalize():f} vs "
                        f"{prior.value.normalize():f} from '{prior.filename}' (kept)"
                    )
                continue
            # This filing is the better source for the year: replace.
            if differs:
                skipped_existing.append(
                    f"{fact.period} {fact.metric}: this file {fact.value.normalize():f} replaces "
                    f"{prior.value.normalize():f} from '{prior.filename}' (this filing reports the year itself)"
                )
            if prior.item is not None:
                if prior.item in db.new:  # added earlier in this same pass, not yet flushed
                    db.expunge(prior.item)
                else:
                    db.delete(prior.item)
        item = FinancialLineItem(
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
        db.add(item)
        existing[(fact.metric, year)] = _OwnedFact(fact.value, document.original_filename, own_year, item)
    return skipped_existing, no_holding


def process_document(db: Session, document: Document, content: bytes) -> None:
    """Runs type-specific extraction and persists pages/chunks/facts.

    Extraction failures mark the Document FAILED with a quality flag rather
    than raising — the file is already safely stored, so a badly-formed
    filing shouldn't 500 the request.
    """
    document.status = DOCUMENT_STATUS_PROCESSING
    db.flush()
    kept_flags = {
        k: v for k, v in (document.quality_flags or {}).items() if k == EMBEDDED_MEDIA_FLAG
    }

    ext = extension_of(document.original_filename)
    # Mapping rules accepted in the tag review inbox apply to every new fetch.
    rules = rules_for_holding(db, document.holding_id) if document.holding_id and ext in IXBRL_EXTENSIONS else ()
    try:
        result = extract(ext, content, filename=document.original_filename, rules=rules)
    except Exception as exc:  # noqa: BLE001 — any extractor failure is a FAILED document, not a 500
        document.status = DOCUMENT_STATUS_FAILED
        document.quality_flags = {**kept_flags, "extraction_failed": True, "extraction_error": str(exc)}
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
    skipped_existing, no_holding = _store_facts(
        db, document, result.facts, existing, own_year=own_year_from_details(result.details)
    )
    facts_skipped_no_holding = facts_skipped_no_holding or no_holding

    flags = evaluate_quality(result.pages)
    flags.update(kept_flags)
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


# Flags the figure extraction itself sets; a re-read replaces exactly these
# and leaves the text-quality flags alone (the pages are not touched).
_EXTRACTOR_FLAGS = (
    "ixbrl",
    "reporting_bank",
    "integrity_check_failed",
    "equity_includes_hybrid_capital",
    "fact_conflicts",
    "facts_differ_from_existing",
)


def _stored_bytes(storage: ObjectStorageProvider, document: Document) -> bytes | None:
    for key in (f"{document.sha256}/{document.original_filename}", document.storage_path):
        try:
            return storage.retrieve(key)
        except ObjectStorageUnavailableError:
            continue
    return None


def refresh_document_facts(db: Session, storage: ObjectStorageProvider, holding: Holding) -> ReextractResult:
    """Re-read a holding's stored tagged reports with the current mapping
    rules and replace their figures. Pages, chunks and text are not touched,
    so nothing the analysis cites moves. Every report is read first; one that
    cannot be read keeps its old figures. Reports are written oldest first and
    a year another document already supplies stays with that document (the
    same first-source-wins rule as an upload)."""
    result = ReextractResult(holding_id=holding.id, ticker=holding.ticker)
    result.facts_before = db.query(FinancialLineItem).filter(FinancialLineItem.holding_id == holding.id).count()
    rules = rules_for_holding(db, holding.id)
    documents = [
        d
        for d in db.scalars(
            select(Document)
            .where(Document.holding_id == holding.id, Document.status == DOCUMENT_STATUS_PROCESSED)
            .order_by(Document.uploaded_at)
        )
        if extension_of(d.original_filename) in IXBRL_EXTENSIONS and (d.quality_flags or {}).get("ixbrl")
    ]
    reread: list[tuple[Document, object]] = []
    for document in documents:
        content = _stored_bytes(storage, document)
        if content is None:
            result.notes.append(f"{document.original_filename}: the stored file is not available, figures kept")
            continue
        try:
            extracted = extract(
                extension_of(document.original_filename), content, filename=document.original_filename, rules=rules
            )
        except Exception as exc:  # noqa: BLE001 — a bad file keeps its old figures
            result.notes.append(f"{document.original_filename}: could not be read again ({exc}), figures kept")
            continue
        if "ixbrl" not in extracted.details:
            result.notes.append(f"{document.original_filename}: no readable tags, figures kept")
            continue
        reread.append((document, extracted))

    ids = frozenset(d.id for d, _ in reread)
    if ids:
        db.query(FinancialLineItem).filter(FinancialLineItem.document_id.in_(ids)).delete(synchronize_session=False)
        db.flush()
        existing = _existing_facts_by_year(db, reread[0][0], also_exclude=ids)
        for document, extracted in reread:
            skipped, _ = _store_facts(
                db, document, extracted.facts, existing, own_year=own_year_from_details(extracted.details)
            )
            flags = {k: v for k, v in (document.quality_flags or {}).items() if k not in _EXTRACTOR_FLAGS}
            for flag in extracted.quality_flags:
                if flag in _EXTRACTOR_FLAGS:
                    flags[flag] = True
            flags.update(extracted.details)
            if skipped:
                flags["facts_differ_from_existing"] = skipped[:20]
            document.quality_flags = flags  # a new dict, so the JSON column is saved
            result.rule_figures += len(extracted.details.get("ixbrl", {}).get("rules_applied", []))
    result.documents = len(reread)
    db.commit()
    result.facts_after = db.query(FinancialLineItem).filter(FinancialLineItem.holding_id == holding.id).count()
    return result


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
        process_document(db, intake.document, intake.content or content)
    return intake
