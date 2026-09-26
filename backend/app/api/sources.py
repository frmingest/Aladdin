"""Primary-source filings endpoints (2026-09-22).

- SEC EDGAR: ``POST /sources/holdings/{id}/sec-edgar/import`` pulls the
  company's XBRL facts and stores them as FinancialLineItems (read by
  metrics/valuation/analysis unchanged); ``GET`` returns the last import.
- ESEF history (Sprint 10): ``POST /sources/holdings/{id}/esef-index/import``
  fetches the company's earlier ESEF filings from filings.xbrl.org by LEI
  and stores them as FinancialLineItems; ``GET`` returns the last import
  and the LEI found on file.
- Newsweb: ``GET /sources/holdings/{id}/announcements`` serves cached Oslo
  Børs announcements (refreshing when stale, like /research/*),
  ``POST .../refresh`` forces a fetch.

Both sources are free and keyless; neither endpoint touches an LLM.
Import failures come back as 422 with a message safe to show in the UI,
never a 500 (fail visibly).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.models.holding import Holding
from app.providers.base import FundamentalsProvider
from app.providers.esef_index_provider import FilingsXbrlOrgProvider
from app.providers.factory import (
    get_announcements_provider_or_none,
    get_esef_index_provider_or_none,
    get_fundamentals_provider_or_none,
    get_object_storage,
)
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.schemas.research import ResearchItemOut
from app.schemas.sources import (
    AnnouncementsOut,
    EdgarFilingOut,
    EdgarImportOut,
    EsefFilingOut,
    EsefImportIn,
    EsefImportOut,
    SourceEligibilityOut,
)
from app.services.filings.announcements import get_holding_announcements
from app.services.filings.eligibility import newsweb_applies
from app.services.filings.esef_index import (
    EsefImportError,
    EsefImportResult,
    find_lei,
    import_esef_history,
    latest_import_summary,
)
from app.services.filings.sec_edgar import (
    EdgarImportError,
    EdgarImportResult,
    import_sec_edgar_fundamentals,
    latest_edgar_document,
    result_from_document,
)
from app.services.research.common import ResearchSnapshot
from app.services.settings.demo_guard import require_not_demo

router = APIRouter(prefix="/sources", tags=["sources"])


def _get_holding_or_404(db: Session, holding_id: UUID) -> Holding:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return holding


def _edgar_out(holding: Holding, result: EdgarImportResult) -> EdgarImportOut:
    return EdgarImportOut(
        holding_id=holding.id,
        imported=True,
        cik=result.cik,
        entity_name=result.entity_name,
        source_url=result.source_url,
        document_id=result.document_id,
        was_duplicate=result.was_duplicate,
        periods_imported=result.periods_imported,
        periods_skipped_manual=result.periods_skipped_manual,
        facts_imported=result.facts_imported,
        metrics_by_period=result.metrics_by_period,
        filings=[EdgarFilingOut(**f.__dict__) for f in result.filings],
        retrieved_at=result.retrieved_at,
        warnings=result.warnings,
    )


def _announcements_out(holding: Holding, snapshot: ResearchSnapshot) -> AnnouncementsOut:
    return AnnouncementsOut(
        available=snapshot.available,
        holding_id=holding.id,
        ticker=holding.ticker,
        as_of=snapshot.as_of,
        items=[
            ResearchItemOut(
                title=i.title,
                summary=i.summary,
                source_name=i.source_name,
                source_url=i.source_url,
                source_type=i.source_type,
                published_at=i.published_at,
                retrieved_at=i.retrieved_at,
            )
            for i in snapshot.items
        ],
        reason=snapshot.reason,
    )


@router.get("/holdings/{holding_id}", response_model=SourceEligibilityOut)
def get_eligibility(holding_id: UUID, db: Session = Depends(get_db)) -> SourceEligibilityOut:
    """Cheap, offline hint for the UI — which buttons to show. EDGAR's real
    answer needs SEC's ticker map, so it is 'try it' for any ticker."""
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    nw = newsweb_applies(holding)
    return SourceEligibilityOut(
        holding_id=holding.id,
        ticker=holding.ticker,
        sec_edgar=True,
        sec_edgar_reason=(
            "Oslo ticker — EDGAR only works if the company also files with the SEC (e.g. Equinor)"
            if holding.ticker.upper().endswith(".OL")
            else None
        ),
        newsweb=nw,
        newsweb_reason=None if nw else "Newsweb covers Oslo Børs issuers only (.OL ticker or NOK)",
        esef_index=nw,
        esef_index_reason=(
            None if nw else "The ESEF index is for EU/EEA-listed companies; this holding looks non-European"
        ),
    )


