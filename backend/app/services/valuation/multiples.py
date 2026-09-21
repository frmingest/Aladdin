"""Trailing valuation multiples over time (Sprint 3 — Brain Step 4's
"multiples vs. history/peers").

Combines FinancialLineItem's document-sourced fundamentals (per fiscal
period) with historical MarketObservation prices
(app/services/market_data/) to compute trailing P/E, P/B, P/S, and
EV/EBITDA for every period that has both — using
app/services/calculations.py's existing multiple functions (CLAUDE.md
Rule 1: this module adds no new arithmetic of its own beyond deriving EPS/
book-value-per-share/market-cap, the minimum needed to feed
calculations.py's functions their inputs).

Period-to-price matching is deliberately approximate: FinancialLineItem.period
is a free-text label (e.g. "FY2025"), not a date, so this module extracts
the year and treats it as that fiscal year's December 31 for the purpose
of finding the *nearest* historical price observation — standard "trailing
multiple as of fiscal year-end" practice, not a precise trading-day match.
A period with no parseable year, or a holding with no price observation at
all, is skipped with a real reason (CLAUDE.md: fail visibly, mirroring
app/services/metrics.py's computed/skipped-with-reason precedent), never
silently dropped.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.period_dates import extract_year, period_end_date
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.market import MarketObservation
from app.services import calculations


@dataclass
class PeriodMultiples:
    period: str
    matched_price_observed_at: datetime | None = None
    computed: dict[str, Decimal] = field(default_factory=dict)
    skipped: dict[str, str] = field(default_factory=dict)


def _nearest_observation(
    observations: list[MarketObservation], target: datetime
) -> MarketObservation | None:
    if not observations:
        return None

    def _distance(obs: MarketObservation) -> float:
        observed_at = obs.observed_at
        if observed_at.tzinfo is None:  # SQLite in tests loses tz-awareness
            observed_at = observed_at.replace(tzinfo=timezone.utc)
        return abs((observed_at - target).total_seconds())

    return min(observations, key=_distance)


def _facts_by_period(line_items: list[FinancialLineItem]) -> dict[str, dict[str, Decimal]]:
    by_period: dict[str, dict[str, Decimal]] = {}
    for item in line_items:
        by_period.setdefault(item.period, {})[item.metric] = item.value
    return by_period


def _attempt_eps_multiple(result: PeriodMultiples, facts: dict[str, Decimal], price: Decimal) -> None:
    net_income = facts.get("net_income")
    shares = facts.get("shares_outstanding")
    if net_income is None or shares is None:
        missing = [n for n, v in (("net_income", net_income), ("shares_outstanding", shares)) if v is None]
        result.skipped["price_to_earnings"] = f"missing: {', '.join(missing)}"
        return
    if shares == 0:
        result.skipped["price_to_earnings"] = "shares_outstanding is zero"
        return
    try:
        result.computed["price_to_earnings"] = calculations.price_to_earnings(price, net_income / shares)
    except ValueError as exc:
        result.skipped["price_to_earnings"] = str(exc)


def _attempt_book_multiple(result: PeriodMultiples, facts: dict[str, Decimal], price: Decimal) -> None:
    total_equity = facts.get("total_equity")
    shares = facts.get("shares_outstanding")
    if total_equity is None or shares is None:
        missing = [n for n, v in (("total_equity", total_equity), ("shares_outstanding", shares)) if v is None]
        result.skipped["price_to_book"] = f"missing: {', '.join(missing)}"
        return
    if shares == 0:
        result.skipped["price_to_book"] = "shares_outstanding is zero"
        return
    try:
        result.computed["price_to_book"] = calculations.price_to_book(price, total_equity / shares)
    except ValueError as exc:
        result.skipped["price_to_book"] = str(exc)


def _attempt_sales_and_ev_multiples(
    result: PeriodMultiples, facts: dict[str, Decimal], price: Decimal
) -> None:
    shares = facts.get("shares_outstanding")
    if shares is None:
        result.skipped["price_to_sales"] = "missing: shares_outstanding"
        result.skipped["ev_to_ebitda"] = "missing: shares_outstanding"
        return
    if shares == 0:
        result.skipped["price_to_sales"] = "shares_outstanding is zero"
        result.skipped["ev_to_ebitda"] = "shares_outstanding is zero"
        return

    market_cap = price * shares

    revenue = facts.get("revenue")
    if revenue is None:
        result.skipped["price_to_sales"] = "missing: revenue"
    else:
        try:
            result.computed["price_to_sales"] = calculations.price_to_sales(market_cap, revenue)
        except ValueError as exc:
            result.skipped["price_to_sales"] = str(exc)

    total_debt = facts.get("total_debt")
    cash = facts.get("cash_and_equivalents")
    ebitda = facts.get("ebitda")
    if total_debt is None or cash is None or ebitda is None:
        missing = [
            n
            for n, v in (("total_debt", total_debt), ("cash_and_equivalents", cash), ("ebitda", ebitda))
            if v is None
        ]
        result.skipped["ev_to_ebitda"] = f"missing: {', '.join(missing)}"
        return
    ev = calculations.enterprise_value(market_cap, total_debt, cash)
    result.computed["enterprise_value"] = ev
    try:
        result.computed["ev_to_ebitda"] = calculations.ev_to_ebitda(ev, ebitda)
    except ValueError as exc:
        result.skipped["ev_to_ebitda"] = str(exc)


def multiples_over_time(db: Session, holding: Holding) -> list[PeriodMultiples]:
    """One PeriodMultiples per distinct FinancialLineItem.period this
    holding has facts for, sorted by period label."""
    line_items = list(
        db.scalars(select(FinancialLineItem).where(FinancialLineItem.holding_id == holding.id))
    )
    observations = list(
        db.scalars(select(MarketObservation).where(MarketObservation.holding_id == holding.id))
    )

    results: list[PeriodMultiples] = []
    for period, facts in sorted(_facts_by_period(line_items).items()):
        result = PeriodMultiples(period=period)

        year = extract_year(period)
        if year is None:
            result.skipped["_period"] = f"could not parse a year out of period label {period!r}"
            results.append(result)
            continue

        observation = _nearest_observation(observations, period_end_date(year))
        if observation is None:
            result.skipped["_period"] = "no market price observation available for this holding"
            results.append(result)
            continue

        result.matched_price_observed_at = observation.observed_at
        price = observation.price

        _attempt_eps_multiple(result, facts, price)
        _attempt_book_multiple(result, facts, price)
        _attempt_sales_and_ev_multiples(result, facts, price)

        results.append(result)

    return results
