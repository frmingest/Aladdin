"""ESEF history import from filings.xbrl.org (Sprint 10, 2026-09-25).

Gives an Oslo holding its FY2020-FY2024 figures without uploading each
annual report: look the company up by LEI in XBRL International's free ESEF
index, fetch each filing as xBRL-JSON, and map the facts with the same code
as an uploaded .xhtml (app/services/documents/extraction/ixbrl.py).

Rules (same spirit as the SEC EDGAR import, app/services/filings/sec_edgar.py):
- Each fetched filing is stored verbatim as an ``esef_index_facts``
  Document (sha256-deduplicated) with its provenance (LEI, filing id, report
  and viewer URLs, integrity checks) in quality_flags; every imported
  FinancialLineItem points at the filing it came from.
- A year's figures come from that year's own filing. A year no filing in
  the index covers (the one before the first ESEF year) is taken from the
  comparative column of the following year's filing.
- Years that already have figures from another source (an uploaded file or
  SEC EDGAR) are left alone and reported as skipped: one source per year.
- Re-importing replaces the previous import's figures (the Documents stay
  as the audit trail).
- The LEI must match the filing's entity; nothing from another company is
  attached.

The index runs about a year behind for Norway, so the latest year still
comes from the .xhtml Faiz uploads.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.document_types import (
    DOCUMENT_STATUS_PROCESSED,
    DOCUMENT_TYPE_ESEF_INDEX,
)
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.esef_index_provider import (
    LEI_PATTERN,
    EsefFilingRef,
    EsefIndexUnavailableError,
    FilingsXbrlOrgProvider,
)
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.extraction.xbrl_json import entity_leis, map_xbrl_json
from app.services.documents.hashing import sha256_hex

ESEF_INDEX_SOURCE = "filings.xbrl.org"
_LEI_IN_TEXT = re.compile(r"(?<![A-Z0-9])([A-Z0-9]{18}[0-9]{2})(?![A-Z0-9])")


class EsefImportError(Exception):
    """Import could not run — the message is safe to show the user."""


@dataclass
class EsefFilingUsed:
    period_end: str
    fxo_id: str
    report_url: str
    viewer_url: str
    error_count: int
    years_used: list[str] = field(default_factory=list)
    integrity_failed: list[str] = field(default_factory=list)


@dataclass
class EsefImportResult:
    lei: str
    lei_source: str
    imported_at: str
    periods_imported: list[str] = field(default_factory=list)
    periods_skipped_existing: list[str] = field(default_factory=list)
    facts_imported: int = 0
    metrics_by_period: dict[str, list[str]] = field(default_factory=dict)
    filings: list[EsefFilingUsed] = field(default_factory=list)
    latest_period_in_index: str | None = None
    warnings: list[str] = field(default_factory=list)


# --- LEI -------------------------------------------------------------------


def find_lei(db: Session, holding: Holding) -> tuple[str | None, str]:
    """(LEI, where it was found). Order: the LEI read from an uploaded ESEF
    file's contexts, an LEI in an uploaded file's name (ESEF packages are
    named <LEI>-<date>-...), the LEI of a previous import."""
    documents = list(
        db.scalars(
            select(Document).where(Document.holding_id == holding.id).order_by(Document.uploaded_at.desc())
        )
    )
    for doc in documents:
        if doc.type == DOCUMENT_TYPE_ESEF_INDEX:
            continue
        ixbrl = (doc.quality_flags or {}).get("ixbrl")
        lei = ixbrl.get("entity_lei") if isinstance(ixbrl, dict) else None
        if isinstance(lei, str) and LEI_PATTERN.match(lei):
            return lei, f"uploaded ESEF file '{doc.original_filename}'"
    for doc in documents:
        if doc.type == DOCUMENT_TYPE_ESEF_INDEX:
            continue
        match = _LEI_IN_TEXT.search((doc.original_filename or "").upper())
        if match:
            return match.group(1), f"file name '{doc.original_filename}'"
    for doc in documents:
        lei = (doc.quality_flags or {}).get("lei") if doc.type == DOCUMENT_TYPE_ESEF_INDEX else None
        if isinstance(lei, str) and LEI_PATTERN.match(lei):
            return lei, "previous ESEF-index import"
    return None, ""


# --- stored summary ------------------------------------------------------------


def _index_documents(db: Session, holding: Holding) -> list[Document]:
    return list(
        db.scalars(
            select(Document)
            .where(Document.holding_id == holding.id, Document.type == DOCUMENT_TYPE_ESEF_INDEX)
            .order_by(Document.uploaded_at.desc())
        )
    )


def latest_import_summary(db: Session, holding: Holding) -> EsefImportResult | None:
    """The summary of the most recent import (stored on each of its
    Documents), or None when the holding was never imported."""
    best: tuple[str, dict] | None = None
    for doc in _index_documents(db, holding):
        summary = (doc.quality_flags or {}).get("import_summary")
        if isinstance(summary, dict) and (best is None or str(summary.get("imported_at", "")) > best[0]):
            best = (str(summary.get("imported_at", "")), summary)
    if best is None:
        return None
    data = dict(best[1])
    data["filings"] = [EsefFilingUsed(**f) for f in data.get("filings", [])]
    return EsefImportResult(**data)


# --- import --------------------------------------------------------------------


def _fy_of(period_end: str) -> str:
    return f"FY{period_end[:4]}"


def import_esef_history(
    db: Session,
    holding: Holding,
    provider: FilingsXbrlOrgProvider,
    storage: ObjectStorageProvider,
    *,
    lei: str | None = None,
    max_filings: int = 5,
) -> EsefImportResult:
    lei_source = "entered by hand"
    if lei:
        lei = lei.strip().upper()
        if not LEI_PATTERN.match(lei):
            raise EsefImportError(f"'{lei}' is not a valid LEI — it is 20 letters and digits, e.g. from search.gleif.org")
    else:
        lei, lei_source = find_lei(db, holding)
        if lei is None:
            raise EsefImportError(
                "No LEI found for this holding. Upload its ESEF annual report (.xhtml) first, or enter the "
                "LEI by hand (look it up at search.gleif.org)"
            )

    try:
        filings = provider.list_filings(lei)
    except EsefIndexUnavailableError as exc:
        raise EsefImportError(str(exc)) from exc
    if not filings:
        raise EsefImportError(f"filings.xbrl.org has no ESEF filings for LEI {lei}")
    filings = filings[: max(1, max_filings)]

    fetched: list[tuple[EsefFilingRef, dict, bytes]] = []
    warnings: list[str] = []
    for ref in filings:
        try:
            data, raw = provider.get_filing_json(ref)
        except EsefIndexUnavailableError as exc:
            warnings.append(f"{_fy_of(ref.period_end)} filing skipped: {exc}")
            continue
        leis = entity_leis(data)
        if leis and leis != {lei}:
            raise EsefImportError(
                f"filing {ref.fxo_id} is reported for {', '.join(sorted(leis))}, not {lei} — refusing to "
                "attach another company's figures"
            )
        fetched.append((ref, data, raw))
    if not fetched:
        raise EsefImportError("no filing could be fetched from filings.xbrl.org: " + "; ".join(warnings))

    # Supersede the previous import's figures (Documents stay).
    for old in _index_documents(db, holding):
        for item in list(db.scalars(select(FinancialLineItem).where(FinancialLineItem.document_id == old.id))):
            db.delete(item)
    db.flush()

    existing_periods = set(
        db.scalars(
            select(FinancialLineItem.period)
            .join(Document, Document.id == FinancialLineItem.document_id)
            .where(FinancialLineItem.holding_id == holding.id, Document.type != DOCUMENT_TYPE_ESEF_INDEX)
        )
    )

    # Map every filing, then pick one source filing per fiscal year.
    mapped = {ref: map_xbrl_json(data) for ref, data, _raw in fetched}
    chosen: dict[str, EsefFilingRef] = {}
    for ref, _data, _raw in fetched:  # own year first
        if any(f.period == _fy_of(ref.period_end) for f in mapped[ref].facts):
            chosen.setdefault(_fy_of(ref.period_end), ref)
    for ref, _data, _raw in sorted(fetched, key=lambda item: item[0].period_end):  # then comparatives
        for fact in mapped[ref].facts:
            chosen.setdefault(fact.period, ref)

    skipped = sorted({fy for fy in chosen if fy in existing_periods}, reverse=True)
    imported_at = datetime.now(timezone.utc).isoformat()
    import_id = str(uuid.uuid4())
    result = EsefImportResult(
        lei=lei,
        lei_source=lei_source,
        imported_at=imported_at,
        periods_skipped_existing=skipped,
        latest_period_in_index=_fy_of(filings[0].period_end),
        warnings=warnings,
    )

    documents: list[tuple[Document, EsefFilingUsed]] = []
    for ref, _data, raw in fetched:
        facts_map = mapped[ref]
        digest = sha256_hex(raw)
        document = db.scalar(select(Document).where(Document.sha256 == digest))
        if document is not None and document.holding_id != holding.id:
            result.warnings.append(
                f"{_fy_of(ref.period_end)} filing is already attached to another holding — two holdings share "
                "one LEI; fix the duplicate first"
            )
            continue
        years = sorted(
            {f.period for f in facts_map.facts if chosen.get(f.period) is ref and f.period not in existing_periods},
            reverse=True,
        )
        used = EsefFilingUsed(
            period_end=ref.period_end,
            fxo_id=ref.fxo_id,
            report_url=ref.report_url,
            viewer_url=ref.viewer_url,
            error_count=ref.error_count,
            years_used=years,
            integrity_failed=list(facts_map.integrity.get("failed", []))[:10],
        )
        if used.integrity_failed:
            result.warnings.append(
                f"{_fy_of(ref.period_end)} filing fails {len(used.integrity_failed)} statement check(s): "
                + "; ".join(used.integrity_failed[:3])
            )
        if ref.error_count:
            result.warnings.append(
                f"{_fy_of(ref.period_end)} filing has {ref.error_count} XBRL validation error(s) in the index"
            )
        flags = {
            "source": ESEF_INDEX_SOURCE,
            "lei": lei,
            "fxo_id": ref.fxo_id,
            "period_end": ref.period_end,
            "json_url": ref.json_url,
            "report_url": ref.report_url,
            "viewer_url": ref.viewer_url,
            "index_error_count": ref.error_count,
            "esef_index": {
                "fiscal_years": facts_map.years,
                "facts_mapped": len(facts_map.facts),
                "fact_sources": facts_map.fact_sources,
                "integrity_checks": facts_map.integrity,
            },
            "import_id": import_id,
        }
        if facts_map.other_equity:
            flags["equity_includes_hybrid_capital"] = facts_map.other_equity
        if facts_map.conflicts:
            flags["fact_conflicts"] = facts_map.conflicts[:20]
        filename = f"{ref.fxo_id or lei + '-' + ref.period_end}.json"
        if document is None:
            document = Document(
                holding_id=holding.id,
                type=DOCUMENT_TYPE_ESEF_INDEX,
                original_filename=filename,
                mime_type="application/json",
                size_bytes=len(raw),
                storage_path=storage.store(f"{digest}/{filename}", raw),
                reporting_period=_fy_of(ref.period_end),
                sha256=digest,
                status=DOCUMENT_STATUS_PROCESSED,
                quality_flags=flags,
            )
            db.add(document)
        else:
            document.quality_flags = flags
        db.flush()
        documents.append((document, used))
        result.filings.append(used)

        for fact in facts_map.facts:
            # Units, currencies and signs were already checked by
            # map_tagged_facts, exactly as for an uploaded .xhtml.
            if fact.period not in years:
                continue
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
                    confidence=fact.confidence,
                )
            )
            result.metrics_by_period.setdefault(fact.period, []).append(fact.metric)
            result.facts_imported += 1

    result.metrics_by_period = {k: sorted(v) for k, v in sorted(result.metrics_by_period.items(), reverse=True)}
    result.periods_imported = list(result.metrics_by_period)
    summary = asdict(result)
    for document, _used in documents:
        document.quality_flags = {**(document.quality_flags or {}), "import_summary": summary}
    db.commit()
    return result