def _esef_out(db: Session, holding: Holding, result: EsefImportResult | None) -> EsefImportOut:
    suggested, suggested_source = find_lei(db, holding)
    if result is None:
        return EsefImportOut(
            holding_id=holding.id,
            imported=False,
            suggested_lei=suggested,
            suggested_lei_source=suggested_source or None,
        )
    return EsefImportOut(
        holding_id=holding.id,
        imported=True,
        suggested_lei=suggested,
        suggested_lei_source=suggested_source or None,
        lei=result.lei,
        lei_source=result.lei_source,
        imported_at=result.imported_at,
        periods_imported=result.periods_imported,
        periods_skipped_existing=result.periods_skipped_existing,
        facts_imported=result.facts_imported,
        metrics_by_period=result.metrics_by_period,
        filings=[EsefFilingOut(**f.__dict__) for f in result.filings],
        latest_period_in_index=result.latest_period_in_index,
        warnings=result.warnings,
    )


@router.get("/holdings/{holding_id}/esef-index", response_model=EsefImportOut)
def get_esef_index(holding_id: UUID, db: Session = Depends(get_db)) -> EsefImportOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    return _esef_out(db, holding, latest_import_summary(db, holding))


@router.post("/holdings/{holding_id}/esef-index/import", response_model=EsefImportOut)
def import_esef_index(
    holding_id: UUID,
    body: EsefImportIn | None = None,
    db: Session = Depends(get_db),
    provider: FilingsXbrlOrgProvider | None = Depends(get_esef_index_provider_or_none),
    storage=Depends(get_object_storage),
) -> EsefImportOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    if provider is None:
        raise HTTPException(status_code=422, detail="the ESEF history import is switched off (ESEF_INDEX_PROVIDER)")
    try:
        result = import_esef_history(
            db,
            holding,
            provider,
            storage,
            lei=(body.lei if body else None) or None,
            max_filings=get_settings().esef_index_max_filings,
        )
    except EsefImportError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _esef_out(db, holding, result)


@router.get("/holdings/{holding_id}/sec-edgar", response_model=EdgarImportOut)
def get_sec_edgar(holding_id: UUID, db: Session = Depends(get_db)) -> EdgarImportOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    document = latest_edgar_document(db, holding)
    if document is None:
        return EdgarImportOut(holding_id=holding.id, imported=False)
    return _edgar_out(holding, result_from_document(db, document))


@router.post("/holdings/{holding_id}/sec-edgar/import", response_model=EdgarImportOut)
def import_sec_edgar(
    holding_id: UUID,
    db: Session = Depends(get_db),
    provider: FundamentalsProvider | None = Depends(get_fundamentals_provider_or_none),
    storage=Depends(get_object_storage),
) -> EdgarImportOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    if provider is None:
        raise HTTPException(status_code=422, detail="fundamentals provider is disabled (FUNDAMENTALS_PROVIDER)")
    try:
        result = import_sec_edgar_fundamentals(db, holding, provider, storage)
    except EdgarImportError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _edgar_out(holding, result)


@router.get("/holdings/{holding_id}/announcements", response_model=AnnouncementsOut)
def get_announcements(
    holding_id: UUID,
    db: Session = Depends(get_db),
    provider: NewswebAnnouncementsProvider | None = Depends(get_announcements_provider_or_none),
) -> AnnouncementsOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    return _announcements_out(holding, get_holding_announcements(db, provider, holding=holding))


@router.post("/holdings/{holding_id}/announcements/refresh", response_model=AnnouncementsOut)
def refresh_announcements(
    holding_id: UUID,
    db: Session = Depends(get_db),
    provider: NewswebAnnouncementsProvider | None = Depends(get_announcements_provider_or_none),
) -> AnnouncementsOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    return _announcements_out(holding, get_holding_announcements(db, provider, holding=holding, force=True))
