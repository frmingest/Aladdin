"""Integration tests for GET /risk/portfolio (Sprint 12). Market data and
risk-free-rate providers are fakes; no real yfinance/FRED call is made,
and no financial-statement facts are uploaded (so no holding gets a DCF —
this exercises the volatility-based stress path and the "insufficient
price history" exclusion path, which don't need one)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.main import app
from app.providers.base import (
    MarketDataUnavailableError,
    PricePoint,
    RiskFreeRateUnavailableError,
)
from app.providers.factory import get_market_data_provider, get_risk_free_rate_provider

D = Decimal


class _FakeMarket:
    name = "fake"

    def __init__(self, daily_history: dict[str, list[PricePoint]] | None = None):
        self._daily_history = daily_history or {}

    def get_current_price(self, ticker, *, currency_hint=None):
        raise MarketDataUnavailableError("not configured for this test")

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover - unused
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


class _FakeRiskFreeRate:
    def get_risk_free_rate(self, currency):
        raise RiskFreeRateUnavailableError("not configured for this test")


def _daily_points(n: int, *, start_price=D("100"), step=D("1")) -> list[PricePoint]:
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    out, price = [], start_price
    for i in range(n):
        out.append(PricePoint(price=price, currency="USD", observed_at=base + timedelta(days=i), provider="fake"))
        price = price + step
    return out


def _override(market=None, rate=None) -> None:
    if market is not None:
        app.dependency_overrides[get_market_data_provider] = lambda: market
    if rate is not None:
        app.dependency_overrides[get_risk_free_rate_provider] = lambda: rate


def _clear_overrides() -> None:
    app.dependency_overrides.pop(get_market_data_provider, None)
    app.dependency_overrides.pop(get_risk_free_rate_provider, None)


def _create_holding(client, ticker, name="Test Co"):
    response = client.post("/holdings", json={"ticker": ticker, "name": name, "trading_currency": "USD"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


_SNAPSHOT_CACHE: dict[int, object] = {}


def _shared_snapshot(db_session):
    """current_positions() (app/services/valuation/board.py) keeps only the
    LATEST snapshot per account, and snapshots with no account all share
    one group — so every position in a test portfolio with no accounts
    must live in the SAME snapshot, not one each."""
    key = id(db_session)
    if key in _SNAPSHOT_CACHE:
        return _SNAPSHOT_CACHE[key]
    from app.models.document import Document
    from app.models.portfolio import PortfolioSnapshot

    document = Document(
        type="portfolio_export", original_filename="p.csv", mime_type="text/csv", size_bytes=1,
        storage_path="p/shared.csv", sha256="a" * 64, status="processed", quality_flags={},
    )
    db_session.add(document)
    db_session.flush()
    snapshot = PortfolioSnapshot(source_file=document, reporting_currency="NOK", status="processed")
    db_session.add(snapshot)
    db_session.flush()
    _SNAPSHOT_CACHE[key] = snapshot
    return snapshot


def _add_position(db_session, holding_id, value_nok):
    from app.models.holding import Holding
    from app.models.portfolio import PortfolioPosition

    holding = db_session.get(Holding, holding_id)
    snapshot = _shared_snapshot(db_session)
    db_session.add(PortfolioPosition(snapshot=snapshot, holding=holding, market_value_nok=Decimal(value_nok)))
    db_session.commit()


def test_empty_portfolio_returns_empty_risk_payload(client):
    _override(_FakeMarket(), _FakeRiskFreeRate())
    try:
        response = client.get("/risk/portfolio")
    finally:
        _clear_overrides()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["as_of"] is None
    assert body["correlation"]["tickers"] == []
    assert body["clusters"] == []
    assert body["stress"]["holdings"] == []
    assert body["regime"]["regime"] in ("baseline", "stagflation", "crisis")


def test_portfolio_with_two_correlated_holdings_and_one_with_no_history(client, db_session):
    holding_a = _create_holding(client, "AAA")
    holding_b = _create_holding(client, "BBB")
    holding_c = _create_holding(client, "CCC")
    _add_position(db_session, holding_a, 500_000)
    _add_position(db_session, holding_b, 300_000)
    _add_position(db_session, holding_c, 200_000)

    closes_a = [p.price for p in _daily_points(60)]
    points_a = _daily_points(60)
    points_b = [
        PricePoint(price=c * 2, currency="USD", observed_at=p.observed_at, provider="fake")
        for p, c in zip(points_a, closes_a)
    ]
    market = _FakeMarket({"AAA": points_a, "BBB": points_b})  # CCC has no configured history
    _override(market, _FakeRiskFreeRate())
    try:
        response = client.get("/risk/portfolio")
    finally:
        _clear_overrides()

    assert response.status_code == 200, response.text
    body = response.json()

    assert set(body["correlation"]["tickers"]) == {"AAA", "BBB"}
    excluded_keys = {e["key"] for e in body["correlation"]["excluded"]}
    assert "CCC" in excluded_keys

    pair = body["correlation"]["pairs"][0]
    assert {pair["ticker_a"], pair["ticker_b"]} == {"AAA", "BBB"}
    assert round(float(pair["correlation"]), 2) == 1.0

    # AAA (500k) + BBB (300k) are both in the top holdings and near-perfectly
    # correlated -> should be flagged as a cluster.
    assert len(body["clusters"]) == 1
    assert set(body["clusters"][0]["tickers"]) == {"AAA", "BBB"}

    # No holding has a DCF (no financial facts uploaded), so AAA/BBB use the
    # volatility path and CCC (no price history at all) is "unavailable" --
    # never a 500, never a silently invented number.
    stress_by_ticker = {h["ticker"]: h for h in body["stress"]["holdings"]}
    assert stress_by_ticker["AAA"]["method"] == "volatility"
    assert stress_by_ticker["CCC"]["method"] == "unavailable"
    assert stress_by_ticker["CCC"]["shock_pct"] is None
    assert stress_by_ticker["CCC"]["reason"] is not None


def test_refresh_endpoint_forces_a_provider_call(client, db_session):
    holding_id = _create_holding(client, "AAA")
    _add_position(db_session, holding_id, 100_000)
    market = _FakeMarket({"AAA": _daily_points(60)})
    _override(market, _FakeRiskFreeRate())
    try:
        first = client.get("/risk/portfolio")
        second = client.post("/risk/portfolio/refresh")
    finally:
        _clear_overrides()

    assert first.status_code == 200
    assert second.status_code == 200
