"""External research endpoints (architecture §26 Phase 4).

Manual refresh endpoints exist alongside the scheduler
(app.services.research.scheduler) for the same reason Phase 2's valuation
refresh is on-demand: a single-user dev-run app isn't always running when a
scheduled interval elapses, and a manual "refresh now" is simpler than
standing up job-status polling for a personal tool (§2.9). Both paths share
the same service-layer caching (app.services.research.common) — a manual
refresh with `force=False` (the default) is skipped exactly like a scheduled
one would be if the existing run is still fresh; `force=True` bypasses that.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.models.research import ResearchRun
from app.providers.base import MacroDataProvider, ResearchProvider
from app.providers.factory import get_macro_data_provider, get_research_provider
from app.schemas.research import MacroObservationOut, MacroSnapshotOut, ResearchItemOut, ResearchRunOut, SectorResearchOut
from app.services.research.macro import MacroSnapshotView, get_latest_macro_snapshot, refresh_macro_snapshot
from app.services.research.sector import SectorResearchView, get_latest_sector_research, refresh_sector_research

router = APIRouter(prefix="/research", tags=["research"])


def _run_to_out(run: ResearchRun) -> ResearchRunOut:
    return ResearchRunOut(
        id=run.id,
        type=run.type,
        sector=run.sector,
        status=run.status,
        started_at=run.started_at,
        completed_at=run.completed_at,
        methodology_version=run.methodology_version,
        item_count=len(run.items),
        error_message=run.error_message,
    )


def _items_to_out(items) -> list[ResearchItemOut]:
    return [
        ResearchItemOut(
            title=i.title,
            summary=i.summary,
            source_name=i.source_name,
            source_url=i.source_url,
            published_at=i.published_at,
            retrieved_at=i.retrieved_at,
        )
        for i in items
    ]


def _macro_snapshot_to_out(snapshot: MacroSnapshotView) -> MacroSnapshotOut:
    return MacroSnapshotOut(
        available=snapshot.available,
        as_of=snapshot.as_of,
        observations=[
            MacroObservationOut(
                series_key=o.series_key,
                value=o.value,
                unit=o.unit,
                region=o.region,
                provider=o.provider,
                observed_at=o.observed_at,
            )
            for o in snapshot.observations
        ],
        narrative_items=_items_to_out(snapshot.narrative_items),
        reason=snapshot.reason,
    )


def _sector_research_to_out(view: SectorResearchView) -> SectorResearchOut:
    return SectorResearchOut(
        available=view.available,
        sector=view.sector,
        as_of=view.as_of,
        items=_items_to_out(view.items),
        reason=view.reason,
    )


@router.get("/macro/snapshot", response_model=MacroSnapshotOut)
def get_macro_snapshot(db: Session = Depends(get_db)) -> MacroSnapshotOut:
    """Reads the latest persisted macro data/narrative — never calls a
    provider (§2.7: reading is always free of network cost). Use
    POST /research/macro/refresh to update it."""
    return _macro_snapshot_to_out(get_latest_macro_snapshot(db))


@router.post("/macro/refresh", response_model=ResearchRunOut, status_code=201)
def trigger_macro_refresh(
    force: bool = False,
    db: Session = Depends(get_db),
    macro_provider: MacroDataProvider = Depends(get_macro_data_provider),
    research_provider: ResearchProvider = Depends(get_research_provider),
) -> ResearchRunOut:
    run = refresh_macro_snapshot(db, macro_provider, research_provider, force=force)
    return _run_to_out(run)


@router.get("/sectors", response_model=list[str])
def list_known_sectors(db: Session = Depends(get_db)) -> list[str]:
    """Sectors currently present on any holding (§20 Holding.sector) — what
    the sector-refresh endpoints below actually accept, and what the
    scheduler (app.services.research.scheduler) iterates over."""
    rows = db.query(Holding.sector).filter(Holding.sector.isnot(None)).distinct().order_by(Holding.sector).all()
    return [row[0] for row in rows]


@router.get("/sectors/{sector}/items", response_model=SectorResearchOut)
def get_sector_research(sector: str, db: Session = Depends(get_db)) -> SectorResearchOut:
    return _sector_research_to_out(get_latest_sector_research(db, sector))


@router.post("/sectors/{sector}/refresh", response_model=ResearchRunOut, status_code=201)
def trigger_sector_refresh(
    sector: str,
    force: bool = False,
    db: Session = Depends(get_db),
    research_provider: ResearchProvider = Depends(get_research_provider),
) -> ResearchRunOut:
    run = refresh_sector_research(db, research_provider, sector, force=force)
    return _run_to_out(run)


@router.get("/runs/{run_id}", response_model=ResearchRunOut)
def get_research_run(run_id: UUID, db: Session = Depends(get_db)) -> ResearchRunOut:
    run = db.get(ResearchRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="research run not found")
    return _run_to_out(run)
