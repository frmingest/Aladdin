"""Pydantic schemas for The Printer (game mode, Royal Mint, 2026-10-20)."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PrinterRangeOut(BaseModel):
    low: Decimal
    base: Decimal
    high: Decimal


class PrinterSourceOut(BaseModel):
    key: str
    title: str
    url: str
    checked: str
    says: str


class PrinterEffectOut(BaseModel):
    channel: str
    horizon: int
    low: Decimal
    base: Decimal
    high: Decimal
    confidence: str
    source: str
    basis: str


class PrinterLeverOut(BaseModel):
    key: str
    name: str
    real_tool: str
    tide: str
    unit_label: str
    size_min: Decimal
    size_max: Decimal
    size_default: Decimal
    variants: list[str]


class PrinterLedgerOut(BaseModel):
    """The Ledger of Truth: every assumption, its source, its date and how sure we are."""

    version: str
    banner: str
    levers: list[PrinterLeverOut]
    effects: dict[str, dict[str, list[PrinterEffectOut]]]  # lever -> variant -> cells
    sources: list[PrinterSourceOut]


class PrinterContributionOut(BaseModel):
    lever: str
    range: PrinterRangeOut
    confidence: str
    source: str
    basis: str


class PrinterChannelOut(BaseModel):
    channel: str
    range: PrinterRangeOut
    confidence: str
    capped: bool
    cancelling: bool
    contributions: list[PrinterContributionOut]


class PrinterTermOut(BaseModel):
    channel: str
    coefficient: Decimal
    pct: PrinterRangeOut
    confidence: str


class PrinterHoldingOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    sector: str | None
    value_nok: Decimal | None
    status: str  # modelled | not_modelled
    reason: str | None = None
    confidence: str | None = None
    # Whole percent, widest-safe rounding. Always present when modelled.
    pct: PrinterRangeOut | None = None
    real_pct: PrinterRangeOut | None = None
    # NOK ranges exist only when confidence is not Low.
    show_amount: bool = False
    nok: PrinterRangeOut | None = None
    real_nok: PrinterRangeOut | None = None
    direction: str = "unclear"
    real_direction: str = "unclear"
    why: str = ""
    terms: list[PrinterTermOut] = Field(default_factory=list)


class PrinterOut(BaseModel):
    version: str
    banner: str
    demo: bool
    horizon: int
    pulls: list[dict[str, str]]
    channels: list[PrinterChannelOut]
    holdings: list[PrinterHoldingOut]
    portfolio_confidence: str | None
    portfolio_pct: PrinterRangeOut | None
    portfolio_real_pct: PrinterRangeOut | None
    show_portfolio_amount: bool
    portfolio_nok: PrinterRangeOut | None
    portfolio_real_nok: PrinterRangeOut | None
    portfolio_direction: str
    covered_value_nok: Decimal
    total_value_nok: Decimal
    coverage: Decimal | None
    wild: bool
    warnings: list[str]
    notes: list[str]
