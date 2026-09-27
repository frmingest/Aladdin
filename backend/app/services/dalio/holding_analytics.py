"""Per-holding cycle profile for Dalio mode: quadrant and rate betas from
stored prices and macro series (app/services/dalio/cycle_math.py), and the
holding's correlation to the rest of the portfolio. Shared by the Dalio
evidence packet (story 22.3) and the All-Weather portfolio view (22.9), so
both always show the same numbers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.providers.base import MarketDataProvider
from app.services.dalio.cycle_math import (
    FactorBeta,
    monthly_changes,
    monthly_returns_pct,
    ols_beta,
    quadrant_tilt,
)
from app.services.macro.indicators import yoy_series
from app.services.macro.refresh import stored_points
from app.services.risk.correlation import build_correlation_matrix
from app.services.risk.price_history import TickerHistory, get_or_refresh_daily_history

HOME_REGION_BY_CURRENCY = {"NOK": "NO"}


@dataclass
class CycleProfile:
    ticker: str
    history_note: str | None
    inflation: FactorBeta
    growth: FactorBeta
    rates_us: FactorBeta
    rates_no: FactorBeta
    inflation_region: str
    tilt: str

    @property
    def betas(self) -> list[FactorBeta]:
        return [self.inflation, self.growth, self.rates_us, self.rates_no]


def _factor_points(db: Session, key: str, since: date, *, yoy: bool = False) -> list[tuple[date, Decimal]]:
    points = stored_points(db, key, since=since)
    return yoy_series(points) if yoy else points


def cycle_profile_from_history(
    db: Session, ticker: str, history: TickerHistory, *, trading_currency: str
) -> CycleProfile:
    settings = get_settings()
    min_months = settings.dalio_min_months
    region = HOME_REGION_BY_CURRENCY.get(trading_currency, "US")
    cpi_key = "no_cpi_yoy" if region == "NO" else "us_cpi_yoy"
    since = date(1900, 1, 1)
    returns = monthly_returns_pct(history.points) if history.available else {}
    note = history.reason
    if not history.available:
        note = f"no price history: {history.reason}"

    inflation = ols_beta(
        returns, monthly_changes(_factor_points(db, cpi_key, since, yoy=True)),
        factor_key="inflation", factor_label=f"Inflation ({region} CPI y/y, monthly change)", min_months=min_months,
    )
    growth = ols_beta(
        returns, monthly_changes(_factor_points(db, "us_unemployment", since), sign=-1),
        factor_key="growth", factor_label="Growth (minus the monthly change in US unemployment)", min_months=min_months,
    )
    rates_us = ols_beta(
        returns, monthly_changes(_factor_points(db, "us_10y", since)),
        factor_key="rates_us", factor_label="US 10-year yield (monthly change)", min_months=min_months,
    )
    rates_no = ols_beta(
        returns, monthly_changes(_factor_points(db, "no_10y", since)),
        factor_key="rates_no", factor_label="Norway 10-year yield (monthly change)", min_months=min_months,
    )
    return CycleProfile(
        ticker=ticker,
        history_note=note,
        inflation=inflation,
        growth=growth,
        rates_us=rates_us,
        rates_no=rates_no,
        inflation_region=region,
        tilt=quadrant_tilt(inflation, growth),
    )


def cycle_profile(
    db: Session, provider: MarketDataProvider | None, *, ticker: str, trading_currency: str
) -> CycleProfile:
    settings = get_settings()
    if provider is None:
        history = TickerHistory(ticker=ticker, available=False, reason="no market-data provider configured")
    else:
        history = get_or_refresh_daily_history(
            db, provider, ticker=ticker, currency_hint=trading_currency,
            lookback_days=settings.dalio_price_history_days,
        )
    return cycle_profile_from_history(db, ticker, history, trading_currency=trading_currency)


@dataclass
class CorrelationContribution:
    ticker: str
    owned: bool
    weighted_avg_correlation: Decimal | None = None  # value-weighted vs the other positions
    peers_counted: int = 0
    most_correlated: list[tuple[str, str, Decimal]] = field(default_factory=list)  # (ticker, name, corr)
    least_correlated: list[tuple[str, str, Decimal]] = field(default_factory=list)
    reason: str | None = None


def correlation_contribution(
    db: Session,
    provider: MarketDataProvider | None,
    *,
    ticker: str,
    trading_currency: str,
    positions: list[tuple[str, str, str, Decimal]],  # (ticker, name, currency, weight_pct) of the whole portfolio
) -> CorrelationContribution:
    owned = any(t == ticker for t, _n, _c, _w in positions)
    result = CorrelationContribution(ticker=ticker, owned=owned)
    others = [(t, n, c, w) for t, n, c, w in positions if t != ticker]
    if not others:
        result.reason = "no other positions in the portfolio to compare with"
        return result
    if provider is None:
        result.reason = "no market-data provider configured"
        return result
    settings = get_settings()
    lookback = settings.risk_correlation_lookback_days
    histories: dict[str, TickerHistory] = {
        ticker: get_or_refresh_daily_history(db, provider, ticker=ticker, currency_hint=trading_currency, lookback_days=lookback)
    }
    for t, _n, c, _w in others:
        if t not in histories:
            histories[t] = get_or_refresh_daily_history(db, provider, ticker=t, currency_hint=c, lookback_days=lookback)
    matrix = build_correlation_matrix(histories, lookback_days=lookback)
    if ticker not in matrix.tickers:
        excluded = next((e.reason for e in matrix.excluded if e.ticker == ticker), "not enough price history")
        result.reason = excluded
        return result
    pairs: list[tuple[str, str, Decimal, Decimal]] = []
    for t, n, _c, w in others:
        corr = matrix.get(ticker, t)
        if corr is not None:
            pairs.append((t, n, corr, w))
    if not pairs:
        result.reason = "no other position has enough overlapping price history"
        return result
    total_w = sum(w for *_x, w in pairs)
    if total_w > 0:
        result.weighted_avg_correlation = (sum(c * w for _t, _n, c, w in pairs) / total_w).quantize(Decimal("0.01"))
    else:
        result.weighted_avg_correlation = (sum(c for _t, _n, c, _w in pairs) / len(pairs)).quantize(Decimal("0.01"))
    result.peers_counted = len(pairs)
    ranked = sorted(pairs, key=lambda p: p[2], reverse=True)
    result.most_correlated = [(t, n, c) for t, n, c, _w in ranked[:3]]
    result.least_correlated = [(t, n, c) for t, n, c, _w in ranked[::-1][:3]]
    return result
