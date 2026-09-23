"""System status (feature F4) — see app/services/system_status.py.

Configuration and database only: no provider is called from here, so
opening the status page never spends LLM quota. Secrets are reported as
"set"/"missing", never returned.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.providers.factory import get_primary_budget_guard
from app.schemas.system import SystemStatusOut
from app.services.system_status import build_system_status

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status", response_model=SystemStatusOut)
def get_system_status(db: Session = Depends(get_db)) -> SystemStatusOut:
    status = build_system_status(db, get_settings(), get_primary_budget_guard())
    return SystemStatusOut.model_validate(status, from_attributes=True)
