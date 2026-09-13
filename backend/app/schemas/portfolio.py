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


class PortfolioSnapshotSummary(BaseModel):
    id: UUID
    uploaded_at: datetime
    source_file_id: UUID
    reporting_currency: str
    status: str
    position_count: int


class PortfolioSnapshotDetail(PortfolioSnapshotSummary):
    positions: list[PortfolioPositionOut]


class PortfolioUploadResponse(BaseModel):
    snapshot: PortfolioSnapshotDetail
    warnings: list[str]
    was_duplicate_file: bool


class RowError(BaseModel):
    row: int
    message: str
