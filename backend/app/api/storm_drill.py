"""Storm Drill endpoints (3D courtyard quest 3).

Database-only: no provider call, no LLM. A drill is a note written before a fall; nothing here
trades, queues or changes any other table. Writes are refused in demo mode like every other write.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.game_mapping.siege_scenarios_v1 import get_siege_scenarios
from app.models.storm_drill import StormDrill
from app.schemas.storm_drill import StormDrillCreate, StormDrillOut, StormDrillsOut
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode

router = APIRouter(prefix="/game/drills", tags=["game"])


def _out(d: StormDrill) -> StormDrillOut:
    return StormDrillOut(
        id=d.id, market_drop=d.market_drop, plan=d.plan, scenarios_version=d.scenarios_version, created_at=d.created_at
    )


@router.get("", response_model=StormDrillsOut)
def list_drills(db: Session = Depends(get_db)) -> StormDrillsOut:
    """Your written drills, newest first. Demo mode shows none: the sample fortress has no drills of yours."""
    if is_demo_mode(db):
        return StormDrillsOut(drills=[], demo=True)
    rows = db.scalars(select(StormDrill).order_by(StormDrill.created_at.desc())).all()
    return StormDrillsOut(drills=[_out(r) for r in rows])


@router.post("", response_model=StormDrillOut, status_code=201)
def create_drill(payload: StormDrillCreate, db: Session = Depends(get_db)) -> StormDrillOut:
    require_not_demo(db)
    scenarios = get_siege_scenarios(get_settings().active_siege_scenarios_version)
    if not (scenarios.drop_min <= payload.market_drop <= scenarios.drop_max):
        raise HTTPException(
            status_code=422,
            detail=f"market_drop must be between {scenarios.drop_min} and {scenarios.drop_max} (a fraction).",
        )
    plan = payload.plan.strip()
    if not plan:
        raise HTTPException(status_code=422, detail="plan must not be blank")
    drill = StormDrill(market_drop=payload.market_drop, plan=plan, scenarios_version=scenarios.version)
    db.add(drill)
    db.commit()
    db.refresh(drill)
    return _out(drill)
