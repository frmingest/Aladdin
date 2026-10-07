"""Price history for the Siege Simulator (2026-10-07).

The Siege Simulator (v2) measures each holding's beta from its own stored
daily closes, so those closes must be stored: for every holding you own, for
the benchmark, and for the FX pairs that convert foreign closes to NOK. The
Risk and Performance pages only store history for stocks, so funds, ETFs and
metal ETCs had none.

This runs in the PC worker (home IP, where Yahoo is reachable), never on a
page load. It reuses `get_or_refresh_daily_history`, so a ticker whose stored
history is fresher than `risk_price_history_stale_after_hours` costs a database
read and no vendor call. One ticker failing never stops the others; each
failure is reported with its reason.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.domain.game_mapping.siege_scenarios_v1 import SiegeScenarios
from app.providers.base import MarketDataProvider
from app.services.portfolio_overview import build_overview
from app.services.risk.price_history import get_or_refresh_daily_history

log = logging.getLogger("aladdin.sensitivity_history")

BASE_CURRENCY = "NOK"


@dataclass
class SensitivityHistoryResult:
    fetched: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)

    def summary(self) -> str:
        parts = [f"history for {len(self.fetched)} tickers"]
        if self.problems:
            parts.append("; ".join(self.problems[:4]) + (f" (+{len(self.problems) - 4} more)" if len(self.problems) > 4 else ""))
        return " — ".join(parts)


def wanted_tickers(db: Session, scenarios: SiegeScenarios) -> dict[str, str | None]:
    """ticker -> currency hint, for everything the v2 simulator reads."""
    wanted: dict[str, str | None] = {scenarios.benchmark_ticker: BASE_CURRENCY}
    currencies: set[str] = set()
    for p in build_overview(db).positions:
        if not p.value_nok:
            continue
        wanted.setdefault(p.ticker, p.trading_currency)
        if p.trading_currency and p.trading_currency.upper() != BASE_CURRENCY:
            currencies.add(p.trading_currency.upper())
    for currency in sorted(currencies):
        wanted.setdefault(f"{currency}NOK=X", None)
    return wanted


def refresh_sensitivity_history(
    db: Session,
    provider: MarketDataProvider,
    scenarios: SiegeScenarios,
    *,
    force: bool = False,
) -> SensitivityHistoryResult:
    result = SensitivityHistoryResult()
    if scenarios.sensitivity_method != "benchmark_downside_beta":
        return result  # v1 scenarios read vendor betas only; nothing to fetch
    for ticker, currency in wanted_tickers(db, scenarios).items():
        try:
            history = get_or_refresh_daily_history(
                db,
                provider,
                ticker=ticker,
                currency_hint=currency,
                lookback_days=scenarios.history_lookback_days,
                force=force,
            )
        except Exception as exc:
            db.rollback()
            log.warning("history for %s failed", ticker, exc_info=True)
            result.problems.append(f"{ticker}: {exc}")
            continue
        if history.available:
            result.fetched.append(ticker)
            if history.reason:
                result.problems.append(f"{ticker}: {history.reason}")
        else:
            result.problems.append(f"{ticker}: {history.reason or 'no history'}")
    return result
