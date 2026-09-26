"""Spot-price + FX history for physical gold/silver (2026-09-26).

Reuses app/services/risk/price_history.py's `get_or_refresh_daily_history`
(Sprint 12) completely unchanged, for two different series:

- The metal's own USD spot price (app/providers/gold_api_provider.py),
  ticker "XAUUSD"/"XAGUSD" — these tickers are new to
  price_history_observations and start empty; history accumulates one day
  at a time from whenever this feature is first used (see that provider's
  docstring for why — gold-api.com's free tier has no historical data).
- USD/NOK, ticker "USDNOK=X" — the exact same ticker
  app/services/performance/portfolio_performance.py (Sprint 13) already
  uses for FX via yfinance, so this typically already has deep history by
  the time metals tracking is turned on; no new fetch pattern.
"""
from __future__ import annotations

from app.config.settings import get_settings
from app.domain.precious_metals import SPOT_TICKER
from app.providers.base import MarketDataProvider
from app.services.risk.price_history import TickerHistory, get_or_refresh_daily_history

USD_NOK_TICKER = "USDNOK=X"


def get_metal_spot_history_usd(
    db, metal_provider: MarketDataProvider, *, metal: str, force: bool = False
) -> TickerHistory:
    settings = get_settings()
    return get_or_refresh_daily_history(
        db,
        metal_provider,
        ticker=SPOT_TICKER[metal],
        currency_hint="USD",
        lookback_days=settings.precious_metals_price_history_days_default,
        force=force,
    )


def get_usd_nok_history(db, fx_provider: MarketDataProvider, *, force: bool = False) -> TickerHistory:
    settings = get_settings()
    return get_or_refresh_daily_history(
        db,
        fx_provider,
        ticker=USD_NOK_TICKER,
        currency_hint=None,
        lookback_days=settings.precious_metals_price_history_days_default,
        force=force,
    )


def get_price_history_nok(
    db, metal_provider: MarketDataProvider, fx_provider: MarketDataProvider, *, metal: str, force: bool = False
) -> list[tuple]:
    """Daily XAU/NOK or XAG/NOK price, oldest first, as (date, price_nok)
    tuples — the intersection of whatever days both the metal's USD spot
    history and the USD/NOK history actually have (each is fetched/cached
    independently, so their date sets aren't guaranteed identical,
    especially early on while the metal series is still thin — see
    app/providers/gold_api_provider.py's docstring)."""
    spot_hist = get_metal_spot_history_usd(db, metal_provider, metal=metal, force=force)
    if not spot_hist.available or not spot_hist.points:
        return []
    fx_hist = get_usd_nok_history(db, fx_provider, force=force)
    if not fx_hist.available or not fx_hist.points:
        return []
    fx_by_date = dict(fx_hist.points)
    return [
        (observed_on, price_usd * fx_by_date[observed_on])
        for observed_on, price_usd in spot_hist.points
        if observed_on in fx_by_date
    ]
