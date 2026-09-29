"""App settings endpoints (2026-09-26) - currently just the demo-mode
toggle. See app/services/settings/demo_mode.py.

Deliberately NOT guarded by `require_not_demo`: this is the one endpoint
that must stay reachable while demo mode is on, or Faiz could never turn
it back off from the Settings page.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.services.settings.demo_mode import is_demo_mode, set_demo_mode

router = APIRouter(prefix="/settings", tags=["settings"])


class DemoModeOut(BaseModel):
    demo_mode: bool


class DemoModeIn(BaseModel):
    enabled: bool


@router.get("/demo-mode", response_model=DemoModeOut)
def get_demo_mode(db: Session = Depends(get_db)) -> DemoModeOut:
    return DemoModeOut(demo_mode=is_demo_mode(db))


@router.put("/demo-mode", response_model=DemoModeOut)
def put_demo_mode(payload: DemoModeIn, db: Session = Depends(get_db)) -> DemoModeOut:
    set_demo_mode(db, payload.enabled)
    return DemoModeOut(demo_mode=is_demo_mode(db))
