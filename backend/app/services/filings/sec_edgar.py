"""SEC EDGAR fundamentals import: provider facts -> Document +
FinancialLineItem rows, so the existing calculations/valuation/analysis
code uses them with no change (they read FinancialLineItem regardless of
where a fact came from).

Persistence rules:
- The verbatim company-facts JSON is stored in object storage as a
  ``sec_xbrl_facts`` Document (sha256-deduplicated like any upload), with
  per-fact provenance (XBRL concept, form, accession number, filed date) in
  ``quality_flags["provenance"]`` — CLAUDE.md Rule 2 traceability.
- Re-importing unchanged data is a no-op (same sha256).
- A newer payload supersedes older EDGAR imports for the holding: the older
  EDGAR Documents stay (audit trail) but their line items are removed, so
  the same fiscal year is never double-counted.
- Periods that already have facts from a document Faiz uploaded himself are
  left alone — EDGAR skips them rather than mixing two sources' numbers
  into one period (report shows which were skipped).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.document_types import DOCUMENT_STATUS_PROCESSED, DOCUMENT_TYPE_SEC_XBRL
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.base import FundamentalsProvider, FundamentalsUnavailableError
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.hashing import sha256_hex
from app.services.filings.eligibility import has_foreign_suffix, names_match
from app.services.market_data.shares import record_sec_cover_shares

EDGAR_FACT_CONFIDENCE = 1.0  # filer-reported XBRL, not an LLM/heuristic extraction


class EdgarImportError(Exception):
    """Import could not run — the message is safe to show the user."""


@dataclass
class EdgarFilingRef:
    accession_number: str
    form: str
    filed: str
    url: str


@dataclass
class EdgarImportResult:
    cik: str
    entity_name: str
    source_url: str
    document_id: str
    was_duplicate: bool
    periods_imported: list[str] = field(default_factory=list)
    periods_skipped_manual: list[str] = field(default_factory=list)
    facts_imported: int = 0
    metrics_by_period: dict[str, list[str]] = field(default_factory=dict)
    filings: list[EdgarFilingRef] = field(default_factory=list)
    retrieved_at: datetime | None = None
    warnings: list[str] = field(default_factory=list)


def filing_url(cik: str, accession_number: str) -> str:
    return (
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
        f"{accession_number.replace('-', '')}/{accession_number}-index.htm"
    )


def _edgar_documents(db: Session, holding: Holding) -> list[Document]:
    stmt = (
        select(Document)
        .where(Document.holding_id == holding.id, Document.type == DOCUMENT_TYPE_SEC_XBRL)
        .order_by(Document.created_at.desc())
    )
    return list(db.scalars(stmt))


def latest_edgar_document(db: Session, holding: Holding) -> Document | None:
    docs = _edgar_documents(db, holding)
    return docs[0] if docs else None


def result_from_document(db: Session, document: Document) -> EdgarImportResult:
    """Rebuilds the import summary from a stored EDGAR Document (for GET)."""
    flags = document.quality_flags or {}
    items = list(
        db.scalars(select(FinancialLineItem).where(FinancialLineItem.document_id == document.id))
    )
    metrics_by_period: dict[str, list[str]] = {}
    for item in items:
        metrics_by_period.setdefault(item.period, []).append(item.metric)
    return EdgarImportResult(
        cik=str(flags.get("cik", "")),
        entity_name=str(flags.get("entity_name", "")),
        source_url=str(flags.get("source_url", "")),
        document_id=str(document.id),
        was_duplicate=True,
        periods_imported=sorted(metrics_by_period, reverse=True),
        periods_skipped_manual=list(flags.get("periods_skipped_manual", [])),
        facts_imported=len(items),
        metrics_by_period={k: sorted(v) for k, v in sorted(metrics_by_period.items(), reverse=True)},
        filings=[EdgarFilingRef(**f) for f in flags.get("filings", [])],
        retrieved_at=document.created_at,
        warnings=list(flags.get("warnings", [])),
    )


def import_sec_edgar_fundamentals(
    db: Session,
    holding: Holding,
    provider: FundamentalsProvider,
    storage: ObjectStorageProvider,
) -> EdgarImportResult:
    try:
        resolved = provider.resolve_company(holding.ticker)
    except FundamentalsUnavailableError as exc:
        raise EdgarImportError(str(exc)) from exc
    if resolved is None:
        raise EdgarImportError(
            f"'{holding.ticker}' is not an SEC-registered ticker — EDGAR only covers companies "
            "that file with the SEC (Oslo-only names are covered by Newsweb instead)"
        )
    cik, registered_name = resolved
    warnings: list[str] = []
    if not names_match(holding.name, registered_name):
        if has_foreign_suffix(holding.ticker):
            raise EdgarImportError(
                f"'{holding.ticker}' maps to SEC filer '{registered_name}', which doesn't look like "
                f"'{holding.name}' — refusing to attach another company's financials"
            )
        warnings.append(
            f"SEC's registered name '{registered_name}' differs from the holding name '{holding.name}' "
            "— check the ticker is right"
        )

    try:
        fundamentals = provider.get_annual_fundamentals(cik)
    except FundamentalsUnavailableError as exc:
        raise EdgarImportError(str(exc)) from exc

    digest = sha256_hex(fundamentals.raw_payload)
    existing = db.scalar(select(Document).where(Document.sha256 == digest))
    if existing is not None and existing.holding_id == holding.id:
        return result_from_document(db, existing)
    if existing is not None:
        raise EdgarImportError(
            f"this exact EDGAR payload (CIK {cik}) is already attached to another holding — "
            "two holdings share one SEC filer; fix the duplicate ticker first"
        )

    # Periods with facts from a user-uploaded filing are kept as-is.
    manual_periods = set(
        db.scalars(
            select(FinancialLineItem.period)
            .join(Document, Document.id == FinancialLineItem.document_id)
            .where(FinancialLineItem.holding_id == holding.id, Document.type != DOCUMENT_TYPE_SEC_XBRL)
        )
    )

    # Supersede previous EDGAR imports' facts (Documents themselves stay).
    for old in _edgar_documents(db, holding):
        for item in list(db.scalars(select(FinancialLineItem).where(FinancialLineItem.document_id == old.id))):
            db.delete(item)
    db.flush()

    filename = f"CIK{cik}_companyfacts.json"
    storage_path = storage.store(f"{digest}/{filename}", fundamentals.raw_payload)

    imported = [f for f in fundamentals.facts if f.period not in manual_periods]
    skipped = sorted({f.period for f in fundamentals.facts if f.period in manual_periods}, reverse=True)
    filings: dict[str, EdgarFilingRef] = {}
    provenance: dict[str, dict[str, str]] = {}
    for fact in imported:
        provenance[f"{fact.period}:{fact.metric}"] = {
            "concept": fact.concept,
            "form": fact.form,
            "accession_number": fact.accession_number,
            "filed": fact.filed,
            "period_end": fact.period_end,
        }
        if fact.accession_number and fact.accession_number not in filings:
            filings[fact.accession_number] = EdgarFilingRef(
                accession_number=fact.accession_number,
                form=fact.form,
                filed=fact.filed,
                url=filing_url(cik, fact.accession_number),
            )
    filing_list = sorted(filings.values(), key=lambda f: f.filed, reverse=True)

    document = Document(
        holding_id=holding.id,
        type=DOCUMENT_TYPE_SEC_XBRL,
        original_filename=filename,
        mime_type="application/json",
        size_bytes=len(fundamentals.raw_payload),
        storage_path=storage_path,
        reporting_period=imported[0].period if imported else None,
        sha256=digest,
        status=DOCUMENT_STATUS_PROCESSED,
        quality_flags={
            "source": "sec_edgar",
            "cik": cik,
            "entity_name": fundamentals.entity_name or registered_name,
            "source_url": fundamentals.source_url,
            "provenance": provenance,
            "filings": [f.__dict__ for f in filing_list],
            "periods_skipped_manual": skipped,
            "warnings": warnings,
        },
    )
    db.add(document)
    db.flush()
    cover = fundamentals.cover_shares
    if cover is not None and cover.value > 0:
        try:
            as_of = datetime.fromisoformat(cover.period_end).replace(tzinfo=timezone.utc)
        except ValueError:
            as_of = None
        if as_of is not None:
            record_sec_cover_shares(
                db,
                holding,
                shares=cover.value,
                as_of=as_of,
                reference=filing_url(cik, cover.accession_number) if cover.accession_number else fundamentals.source_url,
            )
    for fact in imported:
        db.add(
            FinancialLineItem(
                document_id=document.id,
                holding_id=holding.id,
                metric=fact.metric,
                value=fact.value,
                unit=fact.unit,
                currency=fact.currency,
                period=fact.period,
                source_page=None,
                confidence=EDGAR_FACT_CONFIDENCE,
            )
        )
    db.commit()

    metrics_by_period: dict[str, list[str]] = {}
    for fact in imported:
        metrics_by_period.setdefault(fact.period, []).append(fact.metric)
    return EdgarImportResult(
        cik=cik,
        entity_name=fundamentals.entity_name or registered_name,
        source_url=fundamentals.source_url,
        document_id=str(document.id),
        was_duplicate=False,
        periods_imported=sorted(metrics_by_period, reverse=True),
        periods_skipped_manual=skipped,
        facts_imported=len(imported),
        metrics_by_period={k: sorted(v) for k, v in sorted(metrics_by_period.items(), reverse=True)},
        filings=filing_list,
        retrieved_at=fundamentals.retrieved_at,
        warnings=warnings,
    )
