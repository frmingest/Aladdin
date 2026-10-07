"""Game mode API (2026-10-01, docs/game-mode-fortress-2026-10-01.md).

Read-only endpoints. It is a pure view over stored data: no provider call,
no LLM, no write. With demo mode on, the fabricated demo state is returned
and the real database path never runs (same rule as every other protected
read).
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.game_mapping import get_game_mapping
from app.domain.game_mapping.rituals_v1 import get_rituals
from app.domain.game_mapping.siege_scenarios_v1 import get_siege_scenarios
from app.domain.game_mapping.time_and_filings_v1 import get_time_and_filings
from app.schemas.game import (
    ChronicleOut,
    CompetenceMarkIn,
    CompetenceOut,
    CouncilOut,
    GameStateOut,
    HoldingAdvisorsOut,
    NightWatchOut,
    RavensOut,
    RecordsOut,
    SiegeSimOut,
)
from app.services.game import competence as competence_svc
from app.services.game import rituals as rituals_svc
from app.services.game.chronicle import get_chronicle
from app.services.game.demo import (
    DEMO_BETAS,
    demo_chronicle,
    demo_game_state,
    demo_night_watch,
    demo_ravens,
)
from app.services.game.night_watch import get_night_watch
from app.services.game.ravens import build_ravens
from app.services.game.ritual_inputs import (
    demo_competence_marks,
    demo_journal_entries,
    journal_entries,
)
from app.services.game.sensitivity import METHOD_DEMO, Sensitivity
from app.services.game.siege_view import build_siege_sim, stored_sensitivity_lookup
from app.services.game.state import get_game_state
from app.services.settings.demo_guard import require_not_demo
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
    holding's beta (v2: measured from its stored price history against the
    benchmark, Yahoo's beta as a marked fallback). A what-if over stored data:
    no provider call, no LLM, no write. Holdings with no usable beta are
    listed as not modelled."""
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
        demo_lookup = lambda ticker: Sensitivity(DEMO_BETAS.get(ticker), METHOD_DEMO)
        return build_siege_sim(state, demo_lookup, drop, mapping, scenarios)
    state = get_game_state(db, mapping.version)
    return build_siege_sim(state, stored_sensitivity_lookup(db, scenarios), drop, mapping, scenarios)


@router.get("/chronicle", response_model=ChronicleOut)
def get_chronicle_route(db: Session = Depends(get_db)) -> ChronicleOut:
    """G14 The Chronicle: the fortress replayed through time. Frames stored by
    the worker each night (G14a) carry the real walls, moats and weather of
    their day; older days are rebuilt from portfolio imports with unsurveyed
    walls. A replay of stored data: no provider call, no LLM, no write."""
    settings = get_settings()
    rules_v = get_time_and_filings(settings.active_time_and_filings_version)
    if is_demo_mode(db):
        return demo_chronicle(settings.active_game_mapping_version, rules_v)
    mapping = get_game_mapping(settings.active_game_mapping_version)
    return get_chronicle(db, mapping, rules_v)


@router.get("/ravens", response_model=RavensOut)
def get_ravens(db: Session = Depends(get_db)) -> RavensOut:
    """G15 The Ravens: reports captured recently, each with what changed
    between the newest stored period and the one before it. Stored data
    only; information, never a verdict."""
    settings = get_settings()
    rules_v = get_time_and_filings(settings.active_time_and_filings_version)
    if is_demo_mode(db):
        return demo_ravens(settings.active_game_mapping_version, rules_v)
    return build_ravens(db, rules_v)


@router.get("/night-watch", response_model=NightWatchOut)
def get_night_watch_route(db: Session = Depends(get_db)) -> NightWatchOut:
    """G16 Night Watch: last night's tripwire check and what changed, as a
    morning dispatch. Reads what the worker stored; never runs the check."""
    settings = get_settings()
    rules_v = get_time_and_filings(settings.active_time_and_filings_version)
    if is_demo_mode(db):
        return demo_night_watch(settings.active_game_mapping_version, rules_v)
    return get_night_watch(db, rules_v)


# --- Sprint 25: rituals ---------------------------------------------------------


def _state_for(db: Session):
    version = get_settings().active_game_mapping_version
    if is_demo_mode(db):
        return demo_game_state(version), True
    return get_game_state(db, version), False


@router.get("/holdings/{holding_id}/advisors", response_model=HoldingAdvisorsOut)
def get_holding_advisors(holding_id: UUID, db: Session = Depends(get_db)) -> HoldingAdvisorsOut:
    """G20: every advisor line that is about one holding (the Fortress shows
    only the first few). Stored data only; never advice to trade."""
    state, _ = _state_for(db)
    return rituals_svc.holding_advisor_lines(state, holding_id)


@router.get("/records", response_model=RecordsOut)
def get_records(db: Session = Depends(get_db)) -> RecordsOut:
    """G18 Hall of Records: the decision journal as a library. Hindsight, not
    a score: no hit rate, no ranking."""
    rules = get_rituals(get_settings().active_rituals_version)
    state, demo = _state_for(db)
    entries = demo_journal_entries() if demo else journal_entries(db)
    return rituals_svc.build_records(entries, state, rules, demo=demo)


@router.get("/competence", response_model=CompetenceOut)
def get_competence(db: Session = Depends(get_db)) -> CompetenceOut:
    """G19 Circle of Competence: your own sector marks laid over the holdings.
    Marks are never inferred; unmarked is not inside."""
    rules = get_rituals(get_settings().active_rituals_version)
    state, demo = _state_for(db)
    if demo:
        marks = demo_competence_marks(datetime.now(timezone.utc))
        return competence_svc.build_competence(state.towers, marks, rules, demo=True)
    return competence_svc.get_competence(db, state.towers, rules)


@router.put("/competence/{sector}", response_model=CompetenceOut)
def put_competence(sector: str, payload: CompetenceMarkIn, db: Session = Depends(get_db)) -> CompetenceOut:
    """Set or change your mark for one sector (the only write of Sprint 25)."""
    require_not_demo(db)
    rules = get_rituals(get_settings().active_rituals_version)
    try:
        competence_svc.set_mark(db, sector, payload.level, payload.note, rules)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    state, _ = _state_for(db)
    return competence_svc.get_competence(db, state.towers, rules)


@router.delete("/competence/{sector}", response_model=CompetenceOut)
def delete_competence(sector: str, db: Session = Depends(get_db)) -> CompetenceOut:
    """Clear your mark for one sector (it becomes unmarked again)."""
    require_not_demo(db)
    rules = get_rituals(get_settings().active_rituals_version)
    competence_svc.clear_mark(db, sector)
    state, _ = _state_for(db)
    return competence_svc.get_competence(db, state.towers, rules)


@router.get("/council", response_model=CouncilOut)
def get_council(db: Session = Depends(get_db)) -> CouncilOut:
    """G17 Council Chamber: a quarterly review agenda built from the rules the
    Fortress already uses. Read-only; attending earns nothing."""
    rules = get_rituals(get_settings().active_rituals_version)
    state, demo = _state_for(db)
    entries = demo_journal_entries() if demo else journal_entries(db)
    records = rituals_svc.build_records(entries, state, rules, demo=demo)
    now = datetime.now(timezone.utc)
    if demo:
        circle = competence_svc.build_competence(state.towers, demo_competence_marks(now), rules, demo=True)
    else:
        circle = competence_svc.get_competence(db, state.towers, rules)
    return rituals_svc.build_council(state, records, circle, rules, now=now, demo=demo)
