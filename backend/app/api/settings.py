"""App settings endpoints: the demo-mode toggle (2026-09-26), the
whole-app analyst mode (Epic F22, story 22.1) and the synthesis switch
(story 22.8). See app/services/settings/.

Two endpoints are deliberately NOT guarded by `require_not_demo`:
- PUT /settings/demo-mode, or Faiz could never turn demo mode back off;
- PUT /settings/analyst-mode, because switching the view between
  Buffett/Munger, Dalio and side-by-side writes no portfolio data and demo
  mode is meant to show all three modes (story 22.12).
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.analyst_modes import DALIO_VERDICT_BASIS, MODE_LABELS
from app.services.settings.analyst_mode import (
    get_analyst_mode,
    is_synthesis_enabled,
    set_analyst_mode,
    set_synthesis_enabled,
)
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode, set_demo_mode

router = APIRouter(prefix="/settings", tags=["settings"])

AnalystModeValue = Literal["buffett_munger", "dalio", "side_by_side"]


class DemoModeOut(BaseModel):
    demo_mode: bool


class DemoModeIn(BaseModel):
    enabled: bool


class AnalystModeOut(BaseModel):
    mode: AnalystModeValue
    label: str
    synthesis_enabled: bool
    dalio_verdict_basis: str


class AnalystModeIn(BaseModel):
    mode: AnalystModeValue


class SynthesisSettingIn(BaseModel):
    enabled: bool


@router.get("/demo-mode", response_model=DemoModeOut)
def get_demo_mode(db: Session = Depends(get_db)) -> DemoModeOut:
    return DemoModeOut(demo_mode=is_demo_mode(db))


@router.put("/demo-mode", response_model=DemoModeOut)
def put_demo_mode(payload: DemoModeIn, db: Session = Depends(get_db)) -> DemoModeOut:
    set_demo_mode(db, payload.enabled)
    return DemoModeOut(demo_mode=is_demo_mode(db))


def _analyst_mode_out(db: Session) -> AnalystModeOut:
    mode = get_analyst_mode(db)
    return AnalystModeOut(
        mode=mode,  # type: ignore[arg-type]
        label=MODE_LABELS[mode],
        synthesis_enabled=is_synthesis_enabled(db),
        dalio_verdict_basis=DALIO_VERDICT_BASIS,
    )


@router.get("/analyst-mode", response_model=AnalystModeOut)
def get_analyst_mode_endpoint(db: Session = Depends(get_db)) -> AnalystModeOut:
    return _analyst_mode_out(db)


@router.put("/analyst-mode", response_model=AnalystModeOut)
def put_analyst_mode(payload: AnalystModeIn, db: Session = Depends(get_db)) -> AnalystModeOut:
    set_analyst_mode(db, payload.mode)
    return _analyst_mode_out(db)


@router.put("/analyst-synthesis", response_model=AnalystModeOut)
def put_analyst_synthesis(payload: SynthesisSettingIn, db: Session = Depends(get_db)) -> AnalystModeOut:
    require_not_demo(db)
    set_synthesis_enabled(db, payload.enabled)
    return _analyst_mode_out(db)
