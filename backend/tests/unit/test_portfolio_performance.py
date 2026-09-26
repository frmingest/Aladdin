"""Unit tests for app/services/performance/portfolio_performance.py's
reindexing method: NOK/FX conversion, exclusion of holdings with no usable
history, the partial-day flag while coverage is still filling in, and the
benchmark comparison — against an in-memory SQLite DB and a fake market
data provider (no real yfinance call)."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.domain.instrument_types import STOCK
from app.models import Base
from app.models.document import Document
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.base import MarketDataUnavailableError, PricePoint
from app.services.performance.portfolio_performance import build_portfolio_performance

D = Decimal
TODAY = datetime.now(timezone.utc).date()


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _FakeMarket:
    name = "fake"

    def __init__(self, daily_history: dict[str, list[PricePoint]] | None = None):
        self._daily_history = daily_history or {}

    def get_current_price(self, ticker, *, currency_hint=None):
        raise MarketDataUnavailableError("not configured for this test")

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover
        raise NotImplementedError

    def get_fx_rate(self, from_currency, to_currency):
        raise MarketDataUnavailableError("not configured for this test")

    def get_beta(self, ticker):
        return None

    def get_daily_price_history(self, ticker, *, days=400, currency_hint=None):
        points = self._daily_history.get(ticker)
        if not points:
            raise MarketDataUnavailableError(f"no daily history configured for {ticker!r}")
        return points


def _points_ending_today(
    n: int, *, start_price: Decimal = D("100"), step: Decimal = D("1"), currency: str = "USD"
) -> list[PricePoint]:
    """n consecutive calendar days of closes, the last one dated today —
    build_portfolio_performance anchors every series to "today" (the most
    recent business day <= today), so a fake series needs a point that
    reaches it."""
    out, price = [], start_price
    for i in range(n):
        d = TODAY - timedelta(days=(n - 1 - i))
        out.append(
            PricePoint(
                price=price, currency=currency,
                observed_at=datetime.combine(d, time(12, 0), tzinfo=timezone.utc), provider="fake",
            )
        )
        price = price + step
    return out


def _holding(db: Session, ticker: str, *, currency: str = "USD") -> Holding:
    h = Holding(ticker=ticker, name=f"{ticker} Inc", trading_currency=currency, asset_class_raw=STOCK)
    db.add(h)
    db.flush()
    return h


def _snapshot(db: Session) -> PortfolioSnapshot:
    document = Document(
        type="portfolio_export", original_filename="p.csv", mime_type="text/csv", size_bytes=1,
        storage_path="p/test.csv", sha256="a" * 64, status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    snap = PortfolioSnapshot(source_file=document, reporting_currency="NOK", status="processed")
    db.add(snap)
    db.flush()
    return snap


def _position(db: Session, snap: PortfolioSnapshot, holding: Holding, value_nok) -> None:
    db.add(PortfolioPosition(snapshot=snap, holding=holding, market_value_nok=Decimal(value_nok)))
    db.commit()


def test_empty_portfolio_reports_no_holding_had_history():
    db = _session()
    result = build_portfolio_performance(db, market_data_provider=_FakeMarket())

    assert result.series == []
    assert not result.benchmark_available
    assert result.total_return_pct is None


def test_single_nok_holding_reindexes_flat_when_price_is_flat():
    db = _session()
    holding = _holding(db, "EQNR", currency="NOK")
    snap = _snapshot(db)
    _position(db, snap, holding, 1_000_000)

    points = _points_ending_today(60, start_price=D("100"), step=D("0"), currency="NOK")
    market = _FakeMarket({"EQNR": points})

    result = build_portfolio_performance(db, market_data_provider=market, lookback_days=90)

    assert result.included_value_nok == D("1000000")
    assert result.covered_pct == D("100.0")
    assert result.total_return_pct == D("0.00")
    assert result.ending_value_nok == D("1000000.00")
    # flat price -> every covered day has ~0 return and ~0 daily P&L
    covered = [dv for dv in result.series if not dv.partial]
    assert covered
    assert all(dv.portfolio_return_pct == D("0.00") for dv in covered)


def test_holding_with_no_price_history_is_excluded_not_crashed():
    db = _session()
    holding = _holding(db, "NOCO", currency="NOK")
    snap = _snapshot(db)
    _position(db, snap, holding, 500_000)

    result = build_portfolio_performance(db, market_data_provider=_FakeMarket(), lookback_days=90)

    assert result.series == []
    assert len(result.excluded) == 1
    assert result.excluded[0].ticker == "NOCO"
    assert result.covered_pct == D("0.0")


def test_usd_holding_is_converted_through_fx_history():
    db = _session()
    holding = _holding(db, "AAPL", currency="USD")
    snap = _snapshot(db)
    _position(db, snap, holding, 100_000)  # today's real NOK value, already FX-converted at import

    # One point per calendar day, comfortably longer than the lookback window,
    # so every business day on the axis lands on an exact stored point (no
    # forward-fill ambiguity) and the test doesn't depend on which weekday
    # "today" happens to be.
    lookback = 10
    span = lookback + 5
    price_points = _points_ending_today(span, start_price=D("50"), step=D("1"), currency="USD")
    fx_points = _points_ending_today(span, start_price=D("10"), step=D("0.1"), currency="NOK")
    price_by_date = {p.observed_at.date(): p.price for p in price_points}
    fx_by_date = {p.observed_at.date(): p.price for p in fx_points}

    market = _FakeMarket({"AAPL": price_points, "USDNOK=X": fx_points})
    result = build_portfolio_performance(db, market_data_provider=market, lookback_days=lookback)

    covered = [dv for dv in result.series if not dv.partial]
    assert covered
    # The service anchors to the axis's last day, which is the most recent
    # BUSINESS day <= today — not necessarily today itself (e.g. if today
    # is a weekend) — so anchor on the result's own last series entry
    # rather than assuming it equals the real calendar TODAY.
    anchor_date = covered[-1].on
    anchor_unit = price_by_date[anchor_date] * fx_by_date[anchor_date]
    for dv in covered:
        expected_unit = price_by_date[dv.on] * fx_by_date[dv.on]
        expected_value = (D("100000") * expected_unit / anchor_unit).quantize(D("0.01"))
        assert dv.portfolio_value_nok == expected_value
    assert covered[-1].portfolio_value_nok == D("100000.00")


def test_two_holdings_with_different_history_lengths_mark_early_days_partial():
    db = _session()
    long_h = _holding(db, "LONG", currency="NOK")
    short_h = _holding(db, "SHORT", currency="NOK")
    snap = _snapshot(db)
    _position(db, snap, long_h, 600_000)
    _position(db, snap, short_h, 400_000)

    long_points = _points_ending_today(60, start_price=D("100"), step=D("0"), currency="NOK")
    short_points = _points_ending_today(5, start_price=D("100"), step=D("0"), currency="NOK")
    market = _FakeMarket({"LONG": long_points, "SHORT": short_points})

    result = build_portfolio_performance(db, market_data_provider=market, lookback_days=90)

    assert result.full_coverage_from is not None
    partial_days = [dv for dv in result.series if dv.partial]
    covered_days = [dv for dv in result.series if not dv.partial]
    assert partial_days  # some early business days are SHORT-only-missing
    assert covered_days
    assert all(dv.portfolio_return_pct is None for dv in partial_days)
    assert all(dv.portfolio_return_pct is not None for dv in covered_days)


def test_benchmark_unavailable_is_reported_not_fatal():
    db = _session()
    holding = _holding(db, "EQNR", currency="NOK")
    snap = _snapshot(db)
    _position(db, snap, holding, 1_000_000)
    points = _points_ending_today(30, start_price=D("100"), step=D("0"), currency="NOK")
    market = _FakeMarket({"EQNR": points})  # no benchmark ticker configured

    result = build_portfolio_performance(
        db, market_data_provider=market, lookback_days=30, benchmark_ticker="OSEBX.OL"
    )

    assert not result.benchmark_available
    assert result.benchmark_reason is not None
    assert all(dv.benchmark_return_pct is None for dv in result.series)


def test_benchmark_comparison_computed_when_available():
    db = _session()
    holding = _holding(db, "EQNR", currency="NOK")
    snap = _snapshot(db)
    _position(db, snap, holding, 1_000_000)
    points = _points_ending_today(10, start_price=D("100"), step=D("1"), currency="NOK")
    bench_points = _points_ending_today(10, start_price=D("1000"), step=D("10"), currency="NOK")
    market = _FakeMarket({"EQNR": points, "OSEBX.OL": bench_points})

    result = build_portfolio_performance(
        db, market_data_provider=market, lookback_days=10, benchmark_ticker="OSEBX.OL"
    )

    assert result.benchmark_available
    covered = [dv for dv in result.series if not dv.partial and dv.benchmark_return_pct is not None]
    assert covered
    assert covered[-1].benchmark_return_pct > 0  # benchmark rose over the window
