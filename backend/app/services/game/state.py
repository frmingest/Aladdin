"""Game state: the fortress view of the stored portfolio (game mode, G1).

Two steps, so the rules stay testable without a database:

1. `gather_game_inputs(db)` reads what the app already stored: the portfolio
   overview (positions, weights, latest analysis ratings), the latest
   filing facts per stock, per-account cash and physical-coin ounces.
   Database only. It never calls a market-data provider, a research
   provider or an LLM, so it is as fast as the Dashboard.
2. `build_game_state(inputs, mapping)` is a pure function over those inputs.

G4 adds three stored-data layers on the same rule: the stored portfolio-risk
snapshot (sieges, shared weak walls), the stored margin-of-safety snapshot
(land for sale) and the thesis monitor (tripwire breaches). The snapshots are
read as they were last stored and labelled with their age; if one was never
stored the layer is fog and a note says how to create it. Nothing is rebuilt
here, so this endpoint still makes no provider or LLM call.

Game mode is a view. Nothing here writes anything or changes an analysis.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, TypeVar

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.game_mapping import get_game_mapping
from app.domain.game_mapping.value_types import GameMapping
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES, STOCK
from app.domain.sectors import is_financial_sector
from app.models.account import Account
from app.models.snapshot import ComputedSnapshot
from app.schemas.game import (
    DiworsificationOut,
    GameStateOut,
    SharedWallOut,
    SiegeOut,
    TowerOut,
    VaultAccountOut,
    VaultOut,
)
from app.schemas.risk import PortfolioRiskOut
from app.schemas.valuation import MarginOfSafetyBoardOut
from app.services import metrics as metrics_service
from app.services.game import rules
from app.services.game.rules import ClusterFact, LandFacts, RiskFacts, ThesisFacts, WallFacts
from app.services.holding_facts import facts_by_period, latest_period, previous_period
from app.services.portfolio_overview import build_overview
from app.services.precious_metals.holdings import list_holdings
from app.services.snapshots import BOARD_KEY, RISK_KEY
from app.services.thesis.monitor import build_monitor

ZERO = Decimal(0)
log = logging.getLogger("aladdin.game")

M = TypeVar("M", bound=BaseModel)


@dataclass
class AccountCash:
    cash_nok: Decimal | None
    cash_as_of: datetime | None
    account_id: uuid.UUID | None = None
    name: str = ""


@dataclass
class GameInputs:
    # An `Overview` (app/services/portfolio_overview.py) or anything with the
    # same attributes (the demo uses the API schema, which matches).
    overview: Any
    wall_facts: dict[uuid.UUID, WallFacts] = field(default_factory=dict)
    accounts: list[AccountCash] = field(default_factory=list)
    gold_oz: Decimal = ZERO
    silver_oz: Decimal = ZERO
    demo: bool = False
    # G4: None / empty = the layer was never stored or never computed.
    risk: RiskFacts | None = None
    land: dict[uuid.UUID, LandFacts] = field(default_factory=dict)
    land_snapshot_at: datetime | None = None
    thesis: dict[uuid.UUID, ThesisFacts] = field(default_factory=dict)


def _wall_facts_for(db: Session, holding_id: uuid.UUID) -> WallFacts | None:
    periods = facts_by_period(db, holding_id)
    latest = latest_period(periods)
    if latest is None:
        return None
    prior = previous_period(periods, latest.period)
    result = metrics_service.compute_holding_metrics(
        latest.facts, latest.currencies, prior_facts=prior.facts if prior else None
    )
    missing = result.warnings[0] if result.warnings else None
    if missing is None:
        missing = result.skipped.get("net_debt") or result.skipped.get("net_debt_to_ebitda")
    facts = latest.facts
    ebitda = facts.get("ebitda")
    if ebitda is None and "ebit" in facts and "depreciation_and_amortization" in facts:
        ebitda = facts["ebit"] + facts["depreciation_and_amortization"]
    if ebitda is None and "operating_income" in facts and "depreciation_and_amortization" in facts:
        ebitda = facts["operating_income"] + facts["depreciation_and_amortization"]
    return WallFacts(
        period=latest.period,
        net_debt=result.computed.get("net_debt"),
        ebitda=ebitda,
        net_debt_to_ebitda=result.computed.get("net_debt_to_ebitda"),
        interest_coverage=result.computed.get("interest_coverage"),
        total_equity=facts.get("total_equity"),
        total_assets=facts.get("total_assets"),
        missing_reason=missing,
    )


def _stored_snapshot(db: Session, key: str, model_cls: type[M]) -> tuple[M | None, datetime | None]:
    """The last stored payload for `key` exactly as it was saved, plus when.

    Deliberately ignores the fingerprint and the max-age rule that the
    snapshot-serving endpoints use: this view never rebuilds anything, it
    shows what is stored and labels how old it is.
    """
    try:
        row = db.get(ComputedSnapshot, key)
        if row is None:
            return None, None
        return model_cls.model_validate_json(row.payload), row.computed_at
    except Exception:
        db.rollback()
        log.warning("stored snapshot %s unreadable for game state", key, exc_info=True)
        return None, None


def risk_facts_from(risk: PortfolioRiskOut, snapshot_at: datetime | None) -> RiskFacts:
    holding_shocks: dict[uuid.UUID, tuple[Decimal | None, str]] = {}
    for h in risk.stress.holdings:
        try:
            holding_shocks[uuid.UUID(str(h.holding_id))] = (h.shock_pct, h.method)
        except ValueError:
            continue
    return RiskFacts(
        regime=risk.regime.regime,
        regime_explanation=risk.regime.explanation,
        regime_data_complete=risk.regime.data_complete,
        portfolio_shock_pct=risk.stress.portfolio_shock_pct,
        portfolio_drawdown_nok=risk.stress.portfolio_drawdown_nok,
        snapshot_at=snapshot_at,
        holding_shocks=holding_shocks,
        clusters=[
            ClusterFact(
                tickers=list(c.tickers), names=list(c.names),
                correlation=c.correlation, combined_weight_pct=c.combined_weight_pct,
            )
            for c in risk.clusters
        ],
    )


def land_facts_from(board: MarginOfSafetyBoardOut) -> dict[uuid.UUID, LandFacts]:
    return {
        r.holding_id: LandFacts(
            zone=r.zone,
            valuation_status=r.valuation_status,
            margin_of_safety_base=r.margin_of_safety_base,
            unavailable_reason=r.unavailable_reason,
        )
        for r in board.rows
    }


def gather_game_inputs(db: Session, *, now: datetime | None = None) -> GameInputs:
    now = now or datetime.now(timezone.utc)
    overview = build_overview(db, now=now)
    wall_facts: dict[uuid.UUID, WallFacts] = {}
    for position in overview.positions:
        if position.instrument_type == STOCK:
            found = _wall_facts_for(db, position.holding_id)
            if found is not None:
                wall_facts[position.holding_id] = found
    accounts = [
        AccountCash(cash_nok=a.cash_nok, cash_as_of=a.cash_as_of, account_id=a.id, name=a.name)
        for a in db.scalars(select(Account).order_by(Account.name))
    ]
    gold = silver = ZERO
    for coin in list_holdings(db):
        if coin.metal == "gold":
            gold += coin.quantity
        elif coin.metal == "silver":
            silver += coin.quantity
    risk_out, risk_at = _stored_snapshot(db, RISK_KEY, PortfolioRiskOut)
    board_out, board_at = _stored_snapshot(db, BOARD_KEY, MarginOfSafetyBoardOut)
    thesis = {
        row.holding_id: ThesisFacts(status=row.status, firing_count=row.firing_count)
        for row in build_monitor(db, now=now)
    }
    return GameInputs(
        overview=overview,
        wall_facts=wall_facts,
        accounts=accounts,
        gold_oz=gold,
        silver_oz=silver,
        risk=risk_facts_from(risk_out, risk_at) if risk_out is not None else None,
        land=land_facts_from(board_out) if board_out is not None else {},
        land_snapshot_at=board_at if board_out is not None else None,
        thesis=thesis,
    )


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def build_game_state(
    inputs: GameInputs, mapping: GameMapping, *, now: datetime | None = None
) -> GameStateOut:
    now = now or datetime.now(timezone.utc)
    overview = inputs.overview
    towers: list[TowerOut] = []
    unanalyzed = 0
    no_walls = 0

    for p in overview.positions:
        analyzable = p.instrument_type in EQUITY_ANALYZABLE_TYPES
        structure = rules.structure_for(p.instrument_type)
        moat = rules.moat_tier(p.moat_rating, analyzable=analyzable)
        fresh, age = rules.freshness(p.analyzed_at, now, mapping, analyzable=analyzable)
        if p.instrument_type == STOCK:
            wall, reason, wall_inputs = rules.wall_for_stock(
                inputs.wall_facts.get(p.holding_id),
                financial=is_financial_sector(p.sector),
                mapping=mapping,
            )
            if wall == "unsurveyed":
                no_walls += 1
        else:
            wall, reason = rules.wall_for_non_stock(p.instrument_type)
            wall_inputs = {}
        if analyzable and p.analyzed_at is None:
            unanalyzed += 1
        land, land_reason = rules.land_for_sale(inputs.land.get(p.holding_id))
        land_facts = inputs.land.get(p.holding_id)
        thesis, fired = rules.thesis_state(inputs.thesis.get(p.holding_id), analyzable=analyzable)
        stress = inputs.risk.holding_shocks.get(p.holding_id) if inputs.risk is not None else None
        shock = stress[0] if stress is not None else None
        clusters = inputs.risk.clusters if inputs.risk is not None else []
        towers.append(
            TowerOut(
                holding_id=p.holding_id,
                ticker=p.ticker,
                name=p.name,
                instrument_type=p.instrument_type,
                sector=p.sector,
                structure=structure,
                value_nok=p.value_nok,
                weight_pct=p.weight_pct,
                size_class=rules.size_class(p.weight_pct, mapping),
                moat=moat,
                wall=wall,
                wall_reason=reason,
                wall_inputs=wall_inputs,
                freshness=fresh,
                analysis_age_days=age,
                verdict_rating=p.verdict_rating,
                land=land,
                land_reason=land_reason,
                margin_of_safety_pct=(
                    land_facts.margin_of_safety_base * Decimal(100)
                    if land != "fog" and land_facts is not None and land_facts.margin_of_safety_base is not None
                    else None
                ),
                thesis=thesis,
                tripwires_fired=fired,
                siege_exposure=rules.siege_exposure(shock, mapping),
                siege_shock_pct=shock,
                siege_method=stress[1] if stress is not None and shock is not None else None,
                shared_wall_with=rules.shared_wall_partners(p.ticker, clusters),
            )
        )

    shacks, level = rules.shantytown([t.weight_pct for t in towers], mapping)
    concentration = overview.concentration
    diworsification = DiworsificationOut(
        position_count=len(towers),
        shack_count=shacks,
        shantytown=level,
        hhi=concentration.hhi,
        effective_holdings=concentration.effective_holdings,
        top1_pct=concentration.top1_pct,
        top5_pct=concentration.top5_pct,
    )

    with_cash = [a for a in inputs.accounts if a.cash_nok is not None]
    cash_nok = sum((a.cash_nok for a in with_cash), ZERO) if with_cash else None
    vault_state, share = rules.vault_level(cash_nok, overview.total_value_nok, mapping)
    as_ofs = [_aware(a.cash_as_of) for a in with_cash if a.cash_as_of is not None]
    vault_accounts = [
        VaultAccountOut(
            account_id=a.account_id,
            name=a.name,
            cash_nok=a.cash_nok,
            cash_as_of=a.cash_as_of,
            stale=rules.cash_is_stale(a.cash_nok, a.cash_as_of, now, mapping),
        )
        for a in inputs.accounts
    ]
    vault = VaultOut(
        level=vault_state,
        cash_nok=cash_nok,
        cash_share_pct=share,
        accounts_total=len(inputs.accounts),
        accounts_with_cash=len(with_cash),
        cash_oldest_as_of=min(as_ofs) if as_ofs else None,
        gold_oz=inputs.gold_oz,
        silver_oz=inputs.silver_oz,
        accounts=vault_accounts,
        cash_stale=any(a.stale for a in vault_accounts),
    )

    notes: list[str] = []
    if not towers:
        notes.append("No portfolio snapshot yet: the fortress has no towers.")
    if unanalyzed:
        notes.append(f"{unanalyzed} holding(s) have no analysis yet; their moat is unsurveyed.")
    if no_walls:
        notes.append(f"{no_walls} stock(s) have no usable balance-sheet facts; their walls are unsurveyed.")
    if inputs.accounts and len(with_cash) < len(inputs.accounts):
        notes.append(
            f"Cash entered for {len(with_cash)} of {len(inputs.accounts)} account(s); the vault is incomplete."
            if with_cash
            else "No cash entered on any account; the vault is unsurveyed."
        )
    if vault.cash_stale:
        notes.append(
            f"Some cash figures were entered more than {mapping.stale_cash_days} days ago; "
            "update them so the vault is not drawn from an old number."
        )
    if inputs.gold_oz or inputs.silver_oz:
        notes.append("Physical coins are shown in ounces; they are not valued in this view.")

    siege = _build_siege(inputs, towers, mapping, now)
    notes.extend(_siege_notes(inputs, siege, mapping))

    return GameStateOut(
        mapping_version=mapping.version,
        as_of=overview.as_of,
        demo=inputs.demo,
        total_value_nok=overview.total_value_nok,
        towers=towers,
        diworsification=diworsification,
        vault=vault,
        siege=siege,
        notes=notes,
    )


def _build_siege(inputs: GameInputs, towers: list[TowerOut], mapping: GameMapping, now: datetime) -> SiegeOut:
    risk = inputs.risk
    level, reasons = rules.siege_level(risk, mapping)
    risk_age = rules.snapshot_age_days(risk.snapshot_at if risk else None, now)
    land_age = rules.snapshot_age_days(inputs.land_snapshot_at, now)
    return SiegeOut(
        level=level,
        reasons=reasons,
        regime=risk.regime if risk else None,
        regime_explanation=risk.regime_explanation if risk else None,
        portfolio_shock_pct=risk.portfolio_shock_pct if risk else None,
        portfolio_drawdown_nok=risk.portfolio_drawdown_nok if risk else None,
        risk_snapshot_at=risk.snapshot_at if risk else None,
        risk_snapshot_age_days=risk_age,
        risk_snapshot_stale=risk_age is not None and risk_age > mapping.stored_snapshot_stale_days,
        land_snapshot_at=inputs.land_snapshot_at,
        land_snapshot_age_days=land_age,
        land_snapshot_stale=land_age is not None and land_age > mapping.stored_snapshot_stale_days,
        shared_walls=[
            SharedWallOut(
                names=c.names, tickers=c.tickers, correlation=c.correlation,
                combined_weight_pct=c.combined_weight_pct,
            )
            for c in (risk.clusters if risk else [])
        ],
        breached_count=sum(1 for t in towers if t.thesis == "breached"),
    )


def _siege_notes(inputs: GameInputs, siege: SiegeOut, mapping: GameMapping) -> list[str]:
    notes: list[str] = []
    if inputs.risk is None:
        notes.append("No stored portfolio-risk snapshot: open Portfolio risk once so sieges can be shown.")
    elif siege.risk_snapshot_stale:
        notes.append(
            f"The stored risk snapshot is {siege.risk_snapshot_age_days} days old; "
            "refresh Portfolio risk before trusting the siege picture."
        )
    if inputs.land_snapshot_at is None:
        notes.append("No stored margin-of-safety snapshot: open Margin of safety once so land prices can be shown.")
    elif siege.land_snapshot_stale:
        notes.append(
            f"The stored margin-of-safety prices are {siege.land_snapshot_age_days} days old; "
            "refresh Margin of safety before reading 'land for sale'."
        )
    if siege.breached_count:
        notes.append(f"{siege.breached_count} holding(s) have a tripwire that has fired.")
    return notes


def get_game_state(db: Session, version: str, *, now: datetime | None = None) -> GameStateOut:
    mapping = get_game_mapping(version)
    return build_game_state(gather_game_inputs(db, now=now), mapping, now=now)
