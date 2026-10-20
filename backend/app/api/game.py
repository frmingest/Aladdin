"""Game mode API (2026-10-01, docs/game/game-mode-fortress-2026-10-01.md).

Read-only endpoints. It is a pure view over stored data: no provider call,
no LLM, no write. With demo mode on, the fabricated demo state is returned
and the real database path never runs (same rule as every other protected
read).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.game_mapping import get_game_mapping
from app.domain.game_mapping import printer_v1 as printer_table
from app.domain.game_mapping.backtest_v1 import get_backtest_rules
from app.domain.game_mapping.calibration_v1 import get_calibration_rules
from app.domain.game_mapping.rituals_v1 import get_rituals
from app.domain.game_mapping.siege_scenarios_v1 import get_siege_scenarios
from app.domain.game_mapping.time_and_filings_v1 import get_time_and_filings
from app.schemas.game import (
    CalibrationBandOut,
    CalibrationCallsOut,
    CalibrationOracleOut,
    CalibrationOut,
    GameStateOut,
    HoldingAdvisorsOut,
    NightWatchOut,
    RavensOut,
    RecordsOut,
    SiegeBacktestOut,
    SiegeSimOut,
)
from app.schemas.printer import PrinterLedgerOut, PrinterOut
from app.services.game import calibration as calibration_svc
from app.services.game import printer as printer_engine
from app.services.game import printer_view
from app.services.game import rituals as rituals_svc
from app.services.game.backtest_view import (
    build_backtest,
    demo_backtest,
    stored_backtest_inputs,
)
from app.services.game.demo import (
    DEMO_BETAS,
    demo_game_state,
    demo_night_watch,
    demo_ravens,
)
from app.services.game.night_watch import get_night_watch
from app.services.game.ravens import build_ravens
from app.services.game.ritual_inputs import (
    demo_journal_entries,
    journal_entries,
)
from app.services.game.sensitivity import METHOD_DEMO, Sensitivity
from app.services.game.siege_view import build_siege_sim, stored_sensitivity_lookup
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
    benchmark: Literal["local", "global"] = Query(
        default="local",
        description="Yardstick for 'the market' (scenarios v4+): 'local' is Oslo (OSEBX), 'global' is the World stand-in fund.",
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
    try:
        scenarios = scenarios.with_benchmark(benchmark)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
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


@router.get("/printer/ledger", response_model=PrinterLedgerOut)
def get_printer_ledger() -> PrinterLedgerOut:
    """The Printer's Ledger of Truth: every lever, every assumption with its source, date and confidence.
    A fixed table; no database, no provider, no LLM."""
    return printer_view.ledger()


@router.get("/printer", response_model=PrinterOut)
def get_printer(
    pull: list[str] = Query(
        default=[],
        description="A lever pull as 'lever:size' or 'lever:size:variant', repeatable, e.g. pull=toll_gate:1&pull=great_press:2.",
    ),
    horizon: int = Query(default=1, description="Years: 1 or 3."),
    db: Session = Depends(get_db),
) -> PrinterOut:
    """The Printer (Royal Mint): what the pulled central-bank levers would do to each holding, as ranges with a
    confidence tag (Low = direction only). A scenario over stored data: no provider call, no LLM, no write."""
    pulls: list[printer_engine.Pull] = []
    for raw in pull:
        parts = raw.split(":")
        if len(parts) not in (2, 3):
            raise HTTPException(status_code=422, detail=f"pull '{raw}' must look like lever:size or lever:size:variant")
        try:
            size = Decimal(parts[1])
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"pull '{raw}' has a size that is not a number") from exc
        variant = parts[2] if len(parts) == 3 else ""
        if not variant:
            lever = printer_table.LEVERS.get(parts[0])
            variant = printer_table.DEFAULT_VARIANT if lever is None or printer_table.DEFAULT_VARIANT in lever.variants else next(iter(lever.variants))
        pulls.append(printer_engine.Pull(parts[0], size, variant))
    try:
        printer_engine.validate_pulls(pulls)
        if horizon not in printer_table.HORIZONS:
            raise ValueError("horizon must be 1 or 3 (years)")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    mapping = get_game_mapping(get_settings().active_game_mapping_version)
    scenarios = get_siege_scenarios(get_settings().active_siege_scenarios_version)
    if is_demo_mode(db):
        state = demo_game_state(mapping.version)
        demo_lookup = lambda ticker: Sensitivity(DEMO_BETAS.get(ticker), METHOD_DEMO)
        return printer_view.build_printer(state, demo_lookup, pulls, horizon)
    state = get_game_state(db, mapping.version)
    return printer_view.build_printer(state, stored_sensitivity_lookup(db, scenarios), pulls, horizon)


@router.get("/siege/backtest", response_model=SiegeBacktestOut)
def get_siege_backtest(db: Session = Depends(get_db)) -> SiegeBacktestOut:
    """Siege back-test (C1): the benchmark's worst fall inside the stored price
    history, with what the Siege method would have said about each holding
    beside what it really did, and a constant-weight replay of the book. A
    check on the page, over stored data only: no provider call, no LLM, no
    write."""
    settings = get_settings()
    mapping = get_game_mapping(settings.active_game_mapping_version)
    scenarios = get_siege_scenarios(settings.active_siege_scenarios_version)
    rules = get_backtest_rules(settings.active_siege_backtest_version)
    if is_demo_mode(db):
        return demo_backtest(demo_game_state(mapping.version), scenarios, rules)
    state = get_game_state(db, mapping.version)
    bench, holdings = stored_backtest_inputs(db, state, scenarios)
    return build_backtest(state, bench, holdings, scenarios, rules)


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
    a score: no ranking. (The n-gated hit rate lives at /game/calibration.)"""
    rules = get_rituals(get_settings().active_rituals_version)
    state, demo = _state_for(db)
    entries = demo_journal_entries() if demo else journal_entries(db)
    return rituals_svc.build_records(entries, state, rules, demo=demo)


CALIBRATION_CAPTION = (
    "A count of how past calls and analyst ranges turned out, not a grade. "
    "It changes no verdict and no tower."
)


@router.get("/calibration", response_model=CalibrationOut)
def get_calibration(db: Session = Depends(get_db)) -> CalibrationOut:
    """C2 calibration ledger (hit rate, n-gated). Counts only; ratios appear
    once there are enough outcomes; read-only; demo mode shows none of the
    real rows."""
    rules = get_calibration_rules(get_settings().active_calibration_version)
    demo = is_demo_mode(db)
    if demo:
        calls = calibration_svc.build_calls([], rules)
        oracle = calibration_svc.build_oracle([], rules)
    else:
        calls, oracle = calibration_svc.get_calibration(db, rules)
    return CalibrationOut(
        version=rules.version,
        demo=demo,
        min_n=rules.min_n,
        min_band_n=rules.min_band_n,
        calls=CalibrationCallsOut(
            n=calls.n,
            is_open=calls.is_open,
            as_expected=calls.as_expected,
            against=calls.against,
            flat=calls.flat,
            bands=[CalibrationBandOut(**vars(b)) for b in calls.bands],
            waiting=calls.waiting,
            left_out=calls.left_out,
        ),
        oracle=CalibrationOracleOut(**vars(oracle)),
        caption=CALIBRATION_CAPTION,
    )


