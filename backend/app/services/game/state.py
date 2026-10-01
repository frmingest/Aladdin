"""Game state: the fortress view of the stored portfolio (game mode, G1).

Two steps, so the rules stay testable without a database:

1. `gather_game_inputs(db)` reads what the app already stored: the portfolio
   overview (positions, weights, latest analysis ratings), the latest
   filing facts per stock, per-account cash and physical-coin ounces.
   Database only. It never calls a market-data provider, a research
   provider or an LLM, so it is as fast as the Dashboard.
2. `build_game_state(inputs, mapping)` is a pure function over those inputs.

Game mode is a view. Nothing here writes anything or changes an analysis.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.game_mapping import get_game_mapping
from app.domain.game_mapping.value_types import GameMapping
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES, STOCK
from app.domain.sectors import is_financial_sector
from app.models.account import Account
from app.schemas.game import (
    DiworsificationOut,
    GameStateOut,
    TowerOut,
    VaultOut,
)
from app.services import metrics as metrics_service
from app.services.game import rules
from app.services.game.rules import WallFacts
from app.services.holding_facts import facts_by_period, latest_period, previous_period
from app.services.portfolio_overview import build_overview
from app.services.precious_metals.holdings import list_holdings

ZERO = Decimal(0)


@dataclass
class AccountCash:
    cash_nok: Decimal | None
    cash_as_of: datetime | None


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
        AccountCash(cash_nok=a.cash_nok, cash_as_of=a.cash_as_of)
        for a in db.scalars(select(Account).order_by(Account.name))
    ]
    gold = silver = ZERO
    for coin in list_holdings(db):
        if coin.metal == "gold":
            gold += coin.quantity
        elif coin.metal == "silver":
            silver += coin.quantity
    return GameInputs(overview=overview, wall_facts=wall_facts, accounts=accounts, gold_oz=gold, silver_oz=silver)


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
    vault = VaultOut(
        level=vault_state,
        cash_nok=cash_nok,
        cash_share_pct=share,
        accounts_total=len(inputs.accounts),
        accounts_with_cash=len(with_cash),
        cash_oldest_as_of=min(as_ofs) if as_ofs else None,
        gold_oz=inputs.gold_oz,
        silver_oz=inputs.silver_oz,
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
    if inputs.gold_oz or inputs.silver_oz:
        notes.append("Physical coins are shown in ounces; they are not valued in this view.")

    return GameStateOut(
        mapping_version=mapping.version,
        as_of=overview.as_of,
        demo=inputs.demo,
        total_value_nok=overview.total_value_nok,
        towers=towers,
        diworsification=diworsification,
        vault=vault,
        notes=notes,
    )


def get_game_state(db: Session, version: str, *, now: datetime | None = None) -> GameStateOut:
    mapping = get_game_mapping(version)
    return build_game_state(gather_game_inputs(db, now=now), mapping, now=now)
