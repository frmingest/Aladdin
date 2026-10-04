"""Pydantic schemas for the game-mode API (app/api/game.py, 2026-10-01)."""
from __future__ import annotations

from datetime import date, datetime
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
TemperamentLevel = Literal["composed", "steady", "restless", "rash", "unsurveyed"]


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


class TemperamentEventOut(BaseModel):
    """One line of the temperament meter: which rule, when, on what, and why."""

    kind: Literal["drain", "restore"]
    rule: str
    on: date
    holding_name: str
    holding_id: UUID | None
    explanation: str
    source: Literal["journal", "snapshots"]
    entry_id: UUID | None = None


class TurnoverOut(BaseModel):
    """What changed between the two latest snapshots of one account. Shown as
    counts only: there is no fee or commission data to price it in kroner."""

    account_name: str
    from_at: datetime
    to_at: datetime
    positions_before: int
    positions_after: int
    added: int
    removed: int
    resized: int
    turnover_pct: Decimal | None


class TemperamentOut(BaseModel):
    """G6: a journal-driven reading of discipline, explainable line by line.
    Informational only: it never blocks or suggests a trade."""

    level: TemperamentLevel
    # Restoring events as a share of all judged events, 0-100. None when
    # nothing in the window met a rule.
    needle_pct: Decimal | None
    low_confidence: bool
    decisions_logged: int
    snapshot_comparisons: int
    drains: int
    restores: int
    window_days: int
    summary: str
    events: list[TemperamentEventOut]
    turnover: list[TurnoverOut]


class AdvisorLineOut(BaseModel):
    """One line from an advisor: hand-written text chosen by a fixed rule, with
    the stored facts that triggered it so every line can be checked."""

    advisor: Literal["oracle", "partner"]
    rule: str
    tone: Literal["warning", "note", "calm"]
    text: str
    holding_id: UUID | None = None
    holding_name: str | None = None
    facts: list[str] = Field(default_factory=list)


class AdvisorsOut(BaseModel):
    """G7b: the Oracle and the Partner. Rule-triggered, hand-written, never
    generated, and never a trade instruction. Informational only."""

    lines_version: str
    lines: list[AdvisorLineOut]
    # Lines that matched a rule but did not fit in the shown set (most urgent first).
    hidden_count: int = 0
    disclaimer: str


class GameStateOut(BaseModel):
    mapping_version: str
    as_of: datetime | None
    demo: bool = False
    total_value_nok: Decimal
    towers: list[TowerOut]
    diworsification: DiworsificationOut
    vault: VaultOut
    siege: SiegeOut | None = None
    temperament: TemperamentOut | None = None
    advisors: AdvisorsOut | None = None
    # Plain-language data gaps ("3 holdings have no analysis"), so an
    # unfinished fortress is labelled as unfinished.
    notes: list[str]


# --- G13: Siege Simulator (2026-10-03) ------------------------------------

SiegeSimExposure = Literal["sheltered", "exposed", "breach_risk", "unmodelled"]


class SiegeSimHoldingOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    structure: Structure
    size_class: SizeClass
    wall: WallMaterial
    value_nok: Decimal | None
    weight_pct: Decimal | None
    beta: Decimal | None
    beta_as_of: datetime | None
    modelled: bool
    shock_pct: Decimal | None
    loss_nok: Decimal | None
    exposure: SiegeSimExposure
    # The Fortress's own stored stress shock for the same holding, for comparison.
    stored_shock_pct: Decimal | None
    reason: str | None


