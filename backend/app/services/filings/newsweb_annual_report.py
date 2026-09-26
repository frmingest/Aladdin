"""Fetch a holding's annual and half-year reports straight from Oslo Børs
Newsweb and run each through the same ingestion pipeline an upload uses
(Sprint 15, 2026-09-26; extended same day to fetch every available annual
year, not just the newest; extended again 2026-09-26 to also cover
half-year/interim reports after a document-sources investigation —
Faiz's asks throughout).

Faiz's ask: a button that finds a company's reports on Newsweb itself
(rather than him downloading and re-uploading them by hand), back to
around when ESEF/iXBRL reporting started for Oslo Børs issuers
(settings.newsweb_filing_history_start_year, default 2022), unzips an ESEF
package if needed, and attaches whatever it finds to the holding.

Annual vs. interim reports behave differently, and this module is honest
about it rather than pretending they're the same:
- **Annual** reports are (almost) always ESEF-tagged — the fetch requires
  an ESEF (.zip/.xhtml) attachment, extracts tagged facts into
  FinancialLineItem rows, and errors into ``no_esef_file`` if only a PDF
  exists (unchanged behaviour from the original build).
- **Interim/half-year** reports are essentially never ESEF-tagged in
  Norway (EU Transparency Directive only mandates it for annual reports).
  The fetch accepts a PDF fallback so the report still gets ingested as
  text (citable LLM evidence), but — per CLAUDE.md Rule 1 — **no financial
  facts are extracted from a PDF**. Every interim import result carries a
  warning making this explicit rather than silently importing "0 facts"
  with no explanation.

Persistence rules (same spirit as SEC EDGAR / ESEF-index imports,
app/services/filings/sec_edgar.py, esef_index.py):
- Each attachment is stored and processed through the *exact* upload
  pipeline (app/services/documents/ingestion.py: ingest_holding_document),
  so it gets sha256-dedup, embedded-media stripping (ESEF only), the size
  caps, section chunking and "first source wins per metric/year" for
  free — no parallel document/fact code path to keep in sync. This also
  means a report already uploaded by hand is recognised (by content hash)
  rather than duplicated, and simply gets the Newsweb provenance flag
  added to the existing Document.
- Newsweb's own provenance (message id/url, title, published date, which
  attachment was used, report kind) is recorded in each Document's
  quality_flags after ingestion, alongside whatever the extractor itself
  already wrote there.
- Each fetch only ever creates Documents of the ordinary user-facing type
  (``annual_report`` / ``quarterly_report``) exactly as a manual upload
  would — never a system-only document type — so every one shows up in
  the documents list and can be deleted like any upload.
- A message already imported in an earlier fetch (matched by Newsweb's own
  message_id, stored in quality_flags, scoped per report kind) is never
  re-downloaded — repeat clicks only fetch reports that are actually new.
"""
from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

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
    pick_report_attachment,
)
from app.providers.newsweb_provider import issuer_sign_for_ticker
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.ingestion import ingest_holding_document
from app.services.filings.eligibility import newsweb_applies

ANNUAL_REPORT_DOCUMENT_TYPE = "annual_report"
INTERIM_REPORT_DOCUMENT_TYPE = "quarterly_report"
NEWSWEB_SOURCE_FLAG = "newsweb_source"
PDF_NO_FACTS_WARNING = (
    "Newsweb only has this report as a PDF (no ESEF/iXBRL tagging) — the text was captured as "
    "evidence for analysis, but no financial facts could be extracted from it. This is expected: "
    "Norwegian issuers generally don't ESEF-tag half-year reports, only annual ones."
)


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


@dataclass
class NewswebBulkImportResult:
    """What one "fetch every available year" run did. ``newly_imported``
    only lists reports actually downloaded this run — call
    list_newsweb_imports() afterwards for the full, current set on file."""

    newly_imported: list[NewswebImportResult] = field(default_factory=list)
    already_on_file: list[str] = field(default_factory=list)  # titles, not re-downloaded
    no_esef_file: list[str] = field(default_factory=list)  # titles with only a PDF on Newsweb
    failed: list[str] = field(default_factory=list)  # "title: reason" — one bad year doesn't abort the rest


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


