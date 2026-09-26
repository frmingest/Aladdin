"""Unit tests for app/services/risk/correlation.py: the correlation matrix
built from synthetic TickerHistory data (known-answer prices, no network),
insufficient-history exclusion, and the correlated-cluster flag."""
from datetime import date, timedelta
from decimal import Decimal

from app.services.risk.correlation import (
    MIN_OVERLAP_DAYS,
    MIN_PRICE_POINTS,
    build_correlation_matrix,
    correlated_clusters,
)
from app.services.risk.price_history import TickerHistory

D = Decimal


def _history(ticker: str, closes: list[Decimal], *, start: date = date(2026, 1, 1)) -> TickerHistory:
    points = [(start + timedelta(days=i), c) for i, c in enumerate(closes)]
    return TickerHistory(ticker=ticker, available=True, currency="USD", points=points)


def _series(n: int, generator) -> list[Decimal]:
    return [D(str(generator(i))) for i in range(n)]


def test_perfectly_correlated_tickers_score_one():
    # B is always exactly 2x A's price -> identical daily returns -> r = 1.
    closes_a = _series(MIN_PRICE_POINTS + 50, lambda i: 100 + i)
    closes_b = [c * 2 for c in closes_a]
    histories = {"A": _history("A", closes_a), "B": _history("B", closes_b)}

    result = build_correlation_matrix(histories, lookback_days=365)

    assert result.tickers == ["A", "B"]
    assert not result.excluded
    corr = result.get("A", "B")
    assert corr is not None
    assert round(corr, 2) == D("1.00")


def test_uncorrelated_random_walk_and_alternating_series():
    # A trends steadily up; B alternates flat/down with no relation to A.
    closes_a = _series(MIN_PRICE_POINTS + 20, lambda i: 100 + i)
    closes_b = _series(MIN_PRICE_POINTS + 20, lambda i: 50 + (5 if i % 2 == 0 else -5))
    histories = {"A": _history("A", closes_a), "B": _history("B", closes_b)}

    result = build_correlation_matrix(histories, lookback_days=365)
    corr = result.get("A", "B")
    assert corr is not None
    assert abs(corr) < D("0.3")


def test_ticker_with_too_little_history_is_excluded_with_reason():
    closes_a = _series(MIN_PRICE_POINTS + 5, lambda i: 100 + i)
    closes_short = _series(5, lambda i: 10 + i)
    histories = {"A": _history("A", closes_a), "SHORT": _history("SHORT", closes_short)}

    result = build_correlation_matrix(histories, lookback_days=365)

    assert result.tickers == ["A"]
    reasons = {e.ticker: e.reason for e in result.excluded}
    assert "SHORT" in reasons
    assert "fewer than the 30 needed" in reasons["SHORT"]


def test_unavailable_ticker_is_excluded_not_crashed_on():
    closes_a = _series(MIN_PRICE_POINTS + 5, lambda i: 100 + i)
    histories = {
        "A": _history("A", closes_a),
        "DELISTED": TickerHistory(ticker="DELISTED", available=False, reason="yfinance has no data"),
    }

    result = build_correlation_matrix(histories, lookback_days=365)

    assert result.tickers == ["A"]
    reasons = {e.ticker: e.reason for e in result.excluded}
    assert reasons["DELISTED"] == "yfinance has no data"


def test_non_overlapping_trading_calendars_are_excluded_as_a_pair():
    closes_a = _series(MIN_PRICE_POINTS + 10, lambda i: 100 + i)
    # B's history starts a year later than A's -> zero overlapping dates.
    closes_b = _series(MIN_PRICE_POINTS + 10, lambda i: 50 + i)
    histories = {
        "A": _history("A", closes_a, start=date(2020, 1, 1)),
        "B": _history("B", closes_b, start=date(2026, 1, 1)),
    }

    result = build_correlation_matrix(histories, lookback_days=3650)

    assert result.tickers == ["A", "B"]
    assert result.get("A", "B") is None
    pair_reasons = {e.ticker: e.reason for e in result.excluded}
    assert "A/B" in pair_reasons
    assert f"fewer than the {MIN_OVERLAP_DAYS} needed" in pair_reasons["A/B"]


def test_correlated_clusters_flags_highly_correlated_top_holdings():
    closes_a = _series(MIN_PRICE_POINTS + 50, lambda i: 100 + i)
    closes_b = [c * 3 for c in closes_a]  # identical returns -> r = 1
    closes_c = _series(MIN_PRICE_POINTS + 50, lambda i: 50 + (5 if i % 2 == 0 else -5))  # uncorrelated
    histories = {"A": _history("A", closes_a), "B": _history("B", closes_b), "C": _history("C", closes_c)}
    correlation = build_correlation_matrix(histories, lookback_days=365)

    top_holdings = [("A", "Alpha Corp", D("25")), ("B", "Beta Corp", D("20")), ("C", "Gamma Corp", D("10"))]
    flags = correlated_clusters(top_holdings=top_holdings, correlation=correlation, threshold=D("0.6"))

    assert len(flags) == 1
    flag = flags[0]
    assert set(flag.tickers) == {"A", "B"}
    assert flag.combined_weight_pct == D("45")
    assert flag.correlation >= D("0.6")


def test_correlated_clusters_empty_when_nothing_crosses_threshold():
    closes_a = _series(MIN_PRICE_POINTS + 5, lambda i: 100 + i)
    closes_c = _series(MIN_PRICE_POINTS + 5, lambda i: 50 + (5 if i % 2 == 0 else -5))
    histories = {"A": _history("A", closes_a), "C": _history("C", closes_c)}
    correlation = build_correlation_matrix(histories, lookback_days=365)

    top_holdings = [("A", "Alpha Corp", D("25")), ("C", "Gamma Corp", D("10"))]
    flags = correlated_clusters(top_holdings=top_holdings, correlation=correlation, threshold=D("0.6"))
    assert flags == []
