"""Live research endpoints (Sprint 2) — macro/geopolitical, sector, and
per-company evidence-first research (CLAUDE.md Rule 2: every returned item
carries a real, citable source_url/source_name).

Each GET serves cached research_items if the latest COMPLETED run is still
fresh (RESEARCH_STALE_AFTER_HOURS), otherwise calls the configured
ResearchProvider for real and persists the result — see
app/services/research/common.py. The matching POST .../refresh endpoint
forces a real call regardless of freshness, for "I want this now" (a
single-user dev-run app isn't always running when a background scheduler
would otherwise fire — no scheduler exists yet this sprint, see the sprint
plan doc).

A provider failure never raises a 500 into the caller's face: it's
recorded as a FAILED research_run (fail visibly, CLAUDE.md) and the
response still comes back with `available`/`reason` telling the caller
exactly what happened — falling back to a still-cached snapshot when one
exists.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.providers.base import ResearchProvider
from app.providers.factory import get_research_provider
from app.schemas.research import (
    CompanyResearchOut,
    MacroResearchOut,
    ResearchItemOut,
    SectorResearchOut,
)
from app.services.research.common import ResearchSnapshot
from app.services.research.company import get_company_research
from app.services.research.macro import get_macro_research
from app.services.research.sector import get_sector_research

router = APIRouter(prefix="/research", tags=["research"])


def _items_out(snapshot: ResearchSnapshot) -> list[ResearchItemOut]:
    return [
        ResearchItemOut(
            title=item.title,
            summary=item.summary,
            source_name=item.source_name,
            source_url=item.source_url,
            source_type=item.source_type,
            published_at=item.published_at,
            retrieved_at=item.retrieved_at,
        )
        for item in snapshot.items
    ]


@router.get("/macro", response_model=MacroResearchOut)
def get_macro(
    db: Session = Depends(get_db), provider: ResearchProvider = Depends(get_research_provider)
) -> MacroResearchOut:
    snapshot = get_macro_research(db, provider)
    return MacroResearchOut(
        available=snapshot.available, as_of=snapshot.as_of, items=_items_out(snapshot), reason=snapshot.reason
    )


@router.post("/macro/refresh", response_model=MacroResearchOut)
def refresh_macro(
    db: Session = Depends(get_db), provider: ResearchProvider = Depends(get_research_provider)
) -> MacroResearchOut:
    snapshot = get_macro_research(db, provider, force=True)
    return MacroResearchOut(
        available=snapshot.available, as_of=snapshot.as_of, items=_items_out(snapshot), reason=snapshot.reason
    )


@router.get("/sectors/{sector}", response_model=SectorResearchOut)
def get_sector(
    sector: str,
    db: Session = Depends(get_db),
    provider: ResearchProvider = Depends(get_research_provider),
) -> SectorResearchOut:
    snapshot = get_sector_research(db, provider, sector=sector)
    return SectorResearchOut(
        available=snapshot.available,
        sector=sector,
        as_of=snapshot.as_of,
        items=_items_out(snapshot),
        reason=snapshot.reason,
    )


@router.post("/sectors/{sector}/refresh", response_model=SectorResearchOut)
def refresh_sector(
    sector: str,
    db: Session = Depends(get_db),
    provider: ResearchProvider = Depends(get_research_provider),
) -> SectorResearchOut:
    snapshot = get_sector_research(db, provider, sector=sector, force=True)
    return SectorResearchOut(
        available=snapshot.available,
        sector=sector,
        as_of=snapshot.as_of,
        items=_items_out(snapshot),
        reason=snapshot.reason,
    )


def _get_holding_or_404(db: Session, holding_id: UUID) -> Holding:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return holding


@router.get("/holdings/{holding_id}", response_model=CompanyResearchOut)
def get_company(
    holding_id: UUID,
    db: Session = Depends(get_db),
    provider: ResearchProvider = Depends(get_research_provider),
) -> CompanyResearchOut:
    holding = _get_holding_or_404(db, holding_id)
    snapshot = get_company_research(db, provider, holding=holding)
    return CompanyResearchOut(
        available=snapshot.available,
        holding_id=holding.id,
        ticker=holding.ticker,
        as_of=snapshot.as_of,
        items=_items_out(snapshot),
        reason=snapshot.reason,
    )


@router.post("/holdings/{holding_id}/refresh", response_model=CompanyResearchOut)
def refresh_company(
    holding_id: UUID,
    db: Session = Depends(get_db),
    provider: ResearchProvider = Depends(get_research_provider),
) -> CompanyResearchOut:
    holding = _get_holding_or_404(db, holding_id)
    snapshot = get_company_research(db, provider, holding=holding, force=True)
    return CompanyResearchOut(
        available=snapshot.available,
        holding_id=holding.id,
        ticker=holding.ticker,
        as_of=snapshot.as_of,
        items=_items_out(snapshot),
        reason=snapshot.reason,
    )