class SiegeSimOut(BaseModel):
    """A what-if: one chosen market fall pushed through each holding's stored
    beta. Never a forecast, never a recommendation."""

    scenarios_version: str
    mapping_version: str
    demo: bool = False
    market_drop: Decimal
    drop_min: Decimal
    drop_max: Decimal
    drop_step: Decimal
    level: SiegeLevel
    level_reason: str
    portfolio_shock_pct: Decimal | None
    portfolio_loss_nok: Decimal | None
    covered_value_nok: Decimal
    total_value_nok: Decimal
    coverage: Decimal | None
    weighted_beta: Decimal | None
    gathering_line: Decimal
    besieged_line: Decimal
    drop_to_gathering: Decimal | None
    drop_to_besieged: Decimal | None
    reach_note_gathering: str
    reach_note_besieged: str
    counts: dict[str, int]
    oldest_beta_at: datetime | None
    holdings: list[SiegeSimHoldingOut]
    notes: list[str]


# --- Sprint 24 (2026-10-04): Chronicle (G14), Ravens (G15), Night Watch (G16) ---

ChronicleSource = Literal["stored", "positions_only"]
ChangeKind = Literal[
    "tower_added", "tower_removed", "tower_resized", "wall_changed", "moat_changed",
    "thesis_changed", "weather_changed",
]


class ChronicleTowerOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    structure: Structure
    size_class: SizeClass
    weight_pct: Decimal | None
    # In a positions-only frame these are "unsurveyed" / "fog" / "not_analyzed":
    # the walls of a day nobody stored cannot be rebuilt from old positions.
    wall: WallMaterial
    moat: MoatTier
    land: LandState
    thesis: ThesisState


class ChronicleFrameOut(BaseModel):
    day: date
    at: datetime
    source: ChronicleSource
    total_value_nok: Decimal | None
    weather: SiegeLevel
    towers: list[ChronicleTowerOut]


class ChronicleChangeOut(BaseModel):
    """One thing that differs between a frame and the one before it."""

    day: date
    kind: ChangeKind
    holding_id: UUID | None = None
    holding_name: str | None = None
    text: str


class ChronicleOut(BaseModel):
    rules_version: str
    demo: bool = False
    frames: list[ChronicleFrameOut]
    changes: list[ChronicleChangeOut]
    stored_frames: int
    positions_only_frames: int
    first_stored_day: date | None
    # Frames older than the newest `chronicle_max_frames` that were left out.
    hidden_frames: int = 0
    notes: list[str]


RavenDirectionOut = Literal["better", "worse", "steady", "unknown"]
RavenKindOut = Literal["figures", "text_only"]


class RavenLineOut(BaseModel):
    metric: str
    label: str
    previous: Decimal | None
    current: Decimal | None
    direction: RavenDirectionOut
    text: str


class RavenOut(BaseModel):
    id: str  # stable: a raven is "seen" per browser by this id
    kind: RavenKindOut
    holding_id: UUID
    ticker: str
    name: str
    in_portfolio: bool
    period: str | None
    previous_period: str | None
    captured_at: datetime
    age_days: int
    document_id: UUID | None
    summary: str
    better: int
    worse: int
    lines: list[RavenLineOut]


class RavensOut(BaseModel):
    rules_version: str
    demo: bool = False
    as_of: datetime
    window_days: int
    ravens: list[RavenOut]
    notes: list[str]


NightWatchState = Literal["ok", "old", "never"]
NightWatchTone = Literal["warning", "note", "calm"]
NightWatchStatus = Literal["attention", "quiet", "unknown"]


class NightWatchLineOut(BaseModel):
    tone: NightWatchTone
    text: str
    holding_id: UUID | None = None
    holding_name: str | None = None
    facts: list[str] = Field(default_factory=list)


class NightWatchFiredOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    label: str | None
    metric: str
    fired_at: datetime


class NightWatchOut(BaseModel):
    """The nightly tripwire check as a morning dispatch. A reading of what the
    worker stored overnight; it never runs a check and never advises a trade."""

    rules_version: str
    demo: bool = False
    as_of: datetime
    status: NightWatchStatus
    headline: str
    watch_state: NightWatchState
    watch_last_at: datetime | None
    watch_age_hours: int | None
    watch_summary: str | None
    tripwires_firing: int
    fired_overnight: list[NightWatchFiredOut]
    snapshots_last_at: datetime | None
    snapshots_summary: str | None
    frames_stored: int
    last_frame_day: date | None
    ravens_landed: int
    changes_since_last_frame: list[ChronicleChangeOut]
    lines: list[NightWatchLineOut]