def _newsweb_documents(db: Session, holding: Holding, document_type: str) -> list[Document]:
    """Every Document this importer itself created for this holding of the
    given kind (an ordinary upload never carries the newsweb_source flag),
    newest published-date first."""
    documents = db.scalars(
        select(Document)
        .where(Document.holding_id == holding.id, Document.type == document_type)
        .order_by(Document.uploaded_at.desc())
    )
    return [d for d in documents if isinstance((d.quality_flags or {}).get(NEWSWEB_SOURCE_FLAG), dict)]


def list_newsweb_imports(db: Session, holding: Holding) -> list[NewswebImportResult]:
    """Every annual report fetched from Newsweb for this holding so far,
    newest first — empty if none has ever been fetched this way."""
    return _list_newsweb_imports(db, holding, document_type=ANNUAL_REPORT_DOCUMENT_TYPE)


def list_newsweb_interim_imports(db: Session, holding: Holding) -> list[NewswebImportResult]:
    """Every half-year report fetched from Newsweb for this holding so
    far, newest first — empty if none has ever been fetched this way."""
    return _list_newsweb_imports(db, holding, document_type=INTERIM_REPORT_DOCUMENT_TYPE)


def _list_newsweb_imports(db: Session, holding: Holding, *, document_type: str) -> list[NewswebImportResult]:
    documents = _newsweb_documents(db, holding, document_type)
    documents.sort(
        key=lambda d: (d.quality_flags or {}).get(NEWSWEB_SOURCE_FLAG, {}).get("published_at") or "",
        reverse=True,
    )
    return [_result_from_document(db, d) for d in documents]


def _already_imported_message_ids(db: Session, holding: Holding, *, document_type: str) -> set[str]:
    ids: set[str] = set()
    for document in _newsweb_documents(db, holding, document_type):
        message_id = (document.quality_flags or {}).get(NEWSWEB_SOURCE_FLAG, {}).get("message_id")
        if message_id:
            ids.add(str(message_id))
    return ids


def _import_one(
    db: Session,
    holding: Holding,
    provider: NewswebFilingProvider,
    storage: ObjectStorageProvider,
    ref: NewswebAnnualReportRef,
    *,
    document_type: str,
    allow_pdf_fallback: bool,
    report_label: str,
) -> NewswebImportResult:
    """Download, extract and ingest a single already-found announcement.
    Raises NewswebImportError on anything that goes wrong (a bad zip, an
    ingestion failure, ...) — callers of the bulk fetch catch this per
    report so one bad year doesn't abort the rest."""
    chosen, is_esef = pick_report_attachment(ref.attachments, allow_pdf_fallback=allow_pdf_fallback)
    if chosen is None:
        names = ", ".join(a.name for a in ref.attachments) or "no attachments"
        wanted = "no ESEF (.xhtml or .zip) or PDF attachment" if allow_pdf_fallback else "no ESEF (.xhtml or .zip) attachment"
        raise NewswebImportError(
            f"'{ref.title}' has {wanted} on Newsweb — only {names} is published. "
            "Upload the file by hand if the company publishes it elsewhere (e.g. its own investor site)"
        )

    try:
        raw = provider.download_attachment(ref.message_id, chosen.attachment_id)
    except NewswebFilingUnavailableError as exc:
        raise NewswebImportError(str(exc)) from exc

    warnings: list[str] = []
    if not is_esef:
        # PDF fallback (interim reports only, see module docstring): ingest
        # the PDF bytes as-is — no unzip/extract step, no financial facts.
        filename, content, mime_type = chosen.name, raw, "application/pdf"
        warnings.append(PDF_NO_FACTS_WARNING)
    elif chosen.name.lower().endswith(".zip"):
        try:
            filename, content = extract_xhtml_from_zip(raw, max_member_bytes=300 * 1024 * 1024)
        except NewswebFilingUnavailableError as exc:
            raise NewswebImportError(str(exc)) from exc
        mime_type = "application/xhtml+xml"
    else:
        filename, content, mime_type = chosen.name, raw, "application/xhtml+xml"

    try:
        intake = ingest_holding_document(
            db,
            storage,
            holding_id=holding.id,
            filename=filename,
            content=content,
            mime_type=mime_type,
            document_type=document_type,
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
        "report_kind": report_label,
    }
    document = intake.document
    document.quality_flags = {**(document.quality_flags or {}), NEWSWEB_SOURCE_FLAG: source_flags}
    db.commit()

    result = _result_from_document(db, document)
    result.was_duplicate = intake.was_duplicate
    return result


