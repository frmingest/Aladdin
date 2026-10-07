"""Deterministic numbers for the income and commodity analysis paths
(CLAUDE.md Rule 1: all arithmetic is Python, never the LLM). Read-only: no
network, market-data or LLM call.

Income (bond fund, money-market fund) — a reference yield is chosen from the
typed-in figures (yield to maturity, else distribution yield) and used for:
- fee share of yield = ongoing charge / reference yield
- yield spread over Norway's 3-month T-bill and 10-year government yield
  (only when the fund is NOK-denominated or its currency is unstated; a
  spread across currencies would compare unlike things)
- real yield = reference yield − Norway CPI (12-month)
- rate-shock price effect ≈ −duration × change in rates (first-order; it
  ignores convexity and is labelled an approximation)
- breakeven rate rise over one year = reference yield / duration: how far
  rates can rise before a year of yield is eaten by the price loss

Commodity (physical-metal ETC) — a metal pays nothing, so the hurdle is what
the holder gives up:
- carry hurdle over n years = (1 + r)^n / (1 − fee)^n − 1, with r the Norway
  3-month T-bill yield: how much the metal must rise (in NOK) just to match
  holding T-bills instead, after the yearly charge
- premium or discount = market price / NAV − 1, from two typed-in figures
  dated alike
- grams of metal per 1 000 NOK is not computed (it would need a spot price
  this module does not fetch)

Both reuse the fund cost, track-record and concentration figures from
app/services/funds/metrics.py.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.domain.instrument_types import PATH_COMMODITY, PATH_INCOME, analysis_path
from app.models.holding import Holding
from app.services.funds.facts import get_profile
from app.services.funds.metrics import (
    FundMetrics,
    _position_values,
    compute_fund_metrics,
)
from app.services.instruments.facts import facts_by_key
from app.services.macro.indicators import get_macro_indicators

HUNDRED = Decimal(100)
ZERO = Decimal(0)
CARRY_YEARS = (5, 10)
RATE_SHOCKS_PP = (1, 2)
HOME_CURRENCY = "NOK"


def _q(value: Decimal, places: str = "0.01") -> Decimal:
    return value.quantize(Decimal(places))


class RateShock(BaseModel):
    change_pp: Decimal
    price_effect_pct: Decimal


class IncomeMetrics(BaseModel):
    reference_yield_pct: Decimal | None
    reference_yield_basis: str | None
    ongoing_charge_pct: Decimal | None
    fee_share_of_yield_pct: Decimal | None
    spread_vs_no_3m_bill_pp: Decimal | None
    spread_vs_no_10y_pp: Decimal | None
    no_3m_bill_pct: Decimal | None
    no_10y_pct: Decimal | None
    no_cpi_pct: Decimal | None
    real_yield_pp: Decimal | None
    effective_duration_years: Decimal | None
    rate_shocks: list[RateShock]
    breakeven_rate_rise_pp: Decimal | None
    high_yield_share_pct: Decimal | None
    average_credit_rating: str | None


class CarryHurdle(BaseModel):
    years: int
    required_rise_pct: Decimal


class CommodityMetrics(BaseModel):
    metal: str | None
    ongoing_charge_pct: Decimal | None
    no_3m_bill_pct: Decimal | None
    carry_hurdles: list[CarryHurdle]
    nav_per_unit: Decimal | None
    market_price_per_unit: Decimal | None
    premium_discount_pct: Decimal | None


class InstrumentMetrics(BaseModel):
    path: str
    fund: FundMetrics
    position_value_nok: Decimal | None
    portfolio_weight_pct: Decimal | None
    income: IncomeMetrics | None = None
    commodity: CommodityMetrics | None = None
    gaps: list[str]


def reference_yield(yield_to_maturity: Decimal | None, distribution_yield: Decimal | None) -> tuple[Decimal | None, str | None]:
    if yield_to_maturity is not None:
        return yield_to_maturity, "yield to maturity"
    if distribution_yield is not None:
        return distribution_yield, "distribution yield"
    return None, None


def rate_shock_effect_pct(duration_years: Decimal, change_pp: Decimal) -> Decimal:
    """First-order price effect of a parallel rate change: −duration × change."""
    return _q(-duration_years * change_pp)


def breakeven_rate_rise_pp(yield_pct: Decimal, duration_years: Decimal) -> Decimal | None:
    """The rate rise (percentage points) after which one year of yield is
    exactly offset by the price loss: yield / duration."""
    if duration_years <= 0:
        return None
    return _q(yield_pct / duration_years)


def carry_hurdle_pct(risk_free_pct: Decimal, ongoing_charge_pct: Decimal, years: int) -> Decimal:
    """How much (percent, cumulative) the asset must rise over `years` just
    to match holding a risk-free instrument, given a yearly charge."""
    growth = (1 + risk_free_pct / HUNDRED) ** years
    keep = (1 - ongoing_charge_pct / HUNDRED) ** years
    return _q((growth / keep - 1) * HUNDRED)


def premium_discount_pct(market_price: Decimal, nav: Decimal) -> Decimal | None:
    if nav <= 0:
        return None
    return _q((market_price / nav - 1) * HUNDRED)


def _macro_values(db: Session) -> dict[str, Decimal]:
    snapshots = get_macro_indicators(db).indicators
    return {s.key: s.value for s in snapshots if s.value is not None and not s.stale}


def compute_income_metrics(db: Session, holding: Holding, fund: FundMetrics, gaps: list[str]) -> IncomeMetrics:
    facts = facts_by_key(db, holding.id)
    profile = get_profile(db, holding.id)

    def num(key: str) -> Decimal | None:
        row = facts.get(key)
        return row.value_number if row is not None else None

    def text(key: str) -> str | None:
        row = facts.get(key)
        return row.value_text if row is not None else None

    ref, basis = reference_yield(num("yield_to_maturity_pct"), num("distribution_yield_pct"))
    if ref is None:
        gaps.append("no yield entered (yield to maturity or distribution yield): spreads and real yield not computed")
    duration = num("effective_duration_years")
    if duration is None:
        gaps.append("no effective duration entered: rate sensitivity not computed")
    ocf = fund.cost.ongoing_charge_pct

    macro = _macro_values(db)
    bill, ten_year, cpi = macro.get("no_3m_bill"), macro.get("no_10y"), macro.get("no_cpi_yoy")
    currency = (profile.base_currency if profile else None) or holding.trading_currency
    comparable = currency is None or currency.upper() == HOME_CURRENCY
    if ref is not None and not comparable:
        gaps.append(
            f"fund currency is {currency}: spreads and real yield against Norwegian rates and inflation are not computed"
        )

    fee_share = _q(ocf / ref * HUNDRED) if ref is not None and ref > 0 and ocf is not None else None
    spread_bill = _q(ref - bill) if comparable and ref is not None and bill is not None else None
    spread_10y = _q(ref - ten_year) if comparable and ref is not None and ten_year is not None else None
    real_yield = _q(ref - cpi) if comparable and ref is not None and cpi is not None else None
    if comparable and ref is not None and bill is None and ten_year is None:
        gaps.append("no Norwegian T-bill or 10-year yield stored: yield spreads not computed (Macro → Refresh data)")

    shocks = (
        [RateShock(change_pp=Decimal(pp), price_effect_pct=rate_shock_effect_pct(duration, Decimal(pp)))
         for pp in RATE_SHOCKS_PP]
        if duration is not None
        else []
    )
    breakeven = breakeven_rate_rise_pp(ref, duration) if ref is not None and duration is not None else None
    return IncomeMetrics(
        reference_yield_pct=ref,
        reference_yield_basis=basis,
        ongoing_charge_pct=ocf,
        fee_share_of_yield_pct=fee_share,
        spread_vs_no_3m_bill_pp=spread_bill,
        spread_vs_no_10y_pp=spread_10y,
        no_3m_bill_pct=bill,
        no_10y_pct=ten_year,
        no_cpi_pct=cpi,
        real_yield_pp=real_yield,
        effective_duration_years=duration,
        rate_shocks=shocks,
        breakeven_rate_rise_pp=breakeven,
        high_yield_share_pct=num("high_yield_share_pct"),
        average_credit_rating=text("average_credit_rating"),
    )


def compute_commodity_metrics(db: Session, holding: Holding, fund: FundMetrics, gaps: list[str]) -> CommodityMetrics:
    facts = facts_by_key(db, holding.id)

    def num(key: str) -> Decimal | None:
        row = facts.get(key)
        return row.value_number if row is not None else None

    ocf = fund.cost.ongoing_charge_pct
    bill = _macro_values(db).get("no_3m_bill")
    hurdles: list[CarryHurdle] = []
    if ocf is None:
        gaps.append("no ongoing charge entered: carry hurdle not computed")
    elif bill is None:
        gaps.append("no Norwegian 3-month T-bill yield stored: carry hurdle not computed (Macro → Refresh data)")
    else:
        hurdles = [CarryHurdle(years=n, required_rise_pct=carry_hurdle_pct(bill, ocf, n)) for n in CARRY_YEARS]

    nav, price = num("nav_per_unit"), num("market_price_per_unit")
    premium = premium_discount_pct(price, nav) if nav is not None and price is not None else None
    if premium is None:
        gaps.append("NAV and market price per unit not both entered: premium / discount not computed")
    metal_row = facts.get("metal")
    return CommodityMetrics(
        metal=metal_row.value_text if metal_row is not None else None,
        ongoing_charge_pct=ocf,
        no_3m_bill_pct=bill,
        carry_hurdles=hurdles,
        nav_per_unit=nav,
        market_price_per_unit=price,
        premium_discount_pct=premium,
    )


def compute_instrument_metrics(db: Session, holding: Holding) -> InstrumentMetrics:
    path = analysis_path(holding.asset_class_raw)
    if path not in (PATH_INCOME, PATH_COMMODITY):
        raise ValueError(f"{holding.asset_class_raw!r} is not an income or commodity instrument")
    fund = compute_fund_metrics(db, holding)
    gaps: list[str] = []
    values: dict[uuid.UUID, Decimal] = _position_values(db)
    position = values.get(holding.id)
    total = sum(values.values(), ZERO)
    weight = _q(position / total * HUNDRED) if position is not None and total > 0 else None
    income = compute_income_metrics(db, holding, fund, gaps) if path == PATH_INCOME else None
    commodity = compute_commodity_metrics(db, holding, fund, gaps) if path == PATH_COMMODITY else None
    return InstrumentMetrics(
        path=path,
        fund=fund,
        position_value_nok=_q(position) if position is not None else None,
        portfolio_weight_pct=weight,
        income=income,
        commodity=commodity,
        gaps=gaps,
    )
