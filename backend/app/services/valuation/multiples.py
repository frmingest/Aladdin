"""Trailing valuation multiples over time (Sprint 3 — Brain Step 4's
"multiples vs. history/peers"), rebuilt 2026-09-25.

For every fiscal period with facts, the price nearest that year's end
(MarketObservation history) is paired with that year's figures. The
multiples themselves come from app/services/metrics.py's market-multiple
code, so the history table and the metrics panel use ONE definition
(owner's-view EV incl. hybrid capital, leases and minorities; P/B on
ordinary equity; "not meaningful" over a denominator <= 0).

Fixed 2026-09-25 (claude/gap-closing-roic-roe-multiples-2026-09-25.md §3.2):
- the price is converted into the filing's reporting currency before it
  meets the figures (Vår Energi: NOK price, USD statements — P/E and P/S
  were ~10x too high before). The FX rate is the stored observation
  nearest the year end; without one, today's rate is used and the note
  says so;
- shares: the period's shares_outstanding fact, else net income ÷ basic
  EPS (the year's weighted average, labelled as such).

Period-to-price matching stays approximate (a "FY2025" label is treated as
31 December 2025). A period with no price, no share count or no FX rate is
skipped with the reason, never silently dropped.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.period_dates import period_end_date
from app.models.holding import Holding
from app.models.market import FxObservation, MarketObservation
from app.services.holding_facts import facts_by_period
from app.services.market_data.shares import eps_implied_range
from app.services.metrics import MarketInputs, compute_holding_metrics

HISTORY_KEYS = ("price_to_earnings", "price_to_book", "price_to_sales", "ev_to_ebitda", "enterprise_value")
# A stored FX rate further than this from the year end isn't "that year's".
FX_MATCH_WINDOW = timedelta(days=45)

FxFallback = Callable[[str, str], Decimal | None]


@dataclass
class PeriodMultiples:
    period: str
    matched_price_observed_at: datetime | None = None
    computed: dict[str, Decimal] = field(default_factory=dict)
    skipped: dict[str, str] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)  # SQLite drops tz


def _nearest(rows: list, target: datetime, when: Callable) -> object | None:
    if not rows:
        return None
    return min(rows, key=lambda row: abs((_aware(when(row)) - target).total_seconds()))


def _fx_rate(
    fx_rows: list[FxObservation],
    from_currency: str,
    to_currency: str,
    target: datetime,
    fallback: FxFallback | None,
) -> tuple[Decimal | None, str | None]:
    pair = [r for r in fx_rows if r.from_currency == from_currency and r.to_currency == to_currency]
    nearest = _nearest(pair, target, lambda r: r.observed_at)
    if nearest is not None and abs(_aware(nearest.observed_at) - target) <= FX_MATCH_WINDOW:  # type: ignore[attr-defined]
        return nearest.rate, None  # type: ignore[attr-defined]
    if fallback is not None:
        rate = fallback(from_currency, to_currency)
        if rate is not None:
            return rate, f"{from_currency}→{to_currency} at today's rate (no rate stored for that year end)"
    return None, None


def _shares(facts: dict[str, Decimal]) -> tuple[Decimal | None, str | None]:
    filed = facts.get("shares_outstanding")
    if filed is not None and filed > 0:
        return filed, None
    implied = eps_implied_range(facts)
    if implied is not None:
        return (implied[0] + implied[1]) / 2, "shares ≈ net income ÷ basic EPS (the year's weighted average)"
    return None, None


def multiples_over_time(
    db: Session, holding: Holding, *, fx_fallback: FxFallback | None = None
) -> list[PeriodMultiples]:
    """One PeriodMultiples per fiscal period this holding has facts for,
    sorted by period label. `fx_fallback(from, to)` supplies today's rate
    when no stored rate is near a year end."""
    observations = list(
        db.scalars(select(MarketObservation).where(MarketObservation.holding_id == holding.id))
    )
    fx_rows = list(db.scalars(select(FxObservation)))

    results: list[PeriodMultiples] = []
    for period, entry in sorted(facts_by_period(db, holding.id).items()):
        result = PeriodMultiples(period=period)
        results.append(result)
        if entry.year is None:
            result.skipped["_period"] = f"could not parse a year out of period label {period!r}"
            continue
        target = period_end_date(entry.year)
        observation = _nearest(observations, target, lambda o: o.observed_at)
        if observation is None:
            result.skipped["_period"] = "no market price observation available for this holding"
            continue
        result.matched_price_observed_at = observation.observed_at  # type: ignore[attr-defined]
        price: Decimal = observation.price  # type: ignore[attr-defined]
        price_currency: str = observation.currency  # type: ignore[attr-defined]

        currency = entry.currency
        if currency is None:
            if any(c for m, c in entry.currencies.items() if m != "shares_outstanding"):
                result.skipped["_period"] = "the period's figures are in more than one currency"
                continue
            # Facts saved without a currency (older uploads): the only
            # possible reading is the price's own currency — said so.
            currency = price_currency
            result.notes.append(f"figures carry no currency; assumed {price_currency} like the price")
        if price_currency != currency:
            rate, note = _fx_rate(fx_rows, price_currency, currency, target, fx_fallback)
            if rate is None:
                result.skipped["_period"] = (
                    f"price is in {price_currency}, figures in {currency}, and no FX rate is available"
                )
                continue
            price = price * rate
            if note:
                result.notes.append(note)

        shares, shares_note = _shares(entry.facts)
        if shares is None:
            for key in HISTORY_KEYS:
                result.skipped[key] = "missing: shares_outstanding (and no net income ÷ EPS to derive it)"
            continue
        if shares_note:
            result.notes.append(shares_note)

        metrics = compute_holding_metrics(
            entry.facts, entry.currencies, market=MarketInputs(price=price, shares=shares)
        )
        for key in HISTORY_KEYS:
            if key in metrics.computed:
                result.computed[key] = metrics.computed[key]
            elif key in metrics.skipped:
                result.skipped[key] = metrics.skipped[key]
    return results
