"""Integration tests for GET /performance/portfolio (Sprint 13). Market
data is a fake; no real yfinance call is made."""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from app.main import app
from app.providers.base import MarketDataUnavailableError, PricePoint
from app.providers.factory import get_market_data_provider

D = Decimal
TODAY = datetime.now(timezone.utc).date()


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


def _points_ending_today(n: int, *, start_price=D("100"), step=D("0"), currency="NOK") -> list[PricePoint]:
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


def _override(market) -> None:
    app.dependency_overrides[get_market_data_provider] = lambda: market


def _clear_overrides() -> None:
    app.dependency_overrides.pop(get_market_data_provider, None)


def _create_holding(client, ticker, name="Test Co", currency="NOK"):
    response = client.post("/holdings", json={"ticker": ticker, "name": name, "trading_currency": currency})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _add_position(db_session, holding_id, value_nok):
    from app.models.holding import Holding
    from app.models.document import Document
    from app.models.portfolio import PortfolioPosition, PortfolioSnapshot

    holding = db_session.get(Holding, holding_id)
    document = Document(
        type="portfolio_export", original_filename="p.csv", mime_type="text/csv", size_bytes=1,
        storage_path="p/perf.csv", sha256="b" * 64, status="processed", quality_flags={},
    )
    db_session.add(document)
    db_session.flush()
    snapshot = PortfolioSnapshot(source_file=document, reporting_currency="NOK", status="processed")
    db_session.add(snapshot)
    db_session.flush()
    db_session.add(PortfolioPosition(snapshot=snapshot, holding=holding, market_value_nok=Decimal(value_nok)))
    db_session.commit()


def test_empty_portfolio_returns_empty_performance_payload(client):
    _override(_FakeMarket())
    try:
        response = client.get("/performance/portfolio")
    finally:
        _clear_overrides()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["series"] == []
    assert body["benchmark_available"] is False
    assert body["total_return_pct"] is None
    assert "method_note" in body


def test_portfolio_with_one_holding_and_benchmark(client, db_session):
    holding_id = _create_holding(client, "EQNR")
    _add_position(db_session, holding_id, 1_000_000)

    points = _points_ending_today(30, start_price=D("100"), step=D("0"))
    bench_points = _points_ending_today(30, start_price=D("1000"), step=D("1"))
    market = _FakeMarket({"EQNR": points, "OSEBX.OL": bench_points})
    _override(market)
    try:
        response = client.get("/performance/portfolio?lookback_days=30")
    finally:
        _clear_overrides()

    assert response.status_code == 200, response.text
    body = response.json()
    assert D(body["included_value_nok"]) == D("1000000")
    assert body["benchmark_available"] is True
    assert D(body["ending_value_nok"]) == D("1000000.00")
    assert len(body["series"]) > 0
    assert any(dv["benchmark_return_pct"] is not None for dv in body["series"])


def test_holding_with_no_history_is_excluded_with_a_reason(client, db_session):
    holding_id = _create_holding(client, "NOCO")
    _add_position(db_session, holding_id, 500_000)

    _override(_FakeMarket())
    try:
        response = client.get("/performance/portfolio")
    finally:
        _clear_overrides()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["excluded"][0]["ticker"] == "NOCO"
    assert body["series"] == []


def test_refresh_endpoint_forces_a_provider_call(client, db_session):
    holding_id = _create_holding(client, "EQNR")
    _add_position(db_session, holding_id, 100_000)
    market = _FakeMarket({"EQNR": _points_ending_today(30)})
    _override(market)
    try:
        first = client.get("/performance/portfolio")
        second = client.post("/performance/portfolio/refresh")
    finally:
        _clear_overrides()

    assert first.status_code == 200
    assert second.status_code == 200
