"""Portfolio performance over time (Sprint 13, 2026-09-27): daily value
history and a benchmark comparison for GET /performance/portfolio
(app/api/performance.py).

Reuses rather than reimplements (CLAUDE.md, and Sprint 12's own precedent):
position value/weight comes from app/services/portfolio_overview.py's
build_overview (the same "currently owned" rule as every other view,
including app/services/risk/portfolio_risk.py), and daily price history is
the *very same* cache Sprint 12 introduced
(app/models/risk.py's PriceHistoryObservation via
app/services/risk/price_history.py's get_or_refresh_daily_history) — no
new table, no new migration. FX rate history reuses the identical cache,
keyed by yfinance's own FX ticker convention ("USDNOK=X" — see
app/providers/yfinance_provider.py's module docstring): the table is a
plain (ticker, date) -> close cache with no notion of what kind of ticker
it is, so a currency pair or a benchmark index ticker fits it exactly like
an equity ticker does.

APPROXIMATION — stated plainly rather than buried, and always returned in
`method_note`: this reindexes each position's *today's* NOK value backward
through that ticker's own price history and the FX rate history, i.e. "if
you had held exactly today's positions the whole time, what would this
portfolio have been worth on each past day". It is NOT a real historical
P&L across actual past buys/sells — PortfolioSnapshot only stores
point-in-time uploads (whatever CSV Faiz last imported), not a continuous
transaction history, so a true buy/sell-aware P&L isn't computable from
what's stored today (see claude/progress.md §3c: "Historical price/FX and
performance").

Fail-visibly (CLAUDE.md): a ticker or FX pair with no usable history is
excluded from the series with a stated reason, never guessed. Days before
every included position has data are still shown (so the chart isn't
truncated to whatever the newest holding's history covers) but are marked
`partial=True` and carry no return_pct/daily_pnl_nok, since a return
computed against an understated starting value would be misleading.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES
from app.providers.base import MarketDataProvider
from app.services.portfolio_overview import Overview, build_overview
from app.services.risk.price_history import get_or_refresh_daily_history

ZERO = Decimal(0)
HUNDRED = Decimal(100)

METHOD_NOTE = (
    "Reindexes each holding's current NOK value through its own price and FX history "
    "(today's positions held constant across the window) — not a real past-transaction "
    "P&L, since only point-in-time portfolio snapshots are stored here, not a continuous "
    "buy/sell history."
)


def _fx_ticker(currency: str) -> str:
    """yfinance's own FX ticker convention (app/providers/yfinance_provider.py's
    module docstring) — kept in one place."""
    return f"{currency.upper()}NOK=X"


@dataclass
class DailyValue:
    on: date
    portfolio_value_nok: Decimal
    partial: bool  # True while at least one included position has no data yet for this day
    portfolio_return_pct: Decimal | None  # cumulative since full_coverage_from; None while partial
    daily_pnl_nok: Decimal | None  # None on the first covered day and every partial day
    benchmark_return_pct: Decimal | None = None


@dataclass
class ExcludedHolding:
    ticker: str
    name: str
    reason: str


@dataclass
class PortfolioPerformance:
    as_of: datetime | None
    lookback_days: int
    equity_value_nok: Decimal
    included_value_nok: Decimal
    covered_pct: Decimal | None  # included_value_nok / equity_value_nok * 100
    full_coverage_from: date | None
    starting_value_nok: Decimal | None
    ending_value_nok: Decimal | None
    total_return_pct: Decimal | None
    best_day: DailyValue | None
    worst_day: DailyValue | None
    benchmark_ticker: str
    benchmark_available: bool
    benchmark_reason: str | None
    excluded: list[ExcludedHolding] = field(default_factory=list)
    method_note: str = METHOD_NOTE
    series: list[DailyValue] = field(default_factory=list)


def _business_days(start: date, end: date) -> list[date]:
    days: list[date] = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


def _forward_fill(points: list[tuple[date, Decimal]], axis: list[date]) -> dict[date, Decimal]:
    """Last known value on or before each axis day. A day strictly before
    the series' first stored point is left unfilled (no earlier close to
    carry forward) rather than invented as zero or the first value."""
    out: dict[date, Decimal] = {}
    idx = 0
    n = len(points)
    last: Decimal | None = None
    for day in axis:
        while idx < n and points[idx][0] <= day:
            last = points[idx][1]
            idx += 1
        if last is not None:
            out[day] = last
    return out


def _empty_result(
    *, overview: Overview, lookback_days: int, equity_value_nok: Decimal, covered_pct: Decimal | None,
    benchmark_ticker: str, excluded: list[ExcludedHolding], reason: str,
) -> PortfolioPerformance:
    return PortfolioPerformance(
        as_of=overview.as_of,
        lookback_days=lookback_days,
        equity_value_nok=equity_value_nok,
        included_value_nok=ZERO,
        covered_pct=covered_pct,
        full_coverage_from=None,
        starting_value_nok=None,
        ending_value_nok=None,
        total_return_pct=None,
        best_day=None,
        worst_day=None,
        benchmark_ticker=benchmark_ticker,
        benchmark_available=False,
        benchmark_reason=reason,
        excluded=excluded,
    )


def build_portfolio_performance(
    db: Session,
    *,
    market_data_provider: MarketDataProvider,
    lookback_days: int | None = None,
    benchmark_ticker: str | None = None,
    force_refresh: bool = False,
) -> PortfolioPerformance:
    settings = get_settings()
    lookback_days = min(
        lookback_days or settings.performance_lookback_days_default,
        settings.performance_max_lookback_days,
    )
    benchmark_ticker = (benchmark_ticker or settings.performance_default_benchmark_ticker).strip().upper()

    overview: Overview = build_overview(db)
    positions = [
        p for p in overview.positions if p.instrument_type in EQUITY_ANALYZABLE_TYPES and p.value_nok
    ]
    equity_value_nok = overview.equity_value_nok or ZERO

    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=lookback_days)
    axis = _business_days(start, today)
    if not axis:
        return _empty_result(
            overview=overview, lookback_days=lookback_days, equity_value_nok=equity_value_nok,
            covered_pct=None, benchmark_ticker=benchmark_ticker, excluded=[],
            reason="no business days in the requested window",
        )
    anchor_day = axis[-1]

    excluded: list[ExcludedHolding] = []
    fx_cache: dict[str, dict[date, Decimal]] = {}
    # (value_nok as of today, today's unit value, forward-filled unit-by-date)
    included: list[tuple[Decimal, Decimal, dict[date, Decimal]]] = []
    included_value_nok = ZERO

    for p in positions:
        history = get_or_refresh_daily_history(
            db,
            market_data_provider,
            ticker=p.ticker,
            currency_hint=p.trading_currency,
            lookback_days=lookback_days,
            force=force_refresh,
        )
        if not history.available or len(history.points) < 2:
            excluded.append(ExcludedHolding(p.ticker, p.name, history.reason or "no daily price history"))
            continue

        currency = (history.currency or p.trading_currency or "NOK").upper()
        if currency == "NOK":
            fx_filled: dict[date, Decimal] = {d: Decimal(1) for d in axis}
        else:
            pair = _fx_ticker(currency)
            if pair not in fx_cache:
                fx_hist = get_or_refresh_daily_history(
                    db,
                    market_data_provider,
                    ticker=pair,
                    currency_hint=None,
                    lookback_days=lookback_days,
                    force=force_refresh,
                )
                fx_cache[pair] = _forward_fill(fx_hist.points, axis) if fx_hist.available else {}
            fx_filled = fx_cache[pair]
            if not fx_filled:
                excluded.append(ExcludedHolding(p.ticker, p.name, f"no FX history for {pair}"))
                continue

        price_filled = _forward_fill(history.points, axis)
        unit: dict[date, Decimal] = {}
        for d in axis:
            price_d = price_filled.get(d)
            fx_d = fx_filled.get(d)
            if price_d is not None and fx_d is not None:
                unit[d] = price_d * fx_d

        anchor = unit.get(anchor_day)
        if not anchor:
            excluded.append(ExcludedHolding(p.ticker, p.name, "no price/FX data as of the latest day"))
            continue

        value_nok = p.value_nok or ZERO
        included_value_nok += value_nok
        included.append((value_nok, anchor, unit))

    covered_pct = (
        (included_value_nok / equity_value_nok * HUNDRED).quantize(Decimal("0.1"))
        if equity_value_nok > 0
        else None
    )

    if not included:
        return _empty_result(
            overview=overview, lookback_days=lookback_days, equity_value_nok=equity_value_nok,
            covered_pct=covered_pct, benchmark_ticker=benchmark_ticker, excluded=excluded,
            reason="no holding had usable price/FX history",
        )

    full_coverage_from = max(min(unit) for _v, _a, unit in included)

    # Benchmark: same generic cache, a plain price-return series — no FX
    # conversion needed since only its own % return is used, never its
    # absolute price in whatever currency the index is quoted in.
    benchmark_available = False
    benchmark_reason: str | None = None
    benchmark_unit: dict[date, Decimal] = {}
    bench_history = get_or_refresh_daily_history(
        db,
        market_data_provider,
        ticker=benchmark_ticker,
        currency_hint=None,
        lookback_days=lookback_days,
        force=force_refresh,
    )
    if bench_history.available and len(bench_history.points) >= 2:
        benchmark_unit = _forward_fill(bench_history.points, axis)
        benchmark_available = bool(benchmark_unit)
        if not benchmark_available:
            benchmark_reason = "no benchmark data overlapping this window"
    else:
        benchmark_reason = bench_history.reason or "benchmark ticker unavailable"

    benchmark_base_day = min(benchmark_unit) if benchmark_unit else None
    compare_from = max(full_coverage_from, benchmark_base_day) if benchmark_base_day else None
    if benchmark_available and benchmark_base_day and benchmark_base_day > full_coverage_from:
        benchmark_reason = (
            f"benchmark history only starts {benchmark_base_day.isoformat()}; "
            "comparison starts there rather than at full portfolio coverage"
        )
    benchmark_base = benchmark_unit.get(compare_from) if compare_from else None

    # --- Daily totals ---
    totals: dict[date, tuple[Decimal, bool]] = {}  # day -> (value_nok, complete)
    for d in axis:
        total = ZERO
        complete = True
        for value_nok, anchor, unit in included:
            u = unit.get(d)
            if u is None:
                complete = False
                continue
            total += value_nok * (u / anchor)
        totals[d] = (total, complete)

    base_value = totals[full_coverage_from][0] if totals[full_coverage_from][0] else None

    series: list[DailyValue] = []
    prev_covered_value: Decimal | None = None
    for d in axis:
        value_nok, complete = totals[d]
        return_pct: Decimal | None = None
        pnl: Decimal | None = None
        bench_pct: Decimal | None = None
        if complete and base_value:
            return_pct = ((value_nok / base_value - 1) * HUNDRED).quantize(Decimal("0.01"))
            if prev_covered_value is not None:
                pnl = (value_nok - prev_covered_value).quantize(Decimal("0.01"))
            prev_covered_value = value_nok
            if benchmark_available and benchmark_base and compare_from and d >= compare_from:
                bu = benchmark_unit.get(d)
                if bu is not None:
                    bench_pct = ((bu / benchmark_base - 1) * HUNDRED).quantize(Decimal("0.01"))
        series.append(
            DailyValue(
                on=d, portfolio_value_nok=value_nok.quantize(Decimal("0.01")), partial=not complete,
                portfolio_return_pct=return_pct, daily_pnl_nok=pnl, benchmark_return_pct=bench_pct,
            )
        )

    covered_days = [dv for dv in series if dv.daily_pnl_nok is not None]
    best_day = max(covered_days, key=lambda dv: dv.daily_pnl_nok) if covered_days else None
    worst_day = min(covered_days, key=lambda dv: dv.daily_pnl_nok) if covered_days else None
    ending = series[-1] if series else None
    starting_dv = next((dv for dv in series if not dv.partial), None)

    return PortfolioPerformance(
        as_of=overview.as_of,
        lookback_days=lookback_days,
        equity_value_nok=equity_value_nok,
        included_value_nok=included_value_nok,
        covered_pct=covered_pct,
        full_coverage_from=full_coverage_from,
        starting_value_nok=starting_dv.portfolio_value_nok if starting_dv else None,
        ending_value_nok=ending.portfolio_value_nok if ending else None,
        total_return_pct=ending.portfolio_return_pct if ending else None,
        best_day=best_day,
        worst_day=worst_day,
        benchmark_ticker=benchmark_ticker,
        benchmark_available=benchmark_available,
        benchmark_reason=benchmark_reason,
        excluded=excluded,
        series=series,
    )