# --- Sprint 25: rituals (G17 Council, G18 Records, G19 Circle, G20 holding lines) ---

CompetenceLevelOut = Literal["know", "partly", "outside"]
CompetenceStatus = Literal["inside", "edge", "outside", "unmarked", "unclassified", "not_applicable"]
AgendaKind = Literal[
    "tripwire", "thesis_review", "review_due", "weak_walls", "no_moat", "stale_analysis", "outside_circle", "cash"
]
RecordReviewState = Literal["written", "due", "not_due"]


class HoldingAdvisorsOut(BaseModel):
    """G20: every advisor line that matches one holding (not cut to the
    fortress-wide display limit)."""

    holding_id: UUID
    lines_version: str
    lines: list[AdvisorLineOut]
    disclaimer: str


class CouncilHoldingOut(BaseModel):
    holding_id: UUID | None
    name: str
    weight_pct: Decimal | None = None


class CouncilItemOut(BaseModel):
    kind: AgendaKind
    tone: Literal["warning", "note"]
    title: str
    text: str
    holdings: list[CouncilHoldingOut]
    more: int = 0  # holdings that matched but were not named
    facts: list[str] = Field(default_factory=list)


class CouncilOut(BaseModel):
    """G17: the quarterly review room. An agenda built from rules the Fortress
    already uses, plus what the advisors say. Read-only; attending earns
    nothing and an empty agenda is said plainly, never padded."""

    rules_version: str
    demo: bool = False
    as_of: datetime
    items: list[CouncilItemOut]
    advisors: list[AdvisorLineOut]
    unknowns: list[str]
    summary: str
    disclaimer: str


class RecordOut(BaseModel):
    id: UUID
    holding_id: UUID | None
    ticker: str
    company_name: str
    action: str
    decided_on: date
    days_since: int
    thesis: str
    invalidation: str | None
    confidence: int | None
    verdict_then: str | None
    verdict_now: str | None
    price_then: Decimal | None
    price_now: Decimal | None
    price_now_at: datetime | None
    currency: str | None
    price_change_pct: Decimal | None
    price_note: str | None
    review_6m: RecordReviewState
    review_12m: RecordReviewState
    review_6m_text: str | None
    review_12m_text: str | None


class RecordsOut(BaseModel):
    """G18: the decision journal as a library. Hindsight, not a score: there is
    no hit rate and no ranking, only what was written, what the price did and
    which reviews are still owed."""

    rules_version: str
    demo: bool = False
    records: list[RecordOut]
    reviews_due: int
    caption: str


class CompetenceHeldOut(BaseModel):
    holding_id: UUID
    name: str
    weight_pct: Decimal | None


class CompetenceSectorOut(BaseModel):
    sector: str
    level: CompetenceLevelOut | None
    note: str | None
    marked_at: datetime | None
    weight_pct: Decimal
    holdings: list[CompetenceHeldOut]


class CompetenceTowerOut(BaseModel):
    holding_id: UUID
    name: str
    sector: str | None
    weight_pct: Decimal | None
    status: CompetenceStatus


class CompetenceOut(BaseModel):
    """G19: the user's own marks of how well each sector is known, laid over
    the holdings. A mark is never inferred; no mark is *unmarked*, which is not
    the same as inside the circle."""

    rules_version: str
    demo: bool = False
    levels: list[str]
    sectors: list[CompetenceSectorOut]
    towers: list[CompetenceTowerOut]
    inside_weight_pct: Decimal
    edge_weight_pct: Decimal
    outside_weight_pct: Decimal
    unmarked_weight_pct: Decimal
    unclassified_weight_pct: Decimal
    summary: str
    note_max_chars: int


class CompetenceMarkIn(BaseModel):
    level: CompetenceLevelOut
    note: str | None = None
