"""Pydantic schemas for the game-mode API (app/api/game.py, 2026-10-01)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Structure = Literal["keep", "outpost", "bullion", "granary"]
SizeClass = Literal["great", "medium", "small", "tiny", "unknown"]
MoatTier = Literal["wide", "narrow", "none", "unsurveyed", "not_applicable"]
WallMaterial = Literal["basalt", "granite", "brick", "timber", "rotted", "unsurveyed", "not_applicable"]
Freshness = Literal["fresh", "weathered", "overgrown", "unsurveyed", "not_applicable"]
Shantytown = Literal["none", "light", "heavy"]
VaultLevel = Literal["deep", "stocked", "thin", "empty", "unsurveyed"]


class TowerOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    instrument_type: str
    sector: str | None
    structure: Structure
    value_nok: Decimal | None
    weight_pct: Decimal | None
    size_class: SizeClass
    moat: MoatTier
    wall: WallMaterial
    wall_reason: str
    # The deterministic numbers the wall was decided from, so the Ledger
    # view can show them next to the picture.
    wall_inputs: dict[str, Decimal] = Field(default_factory=dict)
    freshness: Freshness
    analysis_age_days: int | None
    verdict_rating: str | None


class DiworsificationOut(BaseModel):
    position_count: int
    shack_count: int
    shantytown: Shantytown
    hhi: Decimal | None
    effective_holdings: Decimal | None
    top1_pct: Decimal | None
    top5_pct: Decimal | None


class VaultOut(BaseModel):
    level: VaultLevel
    cash_nok: Decimal | None
    cash_share_pct: Decimal | None
    accounts_total: int
    accounts_with_cash: int
    cash_oldest_as_of: datetime | None
    # Physical coins, in troy ounces. Not valued here: pricing them needs a
    # live spot-price call, which this endpoint never makes.
    gold_oz: Decimal
    silver_oz: Decimal


class GameStateOut(BaseModel):
    mapping_version: str
    as_of: datetime | None
    demo: bool = False
    total_value_nok: Decimal
    towers: list[TowerOut]
    diworsification: DiworsificationOut
    vault: VaultOut
    # Plain-language data gaps ("3 holdings have no analysis"), so an
    # unfinished fortress is labelled as unfinished.
    notes: list[str]
