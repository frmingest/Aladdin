from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class HoldingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticker: str
    name: str
    asset_class: str
    sector: str | None
    trading_currency: str
    market_ticker: str | None
    # Phase 8 (ADR 0011) — "where it physically sits", e.g.
    # "allocated_physical" for a coin held outside brokerage custody. Free
    # text, nullable; unset for every ordinary brokerage holding.
    custody_type: str | None = None


class HoldingUpdate(BaseModel):
    """PATCH body for setting a holding's market-data symbol (§26 Phase 2).

    Only market_ticker is editable here — descriptive fields (name, sector,
    currency) are owned by the portfolio upload (see ingestion.py), not this
    endpoint, so there's one source of truth for each.
    """

    market_ticker: str | None = None


class PortfolioPositionOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    asset_class: str
    sector: str | None
    trading_currency: str
    weight_pct: Decimal | None
    quantity: Decimal | None
    cost_basis: Decimal | None
    cost_basis_currency: str | None
    notes: str | None
    # Which account this position was uploaded under (None = unassigned) —
    # see app.services.portfolio.ingestion for why the merge key includes
    # account, not just ticker.
    account_id: UUID | None
    account_name: str | None
    # Phase 8 (ADR 0011) — see PortfolioPosition.acquired_at. None for every
    # brokerage-sourced position.
    acquired_at: datetime | None = None


class ManualPositionCreate(BaseModel):
    """Body for POST /portfolio/holdings/manual (§26 Phase 8, ADR 0011) —
    a one-off, hand-entered lot for an alternative asset that doesn't come
    through a brokerage CSV/XLSX export: a physical gold/silver coin bought
    on its own date, or an item in a collection (e.g. a whisky bottle).

    Deliberately scoped to `asset_class in {COMMODITY, COLLECTIBLE}` (see
    app.services.portfolio.manual_entry) — an ordinary brokerage holding
    still goes through the existing upload endpoint, so there's exactly one
    entry path for each kind of holding.

    `ticker` is the same unique key Holding.ticker always is. Adding a
    second lot of a coin/bottle you already hold: reuse the same ticker —
    a new PortfolioPosition row is created under the existing Holding
    (each lot keeps its own quantity/cost_basis/acquired_at) rather than
    merging into one row, matching ADR 0011 (two purchases of the same
    instrument at different times/prices are two distinct positions).
    """

    ticker: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    asset_class: str  # "COMMODITY" | "COLLECTIBLE" — validated in the service
    trading_currency: str = Field(min_length=3, max_length=3)
    quantity: Decimal = Field(gt=0)
    cost_basis: Decimal | None = None
    cost_basis_currency: str | None = Field(default=None, min_length=3, max_length=3)
    # Hint for Phase 8's gold/silver pricing: "XAU" | "XAG" routes through
    # app.providers.gold_metal_provider. Left unset (None) for an asset with
    # no live pricing feed (e.g. a whisky bottle, per ADR 0011) — it then
    # carries at cost basis only, same as any other unpriced holding.
    market_ticker: str | None = None
    # "where it physically sits" — e.g. "allocated_physical" for bullion.
    custody_type: str | None = None
    acquired_at: datetime | None = None
    notes: str | None = None
    account_id: UUID | None = None


class ManualPositionUpdate(BaseModel):
    """Partial-update body for PATCH /portfolio/holdings/manual/{holding_id}
    — corrects a manually-entered coin/collectible lot after the fact (the
    classic case: "Holding currency" was changed but "Buy price currency"
    was left at its default, so the buy price got stored/converted in the
    wrong currency). Only fields present in the request are changed — omit
    everything else; see app.services.portfolio.manual_entry.update_manual_position.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    trading_currency: str | None = Field(default=None, min_length=3, max_length=3)
    quantity: Decimal | None = Field(default=None, gt=0)
    cost_basis: Decimal | None = None
    cost_basis_currency: str | None = Field(default=None, min_length=3, max_length=3)
    market_ticker: str | None = None
    custody_type: str | None = None
    acquired_at: datetime | None = None
    notes: str | None = None
    account_id: UUID | None = None


class PortfolioSnapshotSummary(BaseModel):
    id: UUID
    uploaded_at: datetime
    source_file_id: UUID
    reporting_currency: str
    status: str
    position_count: int
    account_id: UUID | None
    account_name: str | None


class PortfolioSnapshotDetail(PortfolioSnapshotSummary):
    positions: list[PortfolioPositionOut]


class PortfolioUploadResponse(BaseModel):
    snapshot: PortfolioSnapshotDetail
    warnings: list[str]
    was_duplicate_file: bool
    # How this upload's positions relate to the previous snapshot (uploads
    # merge on top of it by ticker rather than replacing it outright — see
    # app.services.portfolio.ingestion).
    new_position_count: int
    updated_position_count: int
    carried_forward_position_count: int


class PortfolioResetResponse(BaseModel):
    """Result of the irreversible full-reset (DELETE /portfolio/reset)."""

    holdings_deleted: int
    snapshots_deleted: int
    documents_deleted: int


class RowError(BaseModel):
    row: int
    message: str
