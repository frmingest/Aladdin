"""Fetch a holding's annual report straight from Oslo Børs Newsweb and run
it through the same iXBRL extraction an upload uses (Sprint 15, 2026-09-26).

Faiz's ask: a button that finds a company's ESEF annual report on Newsweb
itself (rather than him downloading and re-uploading it by hand), unzips
it if needed, and attaches the resulting figures to the holding he
triggered it from.

Persistence rules (same spirit as SEC EDGAR / ESEF-index imports,
app/services/filings/sec_edgar.py, esef_index.py):
- The extracted .xhtml is stored and processed through the *exact* upload
  pipeline (app/services/documents/ingestion.py: ingest_holding_document),
  so it gets sha256-dedup, embedded-media stripping, the 250 MB iXBRL
  size cap, section chunking and "first source wins per metric/year" for
  free — no parallel document/fact code path to keep in sync.
- Newsweb's own provenance (message id/url, title, published date, which
  attachment was used) is recorded in the Document's quality_flags after
  ingestion, alongside whatever the extractor itself already wrote there.
- This only ever creates an ``annual_report`` Document exactly as a manual
  upload would — never a system-only document type — so it shows up in
  the documents list and can be deleted like any upload.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.newsweb_filing_provider import (
    NewswebAnnualReportRef,
    NewswebFilingProvider,
    NewswebFilingUnavailableError,
    extract_xhtml_from_zip,
    pick_esef_attachment,
)
from app.providers.newsweb_provider import issuer_sign_for_ticker
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.ingestion import ingest_holding_document
from app.services.filings.eligibility import newsweb_applies

ANNUAL_REPORT_DOCUMENT_TYPE = "annual_report"
NEWSWEB_SOURCE_FLAG = "newsweb_source"


class NewswebImportError(Exception):
    """Import could not run — the message is safe to show the user."""


@dataclass
class NewswebImportResult:
    message_id: str
    message_url: str
    title: str
    published_at: datetime | None
    attachment_name: str
    document_id: str
    was_duplicate: bool
    imported_at: str
    facts_imported: int = 0
    periods_imported: list[str] = field(default_factory=list)
    metrics_by_period: dict[str, list[str]] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def _result_from_document(db: Session, document: Document) -> NewswebImportResult:
    flags = document.quality_flags or {}
    source = flags.get(NEWSWEB_SOURCE_FLAG) or {}
    items = list(
        db.scalars(select(FinancialLineItem).where(FinancialLineItem.document_id == document.id))
    )
    metrics_by_period: dict[str, list[str]] = {}
    for item in items:
        metrics_by_period.setdefault(item.period, []).append(item.metric)
    published_at = None
    if source.get("published_at"):
        try:
            published_at = datetime.fromisoformat(str(source["published_at"]))
        except ValueError:
            published_at = None
    return NewswebImportResult(
        message_id=str(source.get("message_id", "")),
        message_url=str(source.get("message_url", "")),
        title=str(source.get("title", "")),
        published_at=published_at,
        attachment_name=str(source.get("attachment_name", "")),
        document_id=str(document.id),
        was_duplicate=True,
        imported_at=str(source.get("imported_at", "")),
        facts_imported=len(items),
        periods_imported=sorted(metrics_by_period, reverse=True),
        metrics_by_period={k: sorted(v) for k, v in sorted(metrics_by_period.items(), reverse=True)},
        warnings=list(source.get("warnings", [])),
    )


def latest_newsweb_import(db: Session, holding: Holding) -> NewswebImportResult | None:
    """The most recent Newsweb-fetched annual report for this holding, or
    None if it was never fetched this way (an ordinary upload doesn't
    count — only a Document this importer itself created carries the
    newsweb_source flag)."""
    documents = db.scalars(
        select(Document)
        .where(Document.holding_id == holding.id, Document.type == ANNUAL_REPORT_DOCUMENT_TYPE)
        .order_by(Document.uploaded_at.desc())
    )
    for document in documents:
        if isinstance((document.quality_flags or {}).get(NEWSWEB_SOURCE_FLAG), dict):
            return _result_from_document(db, document)
    return None


def import_annual_report_from_newsweb(
    db: Session,
    holding: Holding,
    provider: NewswebFilingProvider,
    storage: ObjectStorageProvider,
) -> NewswebImportResult:
    if not newsweb_applies(holding):
        raise NewswebImportError(
            "Newsweb covers Oslo Børs issuers only (.OL ticker or NOK) — this holding doesn't look like one"
        )
    issuer_sign = issuer_sign_for_ticker(holding.ticker)
    if not issuer_sign:
        raise NewswebImportError(f"no issuer sign derivable from ticker '{holding.ticker}'")

    try:
        ref: NewswebAnnualReportRef | None = provider.find_latest_annual_report(issuer_sign)
    except NewswebFilingUnavailableError as exc:
        raise NewswebImportError(str(exc)) from exc
    if ref is None:
        raise NewswebImportError(
            f"no ANNUAL FINANCIAL REPORT announcement with an attachment found on Newsweb for {issuer_sign} "
            "— check newsweb.oslobors.no directly, or upload the report by hand"
        )

    chosen = pick_esef_attachment(ref.attachments)
    if chosen is None:
        names = ", ".join(a.name for a in ref.attachments) or "no attachments"
        raise NewswebImportError(
            f"'{ref.title}' has no ESEF (.xhtml or .zip) attachment on Newsweb — only {names} is published. "
            "Upload the ESEF file by hand if the company publishes one elsewhere (e.g. its own investor site)"
        )

    try:
        raw = provider.download_attachment(ref.message_id, chosen.attachment_id)
    except NewswebFilingUnavailableError as exc:
        raise NewswebImportError(str(exc)) from exc

    warnings: list[str] = []
    if chosen.name.lower().endswith(".zip"):
        try:
            filename, xhtml_bytes = extract_xhtml_from_zip(raw, max_member_bytes=300 * 1024 * 1024)
        except NewswebFilingUnavailableError as exc:
            raise NewswebImportError(str(exc)) from exc
    else:
        filename, xhtml_bytes = chosen.name, raw

    try:
        intake = ingest_holding_document(
            db,
            storage,
            holding_id=holding.id,
            filename=filename,
            content=xhtml_bytes,
            mime_type="application/xhtml+xml",
            document_type=ANNUAL_REPORT_DOCUMENT_TYPE,
            reporting_period=None,
        )
    except Exception as exc:
        raise NewswebImportError(f"could not process '{filename}': {exc}") from exc

    imported_at = datetime.now(timezone.utc).isoformat()
    source_flags = {
        "message_id": ref.message_id,
        "message_url": ref.message_url,
        "title": ref.title,
        "published_at": ref.published_at.isoformat() if ref.published_at else None,
        "attachment_name": chosen.name,
        "extracted_filename": filename if filename != chosen.name else None,
        "imported_at": imported_at,
        "warnings": warnings,
        "import_id": str(uuid.uuid4()),
    }
    document = intake.document
    document.quality_flags = {**(document.quality_flags or {}), NEWSWEB_SOURCE_FLAG: source_flags}
    db.commit()

    result = _result_from_document(db, document)
    result.was_duplicate = intake.was_duplicate
    return result