def _import_all_reports_from_newsweb(
    db: Session,
    holding: Holding,
    provider: NewswebFilingProvider,
    storage: ObjectStorageProvider,
    *,
    since: date,
    document_type: str,
    allow_pdf_fallback: bool,
    report_label: str,
    list_refs: Callable[[str, date], list[NewswebAnnualReportRef]],
) -> NewswebBulkImportResult:
    if not newsweb_applies(holding):
        raise NewswebImportError(
            "Newsweb covers Oslo Børs issuers only (.OL ticker or NOK) — this holding doesn't look like one"
        )
    issuer_sign = issuer_sign_for_ticker(holding.ticker)
    if not issuer_sign:
        raise NewswebImportError(f"no issuer sign derivable from ticker '{holding.ticker}'")

    try:
        refs = list_refs(issuer_sign, since)
    except NewswebFilingUnavailableError as exc:
        raise NewswebImportError(str(exc)) from exc
    if not refs:
        raise NewswebImportError(
            f"no {report_label} announcement with an attachment found on Newsweb for {issuer_sign} "
            f"since {since.isoformat()} — check newsweb.oslobors.no directly, or upload reports by hand"
        )

    already = _already_imported_message_ids(db, holding, document_type=document_type)
    bulk = NewswebBulkImportResult()
    for ref in refs:
        if ref.message_id in already:
            bulk.already_on_file.append(ref.title)
            continue
        try:
            bulk.newly_imported.append(
                _import_one(
                    db,
                    holding,
                    provider,
                    storage,
                    ref,
                    document_type=document_type,
                    allow_pdf_fallback=allow_pdf_fallback,
                    report_label=report_label,
                )
            )
        except NewswebImportError as exc:
            if "no ESEF" in str(exc):
                bulk.no_esef_file.append(ref.title)
            else:
                bulk.failed.append(f"{ref.title}: {exc}")
    return bulk


def import_all_annual_reports_from_newsweb(
    db: Session,
    holding: Holding,
    provider: NewswebFilingProvider,
    storage: ObjectStorageProvider,
    *,
    since: date,
) -> NewswebBulkImportResult:
    """Fetch every ANNUAL FINANCIAL REPORT announcement on Newsweb for this
    holding from ``since`` through today, skipping any already on file
    (matched by Newsweb's own message_id). Raises NewswebImportError only
    when the listing itself can't be trusted (ineligible holding, no
    issuer sign, Newsweb unreachable, or nothing at all found in the
    window) — a single bad year among several found is recorded in
    ``failed``/``no_esef_file`` instead of aborting the whole run."""
    return _import_all_reports_from_newsweb(
        db,
        holding,
        provider,
        storage,
        since=since,
        document_type=ANNUAL_REPORT_DOCUMENT_TYPE,
        allow_pdf_fallback=False,
        report_label="ANNUAL FINANCIAL REPORT",
        list_refs=lambda issuer_sign, since_date: provider.list_annual_reports(issuer_sign, since=since_date),
    )


def import_all_interim_reports_from_newsweb(
    db: Session,
    holding: Holding,
    provider: NewswebFilingProvider,
    storage: ObjectStorageProvider,
    *,
    since: date,
) -> NewswebBulkImportResult:
    """Fetch every HALF YEAR FINANCIAL REPORT announcement on Newsweb for
    this holding from ``since`` through today, skipping any already on
    file. Same shape as import_all_annual_reports_from_newsweb, but a PDF
    attachment is accepted (Norwegian issuers essentially never ESEF-tag
    interim reports) — ingested as text evidence only, no financial facts
    (see PDF_NO_FACTS_WARNING and the module docstring)."""
    return _import_all_reports_from_newsweb(
        db,
        holding,
        provider,
        storage,
        since=since,
        document_type=INTERIM_REPORT_DOCUMENT_TYPE,
        allow_pdf_fallback=True,
        report_label="HALF YEAR FINANCIAL REPORT",
        list_refs=lambda issuer_sign, since_date: provider.list_interim_reports(issuer_sign, since=since_date),
    )
