"""Share price (in the filing's reporting currency) + share count for one
holding — what app/services/metrics.py needs for the market multiples
(2026-09-25). Used by GET /holdings/{id}/metrics and the evidence packet,
so both show the same market cap.

Currency rule (same as the DCF, app/services/valuation/holding_valuation.py):
the price is converted INTO the filing's currency, never the reverse, so
every ratio divides like by like. Vår Energi trades in NOK and reports in
USD: its NOK price is converted to USD before it meets USD earnings.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.providers.base import MarketDataProvider
from app.services.market_data.fx import get_or_refresh_fx
from app.services.market_data.price import get_or_refresh_price
from app.services.market_data.shares import ShareCountResult, resolve_share_count
from app.services.metrics import MarketInputs


@dataclass
class MarketContext:
    inputs: MarketInputs | None = None
    unavailable_reason: str | None = None
    price: Decimal | None = None
    price_currency: str | None = None
    price_as_of: datetime | None = None
    fx_rate: Decimal | None = None
    price_in_reporting_currency: Decimal | None = None
    reporting_currency: str | None = None
    shares: ShareCountResult = field(default_factory=ShareCountResult)
    warnings: list[str] = field(default_factory=list)


def _fmt_price(value: Decimal) -> str:
    return f"{value:,.2f}" if abs(value) >= 1 else f"{value:.4f}"


def build_market_context(
    db: Session,
    holding: Holding,
    provider: MarketDataProvider | None,
    *,
    reporting_currency: str | None,
    latest_facts: dict[str, Decimal] | None,
    latest_period: str | None,
    force: bool = False,
    currency_unknown_not_mixed: bool = False,
) -> MarketContext:
    """`currency_unknown_not_mixed`: the figures carry no currency at all
    (older spreadsheet uploads) — then the price's own currency is assumed
    and a warning says so, the same rule as the multiples history."""
    context = MarketContext(reporting_currency=reporting_currency)
    context.shares = resolve_share_count(
        db, holding, provider, latest_facts=latest_facts, latest_period=latest_period, force=force
    )
    context.warnings.extend(context.shares.warnings)

    if provider is None:
        context.unavailable_reason = "no market data provider configured"
        return context
    if reporting_currency is None and not currency_unknown_not_mixed:
        context.unavailable_reason = "the filing's figures are in more than one currency"
        return context

    snapshot = get_or_refresh_price(db, provider, holding=holding, force=force)
    if not snapshot.available or snapshot.value is None:
        context.unavailable_reason = f"no share price: {snapshot.reason}"
        return context
    if reporting_currency is None:
        reporting_currency = snapshot.value.currency
        context.reporting_currency = reporting_currency
        context.warnings.append(
            f"The figures carry no currency; the multiples assume {reporting_currency}, like the price"
        )
    if snapshot.reason:
        context.warnings.append(f"Share price {snapshot.reason}")
    observation = snapshot.value
    context.price = observation.price
    context.price_currency = observation.currency
    context.price_as_of = snapshot.as_of

    price_note = f"price {observation.currency} {_fmt_price(observation.price)}"
    if observation.currency == reporting_currency:
        context.fx_rate = Decimal(1)
        converted = observation.price
    else:
        fx = get_or_refresh_fx(
            db, provider, from_currency=observation.currency, to_currency=reporting_currency, force=force
        )
        if not fx.available or fx.value is None:
            context.unavailable_reason = (
                f"price is in {observation.currency}, statements in {reporting_currency}, "
                f"and no FX rate is available: {fx.reason}"
            )
            return context
        context.fx_rate = fx.value.rate
        converted = observation.price * fx.value.rate
        price_note += (
            f" × {fx.value.rate:.4f} {observation.currency}→{reporting_currency} "
            f"= {reporting_currency} {_fmt_price(converted)}"
        )
    context.price_in_reporting_currency = converted
    if context.price_as_of:
        price_note += f" ({context.price_as_of.date().isoformat()})"

    if context.shares.shares is None:
        context.unavailable_reason = f"no share count: {context.shares.unavailable_reason}"
        return context

    context.inputs = MarketInputs(
        price=converted,
        shares=context.shares.shares,
        note=f"{price_note} × {context.shares.describe()}",
    )
    return context
