"""Ties the valuation engine together for one holding (Sprint 3): live
market data + risk-free rate (app/services/market_data/), the versioned
assumptions (app/domain/valuation_assumptions/), and the deterministic
calc modules (growth, discount_rate, dcf, multiples) into one result the
API (app/api/valuation.py) can serve.

Currency handling: a DCF discounts owner earnings, which are computed from
FinancialLineItem facts in whatever currency that holding's filings report
in (`FinancialLineItem.currency`) — not necessarily the same currency the
stock trades in (`Holding.trading_currency`; e.g. a Norway-listed company
that reports in USD). The live share price and risk-free rate both need to
be in the *filing's* currency for the DCF to be internally consistent, so
this module converts the price via a live FX rate when the two differ,
and fetches the risk-free rate for the filing's currency, not the trading
currency.

Fail-visibly discipline (CLAUDE.md): a missing/unconvertible price, an
unavailable risk-free rate, or too little owner-earnings history each
degrade a *specific part* of the result (recorded in `unavailable_reasons`)
rather than failing the whole valuation — multiples-over-time, for
instance, has no dependency on the DCF succeeding.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.period_dates import extract_year
from app.domain.valuation_assumptions import get_valuation_assumptions
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.services.market_data.fx import get_or_refresh_fx
from app.services.market_data.price import get_or_refresh_price
from app.services.market_data.risk_free_rate import get_or_refresh_risk_free_rate
from app.services.metrics import owner_earnings_from_facts
from app.services.valuation.dcf import (
    DCFScenarioResult,
    dcf_scenarios,
    reverse_dcf_implied_growth,
)
from app.services.valuation.discount_rate import cost_of_equity
from app.services.valuation.growth import historical_cagr
from app.services.valuation.multiples import PeriodMultiples, multiples_over_time


@dataclass
class HoldingValuationResult:
    holding_id: uuid.UUID
    ticker: str
    valuation_currency: str | None = None
    as_of: datetime | None = None
    base_growth_rate: Decimal | None = None
    discount_rate: Decimal | None = None
    risk_free_rate_pct: Decimal | None = None
    beta: Decimal | None = None
    equity_risk_premium: Decimal | None = None
    current_price_per_share: Decimal | None = None
    dcf: DCFScenarioResult | None = None
    reverse_dcf_implied_growth: Decimal | None = None
    multiples: list[PeriodMultiples] = field(default_factory=list)
    assumptions_version: str = ""
    unavailable_reasons: list[str] = field(default_factory=list)


def _owner_earnings_history(db: Session, holding: Holding) -> list[tuple[int, str, Decimal]]:
    """(year, period, owner_earnings) triples, oldest first, for every
    period with a complete owner-earnings input set and a parseable year.
    """
    line_items = list(
        db.scalars(select(FinancialLineItem).where(FinancialLineItem.holding_id == holding.id))
    )
    by_period: dict[str, dict[str, Decimal]] = {}
    currency_by_period: dict[str, str | None] = {}
    for item in line_items:
        by_period.setdefault(item.period, {})[item.metric] = item.value
        currency_by_period[item.period] = item.currency

    history: list[tuple[int, str, Decimal]] = []
    for period, facts in by_period.items():
        year = extract_year(period)
        if year is None:
            continue
        # Same owner's-view definition as GET /holdings/{id}/metrics and the
        # evidence packet (decommissioning and lease payments deducted when
        # extracted) — app/services/metrics.py owns it.
        owner = owner_earnings_from_facts(facts)
        if owner is None:
            continue
        history.append((year, period, owner[0]))
    history.sort(key=lambda row: row[0])
    return history


def _valuation_currency(db: Session, holding: Holding, latest_period: str) -> str:
    stmt = select(FinancialLineItem.currency).where(
        FinancialLineItem.holding_id == holding.id, FinancialLineItem.period == latest_period
    )
    currency = db.scalar(stmt.where(FinancialLineItem.currency.isnot(None)))
    return currency or holding.trading_currency


def _shares_outstanding(db: Session, holding: Holding, period: str) -> Decimal | None:
    stmt = select(FinancialLineItem.value).where(
        FinancialLineItem.holding_id == holding.id,
        FinancialLineItem.period == period,
        FinancialLineItem.metric == "shares_outstanding",
    )
    return db.scalar(stmt)


def compute_holding_valuation(
    db: Session,
    holding: Holding,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    *,
    force_refresh: bool = False,
) -> HoldingValuationResult:
    settings = get_settings()
    assumptions = get_valuation_assumptions(settings.active_valuation_assumptions_version)
    result = HoldingValuationResult(
        holding_id=holding.id, ticker=holding.ticker, assumptions_version=assumptions.version
    )

    result.multiples = multiples_over_time(db, holding)

    history = _owner_earnings_history(db, holding)
    if len(history) < 2:
        result.unavailable_reasons.append(
            "DCF unavailable: fewer than two periods with complete owner-earnings inputs "
            "(net_income, depreciation_and_amortization, capital_expenditures)"
        )
        return result

    _latest_year, latest_period, base_owner_earnings = history[-1]
    try:
        base_growth_rate = historical_cagr([row[2] for row in history])
    except ValueError as exc:
        result.unavailable_reasons.append(f"DCF unavailable: {exc}")
        return result
    result.base_growth_rate = base_growth_rate

    valuation_currency = _valuation_currency(db, holding, latest_period)
    result.valuation_currency = valuation_currency

    shares_outstanding = _shares_outstanding(db, holding, latest_period)
    if shares_outstanding is None or shares_outstanding <= 0:
        result.unavailable_reasons.append(
            f"DCF unavailable: no positive shares_outstanding fact for period {latest_period!r}"
        )
        return result

    rate_snapshot = get_or_refresh_risk_free_rate(
        db, risk_free_rate_provider, currency=valuation_currency, force=force_refresh
    )
    if not rate_snapshot.available or rate_snapshot.value is None:
        result.unavailable_reasons.append(
            f"DCF unavailable: no risk-free rate for {valuation_currency}: {rate_snapshot.reason}"
        )
        return result
    result.risk_free_rate_pct = rate_snapshot.value.rate

    beta = market_data_provider.get_beta(holding.ticker)
    if beta is None:
        beta = assumptions.default_beta
        result.unavailable_reasons.append(
            f"beta unavailable from {market_data_provider.name}, used default beta "
            f"{assumptions.default_beta} from assumptions {assumptions.version}"
        )
    result.beta = beta

    equity_risk_premium = assumptions.equity_risk_premium.get(
        valuation_currency, assumptions.default_equity_risk_premium
    )
    result.equity_risk_premium = equity_risk_premium

    result.discount_rate = cost_of_equity(
        risk_free_rate_pct=rate_snapshot.value.rate, beta=beta, equity_risk_premium=equity_risk_premium
    )

    current_price_per_share = _current_price_in_valuation_currency(
        db, holding, valuation_currency, market_data_provider, result, force_refresh=force_refresh
    )
    result.current_price_per_share = current_price_per_share

    try:
        result.dcf = dcf_scenarios(
            base_owner_earnings=base_owner_earnings,
            base_growth_rate=base_growth_rate,
            discount_rate=result.discount_rate,
            terminal_growth_rate=assumptions.terminal_growth_rate,
            years=assumptions.projection_years,
            shares_outstanding=shares_outstanding,
            bull_growth_offset=assumptions.bull_growth_offset,
            bear_growth_offset=assumptions.bear_growth_offset,
            current_price_per_share=current_price_per_share,
        )
    except ValueError as exc:
        result.unavailable_reasons.append(f"DCF unavailable: {exc}")
        return result

    if current_price_per_share is not None:
        try:
            result.reverse_dcf_implied_growth = reverse_dcf_implied_growth(
                current_price_per_share=current_price_per_share,
                base_owner_earnings=base_owner_earnings,
                discount_rate=result.discount_rate,
                terminal_growth_rate=assumptions.terminal_growth_rate,
                years=assumptions.projection_years,
                shares_outstanding=shares_outstanding,
            )
        except ValueError as exc:
            result.unavailable_reasons.append(f"reverse DCF unavailable: {exc}")

    return result


def _current_price_in_valuation_currency(
    db: Session,
    holding: Holding,
    valuation_currency: str,
    market_data_provider: MarketDataProvider,
    result: HoldingValuationResult,
    *,
    force_refresh: bool,
) -> Decimal | None:
    price_snapshot = get_or_refresh_price(
        db, market_data_provider, holding=holding, force=force_refresh
    )
    if not price_snapshot.available or price_snapshot.value is None:
        result.unavailable_reasons.append(
            f"current price unavailable, margin of safety/reverse DCF skipped: {price_snapshot.reason}"
        )
        return None

    result.as_of = price_snapshot.as_of
    price = price_snapshot.value
    if price.currency == valuation_currency:
        return price.price

    fx_snapshot = get_or_refresh_fx(
        db,
        market_data_provider,
        from_currency=price.currency,
        to_currency=valuation_currency,
        force=force_refresh,
    )
    if not fx_snapshot.available or fx_snapshot.value is None:
        result.unavailable_reasons.append(
            f"price is in {price.currency} but no FX rate to {valuation_currency} available, "
            f"margin of safety/reverse DCF skipped: {fx_snapshot.reason}"
        )
        return None

    return price.price * fx_snapshot.value.rate
