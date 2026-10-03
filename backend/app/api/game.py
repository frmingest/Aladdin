"""Game mode API (2026-10-01, docs/game-mode-fortress-2026-10-01.md).

Read-only endpoints. It is a pure view over stored data: no provider call,
no LLM, no write. With demo mode on, the fabricated demo state is returned
and the real database path never runs (same rule as every other protected
read).
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.game_mapping import get_game_mapping
from app.domain.game_mapping.siege_scenarios_v1 import get_siege_scenarios
from app.schemas.game import GameStateOut, SiegeSimOut
from app.services.game.demo import DEMO_BETAS, demo_game_state
from app.services.game.siege_view import build_siege_sim, stored_beta_lookup
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


@router.get("/siege", response_model=SiegeSimOut)
def get_siege(
    market_drop: Decimal | None = Query(
        default=None, description="Market fall as a fraction (0.30 = 30%). Default and range come from the versioned scenarios file."
    ),
    db: Session = Depends(get_db),
) -> SiegeSimOut:
    """Siege Simulator (G13): a chosen market fall pushed through each
    holding's stored beta. A what-if over stored data: no provider call, no
    LLM, no write. Holdings with no stored beta are listed as not modelled."""
    settings = get_settings()
    mapping = get_game_mapping(settings.active_game_mapping_version)
    scenarios = get_siege_scenarios(settings.active_siege_scenarios_version)
    drop = scenarios.drop_default if market_drop is None else market_drop
    if not (scenarios.drop_min <= drop <= scenarios.drop_max):
        raise HTTPException(
            status_code=422,
            detail=f"market_drop must be between {scenarios.drop_min} and {scenarios.drop_max} (a fraction).",
        )
    if is_demo_mode(db):
        state = demo_game_state(mapping.version)
        lookup = lambda ticker: (DEMO_BETAS.get(ticker), None)
        return build_siege_sim(state, lookup, drop, mapping, scenarios)
    state = get_game_state(db, mapping.version)
    return build_siege_sim(state, stored_beta_lookup(db), drop, mapping, scenarios)
