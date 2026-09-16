from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class HoldingValuationOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    asset_class: str
    sector: str | None
    trading_currency: str
    market_ticker: str | None
    quantity: Decimal | None
    uploaded_weight_pct: Decimal | None

    price: Decimal | None
    price_currency: str | None
    price_observed_at: datetime | None
    price_status: str

    market_value_trading_ccy: Decimal | None
    fx_rate_to_reporting: Decimal | None
    market_value_reporting_ccy: Decimal | None

    cost_basis_value_reporting_ccy: Decimal | None
    unrealized_pnl: Decimal | None
    unrealized_pnl_pct: Decimal | None

    computed_weight_pct: Decimal | None
    data_warning: str | None


class ConcentrationProfileOut(BaseModel):
    single_name_hhi: Decimal | None
    largest_single_name_pct: Decimal | None
    single_name_weights: dict[str, Decimal]
    sector_hhi: Decimal | None
    sector_weights: dict[str, Decimal]
    currency_weights: dict[str, Decimal]
    asset_class_weights: dict[str, Decimal]
    # Absolute market value per asset class, reporting currency — see
    # ConcentrationProfile.asset_class_values (app.services.market_data.valuation).
    asset_class_values: dict[str, Decimal]
    holdings_excluded_from_concentration: list[str]


class PortfolioValuationOut(BaseModel):
    snapshot_id: UUID
    reporting_currency: str
    total_market_value: Decimal
    total_cost_basis_value: Decimal | None
    total_unrealized_pnl: Decimal | None
    holdings: list[HoldingValuationOut]
    concentration: ConcentrationProfileOut
    warnings: list[str]
    # None = every account (no filter applied). Echoes back the account_id
    # filter this valuation was actually computed against (§26 accounts
    # feature dashboard filter), so a caller never has to guess.
    account_ids: list[UUID] | None = None
    # Set only by the GET (cached) path — see PortfolioValuation.as_of
    # (app.services.market_data.valuation) for exactly what this means.
    # None from the POST (live refresh) path: those numbers are as fresh as
    # the instant they were computed, by construction.
    as_of: datetime | None = None
