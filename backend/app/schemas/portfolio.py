from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HoldingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticker: str
    name: str
    asset_class: str
    sector: str | None
    trading_currency: str
    market_ticker: str | None


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
