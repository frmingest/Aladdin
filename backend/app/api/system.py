"""System status (feature F4) — see app/services/system_status.py.

Configuration and database only: no provider is called from here, so
opening the status page never spends LLM quota. Secrets are reported as
"set"/"missing", never returned.

Demo mode (2026-09-26): the whole payload is replaced with a fabricated
one (app/services/settings/synthetic_data.py) — real config/version/
counts details aren't "portfolio data" but are still real facts about
this deployment, and the point of demo mode is that NOTHING real is
readable while it's on, so this errs on the side of hiding them too.
`demo_mode` is always set from the real flag either way, so the page can
show the banner correctly even when everything else is real.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.providers.factory import get_primary_budget_guard
from app.schemas.system import SystemStatusOut
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import demo_system_status
from app.services.system_status import build_system_status

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status", response_model=SystemStatusOut)
def get_system_status(db: Session = Depends(get_db)) -> SystemStatusOut:
    if is_demo_mode(db):
        return demo_system_status()
    status = build_system_status(db, get_settings(), get_primary_budget_guard())
    out = SystemStatusOut.model_validate(status, from_attributes=True)
    out.demo_mode = False
    return out
