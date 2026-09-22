"""Primary-source filings endpoints (2026-09-22).

- SEC EDGAR: ``POST /sources/holdings/{id}/sec-edgar/import`` pulls the
  company's XBRL facts and stores them as FinancialLineItems (read by
  metrics/valuation/analysis unchanged); ``GET`` returns the last import.
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
from app.models.holding import Holding
from app.providers.base import FundamentalsProvider
from app.providers.factory import (
    get_announcements_provider_or_none,
    get_fundamentals_provider_or_none,
    get_object_storage,
)
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.schemas.research import ResearchItemOut
from app.schemas.sources import (
    AnnouncementsOut,
    EdgarFilingOut,
    EdgarImportOut,
    SourceEligibilityOut,
)
from app.services.filings.announcements import get_holding_announcements
from app.services.filings.eligibility import newsweb_applies
from app.services.filings.sec_edgar import (
    EdgarImportError,
    EdgarImportResult,
    import_sec_edgar_fundamentals,
    latest_edgar_document,
    result_from_document,
)
from app.services.research.common import ResearchSnapshot

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
    )


@router.get("/holdings/{holding_id}/sec-edgar", response_model=EdgarImportOut)
def get_sec_edgar(holding_id: UUID, db: Session = Depends(get_db)) -> EdgarImportOut:
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
    holding = _get_holding_or_404(db, holding_id)
    return _announcements_out(holding, get_holding_announcements(db, provider, holding=holding))


@router.post("/holdings/{holding_id}/announcements/refresh", response_model=AnnouncementsOut)
def refresh_announcements(
    holding_id: UUID,
    db: Session = Depends(get_db),
    provider: NewswebAnnouncementsProvider | None = Depends(get_announcements_provider_or_none),
) -> AnnouncementsOut:
    holding = _get_holding_or_404(db, holding_id)
    return _announcements_out(holding, get_holding_announcements(db, provider, holding=holding, force=True))
