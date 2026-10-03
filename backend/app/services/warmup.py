"""First fetch of market data for holdings that have never had any
(Sprint 20, 2026-10-03).

A plain GET no longer makes the first-ever live call for a price, FX rate,
share count or beta (app/services/market_data/common.py): it reports "not
fetched yet". The fetch happens here instead, off the request:

* `POST /holdings/{id}/warm-up` — the Watchlist page calls it right after
  you add a company, so the price is there when the row appears. It is
  idempotent: it only fetches what is missing or older than its usual
  staleness limit, so pressing it twice costs nothing;
* the PC worker's poll loop (`warm_cold_holdings`) — picks up anything that
  has no price yet (a portfolio import, an add made while the page was
  closed), on the home IP where Yahoo is reachable. A holding whose fetch
  failed is not retried on every poll but after `warmup_retry_seconds`.

Never raises for one holding's failure; each step reports why it failed.
Company research is deliberately NOT fetched here: it spends Gemini / Tavily
quota, so it stays an explicit action (an analysis run or the Refresh button).
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.market import MarketObservation
from app.models.portfolio import PortfolioPosition
from app.models.watchlist import WatchlistItem
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.services import snapshots
from app.services.market_data.beta import get_or_refresh_beta
from app.services.market_data.fx import get_or_refresh_fx
from app.services.market_data.price import get_or_refresh_price
from app.services.market_data.risk_free_rate import get_or_refresh_risk_free_rate
from app.services.market_data.shares import resolve_share_count

log = logging.getLogger("aladdin.warmup")

BASE_CURRENCY = "NOK"


@dataclass
class WarmupResult:
    ticker: str
    fetched: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return "price" in self.fetched

    def summary(self) -> str:
        parts = [f"fetched {', '.join(self.fetched) or 'nothing'}"]
        if self.problems:
            parts.append("; ".join(self.problems))
        return f"{self.ticker}: " + " — ".join(parts)


def cold_holdings(db: Session, *, limit: int | None = None) -> list[Holding]:
    """Holdings you own or watch that have no stored price at all."""
    has_price = select(MarketObservation.id).where(MarketObservation.holding_id == Holding.id).exists()
    wanted = or_(
        Holding.id.in_(select(WatchlistItem.holding_id)),
        Holding.id.in_(select(PortfolioPosition.holding_id)),
    )
    stmt = select(Holding).where(wanted, ~has_price).order_by(Holding.created_at.desc())
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))


def warm_holding(
    db: Session,
    holding: Holding,
    provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider | None = None,
) -> WarmupResult:
    """Make sure price, FX to NOK, risk-free rate, share count and beta are
    stored for one holding: fetch what is missing or stale, leave fresh
    values alone (so it is cheap to repeat). `fetched` lists what is now
    available, `problems` says why anything is not."""
    result = WarmupResult(ticker=holding.ticker)
    # The DCF discounts at the risk-free rate of the filing's reporting
    # currency (Vår Energi trades in NOK, reports in USD), so that one too.
    currencies = {holding.trading_currency.upper()}
    try:
        currencies.update(
            c.upper()
            for c in db.scalars(
                select(FinancialLineItem.currency)
                .where(FinancialLineItem.holding_id == holding.id, FinancialLineItem.currency.is_not(None))
                .distinct()
            )
            if c
        )
    except Exception:  # noqa: BLE001 - optional extra; never blocks the warm-up
        db.rollback()
    try:
        price = get_or_refresh_price(db, provider, holding=holding)
        if price.available and price.value is not None:
            result.fetched.append("price")
            currency = (price.value.currency or "").upper()
            if currency:
                currencies.add(currency)
            if currency and currency != BASE_CURRENCY:
                fx = get_or_refresh_fx(db, provider, from_currency=currency, to_currency=BASE_CURRENCY)
                if fx.available and fx.value is not None:
                    result.fetched.append(f"FX {currency}→{BASE_CURRENCY}")
                else:
                    result.problems.append(f"FX: {fx.reason}")
        else:
            result.problems.append(f"price: {price.reason}")
    except Exception as exc:  # noqa: BLE001 - one step failing must not stop the others
        db.rollback()
        result.problems.append(f"price: {exc}")

    if risk_free_rate_provider is not None:
        for currency in sorted(currencies):
            try:
                rate = get_or_refresh_risk_free_rate(db, risk_free_rate_provider, currency=currency)
                if rate.available and rate.value is not None:
                    result.fetched.append(f"risk-free rate {currency}")
                else:
                    result.problems.append(f"risk-free rate {currency}: {rate.reason}")
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                result.problems.append(f"risk-free rate {currency}: {exc}")

    try:
        shares = resolve_share_count(db, holding, provider)
        if shares.shares is not None:
            result.fetched.append("share count")
        else:
            result.problems.append(f"share count: {shares.unavailable_reason}")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        result.problems.append(f"share count: {exc}")

    try:
        beta = get_or_refresh_beta(db, provider, holding.ticker)
        if beta.value is not None:
            result.fetched.append("beta")
        else:
            result.problems.append(f"beta: {beta.reason}")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        result.problems.append(f"beta: {exc}")

    if result.fetched:
        # Prices are not part of a snapshot's fingerprint, so say explicitly
        # that the stored pages are out of date; the worker rebuilds them.
        snapshots.invalidate(db)
    return result


def warm_cold_holdings(
    db: Session,
    provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider | None = None,
    *,
    attempts: dict[uuid.UUID, float],
    now: float | None = None,
    limit: int = 3,
) -> list[WarmupResult]:
    """One worker pass: warm up to `limit` cold holdings not tried recently.

    `attempts` maps holding id -> time.monotonic() of the last try and is
    owned by the caller (the worker), so a failing ticker waits
    `warmup_retry_seconds` instead of being hit on every poll."""
    now = time.monotonic() if now is None else now
    retry = get_settings().warmup_retry_seconds
    results: list[WarmupResult] = []
    for holding in cold_holdings(db):
        if len(results) >= limit:
            break
        last = attempts.get(holding.id)
        if last is not None and now - last < retry:
            continue
        attempts[holding.id] = now
        result = warm_holding(db, holding, provider, risk_free_rate_provider)
        log.info("warm-up %s", result.summary())
        results.append(result)
    return results
