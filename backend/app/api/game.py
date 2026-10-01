"""Game mode API (2026-10-01, docs/game-mode-fortress-2026-10-01.md).

One read-only endpoint. It is a pure view over stored data: no provider call,
no LLM, no write. With demo mode on, the fabricated demo state is returned
and the real database path never runs (same rule as every other protected
read).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.schemas.game import GameStateOut
from app.services.game.demo import demo_game_state
from app.services.game.state import get_game_state
from app.services.settings.demo_mode import is_demo_mode

router = APIRouter(prefix="/game", tags=["game"])


@router.get("/state", response_model=GameStateOut)
def get_state(db: Session = Depends(get_db)) -> GameStateOut:
    """The fortress: one tower per holding (moat, wall material, size,
    analysis freshness), the shantytown level, and the vault. Every value is
    computed by fixed rules from stored analysis and balance-sheet facts."""
    version = get_settings().active_game_mapping_version
    if is_demo_mode(db):
        return demo_game_state(version)
    return get_game_state(db, version)
