"""Real historical-price correlation matrix + correlated-risk-cluster flag
(Sprint 12). CLAUDE.md Rule 1: every number here is plain Decimal
arithmetic over stored daily closes (app/services/risk/price_history.py);
nothing is a sector/category proxy and nothing is computed by the LLM.

Lookback window: 1 year of daily returns (`risk_correlation_lookback_days`
= 365, app/config/settings.py) — long enough that single-name noise and a
handful of illiquid trading days average out, short enough to reflect the
portfolio's *current* co-movement regime rather than one from years ago
that may no longer hold (correlations between assets are not stable over
long horizons).

Two tickers don't necessarily trade on the same calendar days (different
exchange holidays), so correlation is computed on the INTERSECTION of the
two tickers' own trading days, not a naive zip of two lists — a pair with
too little genuine overlap (< MIN_OVERLAP_DAYS) is excluded with a stated
reason rather than silently computed on a handful of points.
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.services.calculations import pearson_correlation
from app.services.risk.price_history import TickerHistory

# A ticker needs at least this many stored daily closes to be considered
# for correlation at all (below this, a single stale/illiquid quote could
# dominate the "return" series).
MIN_PRICE_POINTS = 30
# A pair needs at least this many days where BOTH tickers have a computable
# return (i.e. both traded on that day and the prior one) to be correlated.
MIN_OVERLAP_DAYS = 40


@dataclass
class ExcludedTicker:
    ticker: str
    reason: str


@dataclass
class CorrelationPair:
    ticker_a: str
    ticker_b: str
    correlation: Decimal
    overlap_days: int


@dataclass
class CorrelationResult:
    lookback_days: int
    tickers: list[str] = field(default_factory=list)  # tickers included in the matrix, in input order
    pairs: list[CorrelationPair] = field(default_factory=list)  # one entry per unordered pair, a != b
    excluded: list[ExcludedTicker] = field(default_factory=list)

    def get(self, a: str, b: str) -> Decimal | None:
        if a == b:
            return Decimal(1) if a in self.tickers else None
        for p in self.pairs:
            if {p.ticker_a, p.ticker_b} == {a, b}:
                return p.correlation
        return None


def _returns_by_date(points: list[tuple[date, Decimal]]) -> dict[date, Decimal]:
    """{date: same-day return computed from the previous stored trading
    day's close}. Uses each ticker's OWN calendar, not a shared one."""
    returns: dict[date, Decimal] = {}
    for (_prev_date, prev_close), (curr_date, curr_close) in itertools.pairwise(points):
        if prev_close <= 0:
            continue
        returns[curr_date] = (curr_close - prev_close) / prev_close
    return returns


def build_correlation_matrix(
    histories: dict[str, TickerHistory], *, lookback_days: int
) -> CorrelationResult:
    result = CorrelationResult(lookback_days=lookback_days)
    returns_by_ticker: dict[str, dict[date, Decimal]] = {}

    for ticker, history in histories.items():
        if not history.available:
            result.excluded.append(ExcludedTicker(ticker, history.reason or "price history unavailable"))
            continue
        if len(history.points) < MIN_PRICE_POINTS:
            result.excluded.append(
                ExcludedTicker(
                    ticker,
                    f"only {len(history.points)} stored daily closes, fewer than the {MIN_PRICE_POINTS} needed",
                )
            )
            continue
        returns_by_ticker[ticker] = _returns_by_date(history.points)
        result.tickers.append(ticker)

    for i, a in enumerate(result.tickers):
        for b in result.tickers[i + 1 :]:
            common_dates = sorted(set(returns_by_ticker[a]) & set(returns_by_ticker[b]))
            if len(common_dates) < MIN_OVERLAP_DAYS:
                result.excluded.append(
                    ExcludedTicker(
                        f"{a}/{b}",
                        f"only {len(common_dates)} overlapping trading days, fewer than the {MIN_OVERLAP_DAYS} needed",
                    )
                )
                continue
            x = [returns_by_ticker[a][d] for d in common_dates]
            y = [returns_by_ticker[b][d] for d in common_dates]
            try:
                corr = pearson_correlation(x, y)
            except ValueError as exc:
                result.excluded.append(ExcludedTicker(f"{a}/{b}", str(exc)))
                continue
            result.pairs.append(CorrelationPair(a, b, corr.quantize(Decimal("0.01")), len(common_dates)))

    return result


@dataclass
class ClusterFlag:
    tickers: list[str]
    names: list[str]
    correlation: Decimal
    combined_weight_pct: Decimal


def correlated_clusters(
    *,
    top_holdings: list[tuple[str, str, Decimal]],  # (ticker, name, weight_pct), largest first
    correlation: CorrelationResult,
    threshold: Decimal,
    max_candidates: int = 10,
) -> list[ClusterFlag]:
    """Among the `max_candidates` largest positions, flag every pair whose
    |correlation| >= `threshold` — concentration risk (a large position)
    and co-movement risk (a correlated position) combined into one
    explicit finding, rather than two numbers Faiz has to combine himself.
    """
    candidates = top_holdings[:max_candidates]
    flags: list[ClusterFlag] = []
    for i, (ticker_a, name_a, weight_a) in enumerate(candidates):
        for ticker_b, name_b, weight_b in candidates[i + 1 :]:
            corr = correlation.get(ticker_a, ticker_b)
            if corr is None or abs(corr) < threshold:
                continue
            flags.append(
                ClusterFlag(
                    tickers=[ticker_a, ticker_b],
                    names=[name_a, name_b],
                    correlation=corr,
                    combined_weight_pct=weight_a + weight_b,
                )
            )
    flags.sort(key=lambda f: -abs(f.correlation))
    return flags
