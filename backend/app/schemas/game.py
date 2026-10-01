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
SiegeLevel = Literal["calm", "gathering", "besieged", "unsurveyed"]
SiegeExposure = Literal["sheltered", "exposed", "breach_risk", "unsurveyed"]
LandState = Literal["bargain", "discount", "full_price", "overpriced", "fog"]
ThesisState = Literal["intact", "review", "breached", "not_analyzed", "not_applicable"]


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
    # G4. Defaults keep the shape backward compatible for older callers.
    land: LandState = "fog"
    land_reason: str = "no stored margin-of-safety result for this holding"
    margin_of_safety_pct: Decimal | None = None
    thesis: ThesisState = "not_analyzed"
    tripwires_fired: int = 0
    siege_exposure: SiegeExposure = "unsurveyed"
    siege_shock_pct: Decimal | None = None
    siege_method: str | None = None
    shared_wall_with: list[str] = Field(default_factory=list)


class DiworsificationOut(BaseModel):
    position_count: int
    shack_count: int
    shantytown: Shantytown
    hhi: Decimal | None
    effective_holdings: Decimal | None
    top1_pct: Decimal | None
    top5_pct: Decimal | None


class VaultAccountOut(BaseModel):
    """One account's hand-entered cash, for the Vault's entry screen (G5)."""

    account_id: UUID | None
    name: str
    cash_nok: Decimal | None
    cash_as_of: datetime | None
    # True when the figure was entered longer ago than the mapping's cash limit.
    stale: bool = False


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
    # G5: per-account figures (so the entry screen needs no second call) and a
    # flag for any figure older than the mapping's cash limit.
    accounts: list[VaultAccountOut] = Field(default_factory=list)
    cash_stale: bool = False


class SharedWallOut(BaseModel):
    names: list[str]
    tickers: list[str]
    correlation: Decimal
    combined_weight_pct: Decimal


class SiegeOut(BaseModel):
    """The weather over the realm: macro regime plus the stored stress
    scenario. A stored view, never a live read and never a forecast."""

    level: SiegeLevel
    reasons: list[str]
    regime: str | None
    regime_explanation: str | None
    portfolio_shock_pct: Decimal | None
    portfolio_drawdown_nok: Decimal | None
    risk_snapshot_at: datetime | None
    risk_snapshot_age_days: int | None
    risk_snapshot_stale: bool
    # When the margin-of-safety prices behind "land for sale" were stored.
    land_snapshot_at: datetime | None
    land_snapshot_age_days: int | None
    land_snapshot_stale: bool
    shared_walls: list[SharedWallOut]
    breached_count: int


class GameStateOut(BaseModel):
    mapping_version: str
    as_of: datetime | None
    demo: bool = False
    total_value_nok: Decimal
    towers: list[TowerOut]
    diworsification: DiworsificationOut
    vault: VaultOut
    siege: SiegeOut | None = None
    # Plain-language data gaps ("3 holdings have no analysis"), so an
    # unfinished fortress is labelled as unfinished.
    notes: list[str]
