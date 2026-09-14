"""Valuation & scenario engine API schemas (architecture §17, §26 Phase 5)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

# --- ECON-001 fix (docs/decisions/0014) — discount-rate/FX suggestions ------


class DiscountRateSuggestionOut(BaseModel):
    available: bool
    currency: str
    config_version: str
    risk_free_pct: Decimal | None = None
    equity_risk_premium_pct: Decimal | None = None
    suggested_discount_rate_pct: Decimal | None = None
    risk_free_series_used: list[str] = Field(default_factory=list)
    macro_as_of: datetime | None = None
    reason: str | None = None


class FxRateSuggestionOut(BaseModel):
    available: bool
    from_currency: str
    to_currency: str
    rate: Decimal | None = None
    observed_at: datetime | None = None
    reason: str | None = None


class ValuationDefaultsOut(BaseModel):
    """A suggestion only — never silently applied (§21). The frontend shows
    these next to discount_rate_pct/fx_rate_to_reporting and lets the user
    click to accept, or ignore and type their own."""

    discount_rate: DiscountRateSuggestionOut
    fx_rate: FxRateSuggestionOut

# --- LLM structured-output contract (§17's "LLM critiques") ----------------


class ValuationCritiqueOutput(BaseModel):
    """The LLM's critique of a valuation case's *assumptions* — never a
    competing valuation number (deliberately no field for one; see
    prompts/valuation/v1.md rule 1)."""

    assumptions_reasonable: bool
    reasoning: str
    key_risks_to_assumptions: list[str] = Field(default_factory=list)
    highest_uncertainty_areas: list[str] = Field(default_factory=list)
    source_references: list[str] = Field(
        default_factory=list,
        description="evidence_id values (e.g. 'E1') this critique materially relies on",
    )


# --- API request/response schemas -------------------------------------------


class ValuationCaseCreate(BaseModel):
    case_type: str = Field(description="bull | base | bear")
    revenue_growth_pct: Decimal
    margin_pct: Decimal
    capex_pct_of_revenue: Decimal
    tax_rate_pct: Decimal
    discount_rate_pct: Decimal
    terminal_growth_pct: Decimal
    shares_outstanding: Decimal
    projection_years: int = 5
    commodity_price_multiplier: Decimal | None = None
    fx_rate_to_reporting: Decimal | None = None
    net_debt: Decimal | None = None
    base_revenue_override: Decimal | None = Field(
        default=None,
        description="Overrides the latest reported revenue financial fact as the DCF's starting "
        "point. Omit to use the holding's latest 'revenue' FinancialLineItem.",
    )
    currency: str | None = Field(
        default=None,
        description="Currency of calculated_value. Omit to use the revenue fact's own currency, "
        "falling back to the holding's trading_currency. Set explicitly (and pass "
        "fx_rate_to_reporting) when converting the result to a different currency.",
    )
    analysis_run_id: UUID | None = None
    run_critique: bool = Field(
        default=True,
        description="Best-effort LLM critique of the assumptions (§17). A failure here never "
        "blocks the deterministic calculated_value from being persisted — see critique_error.",
    )


class ValuationCaseOut(BaseModel):
    id: UUID
    holding_id: UUID
    analysis_run_id: UUID | None
    case_type: str
    assumptions: dict
    calculated_value: Decimal | None
    currency: str
    confidence: str
    calculation_note: str | None
    critique: ValuationCritiqueOutput | None
    critique_error: str | None
    created_at: datetime
