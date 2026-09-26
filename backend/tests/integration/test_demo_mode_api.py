"""Integration tests for demo mode (2026-09-26) — see
app/services/settings/{demo_mode,demo_guard,synthetic_data}.py and
app/api/settings.py.

Covers: (a) the settings endpoint round-trips, (b) with demo mode on,
every protected GET returns the fixed fabricated ticker set rather than
real seeded data, (c) every mutating endpoint across the whole API
returns 403 while demo mode is on, (d) the demo-mode PUT endpoint itself
still works while demo mode is on (so it can be turned back off).
"""
from __future__ import annotations

import io
from decimal import Decimal

from app.main import app
from app.providers.base import (
    FxRate,
    LLMUsageMetrics,
    PricePoint,
    RiskFreeRate,
)
from app.providers.factory import (
    get_esef_index_provider_or_none,
    get_fundamentals_provider_or_none,
    get_llm_fallback_provider,
    get_llm_provider,
    get_market_data_provider,
    get_metal_price_provider,
    get_research_provider,
    get_risk_free_rate_provider,
)

D = Decimal

DEMO_TICKERS = {"AAPL", "MSFT", "GOOGL", "JNJ", "PG", "KO", "JPM", "V", "HD", "XOM"}


# --- Fakes for the live-data dependencies some mutating endpoints still
# declare (so their `require_not_demo(db)` guard is what we're actually
# exercising, not a 503 from an unconfigured provider dependency). ---


class _FakeMarket:
    name = "fake"

    def get_price(self, ticker, currency=None):
        return PricePoint(price=D("100"), currency="USD", as_of=None)

    def get_fx_rate(self, base, quote):
        return FxRate(rate=D("10"), as_of=None)

    def get_beta(self, ticker):
        return D("1.0")

    def get_shares_outstanding(self, ticker):
        return None


class _FakeRate:
    name = "fake"

    def get_risk_free_rate(self, *_a, **_kw):
        return RiskFreeRate(rate_pct=D("4"), as_of=None, tenor_years=10)


class _FakeResearch:
    name = "fake"

    def search(self, *_a, **_kw):
        return []


class _FakeLLM:
    name = "fake"

    def generate_structured(self, *_a, **_kw):
        raise AssertionError("must not be called — demo mode blocks the write first")

    def usage_metrics(self):
        return LLMUsageMetrics(input_tokens=0, output_tokens=0)


def _override_live_providers():
    app.dependency_overrides[get_llm_provider] = lambda: _FakeLLM()
    app.dependency_overrides[get_llm_fallback_provider] = lambda: None
    app.dependency_overrides[get_market_data_provider] = lambda: _FakeMarket()
    app.dependency_overrides[get_risk_free_rate_provider] = lambda: _FakeRate()
    app.dependency_overrides[get_research_provider] = lambda: _FakeResearch()
    app.dependency_overrides[get_metal_price_provider] = lambda: _FakeMarket()
    app.dependency_overrides[get_fundamentals_provider_or_none] = lambda: None
    app.dependency_overrides[get_esef_index_provider_or_none] = lambda: None


def _enable_demo(client) -> None:
    response = client.put("/settings/demo-mode", json={"enabled": True})
    assert response.status_code == 200, response.text
    assert response.json() == {"demo_mode": True}


def _seed_real_holding(client) -> str:
    response = client.post(
        "/holdings",
        json={
            "ticker": "REAL1",
            "name": "Real Seeded Holding",
            "trading_currency": "USD",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


NIL_UUID = "00000000-0000-0000-0000-000000000000"


# --- (a) settings endpoint round-trip -----------------------------------


def test_demo_mode_defaults_off(client):
    response = client.get("/settings/demo-mode")
    assert response.status_code == 200
    assert response.json() == {"demo_mode": False}


def test_demo_mode_round_trips(client):
    assert client.get("/settings/demo-mode").json() == {"demo_mode": False}
    _enable_demo(client)
    assert client.get("/settings/demo-mode").json() == {"demo_mode": True}
    response = client.put("/settings/demo-mode", json={"enabled": False})
    assert response.status_code == 200
    assert response.json() == {"demo_mode": False}
    assert client.get("/settings/demo-mode").json() == {"demo_mode": False}


# --- (d) the demo-mode endpoint itself is never blocked by its own guard ---


def test_demo_mode_endpoint_still_works_while_demo_is_on(client):
    _enable_demo(client)
    response = client.put("/settings/demo-mode", json={"enabled": False})
    assert response.status_code == 200, response.text
    assert response.json() == {"demo_mode": False}


# --- (b) demo mode on: protected GETs return fixed fabricated data,
# never the real seeded holding. ---------------------------------------


def test_holdings_list_returns_only_fabricated_tickers_in_demo_mode(client):
    real_id = _seed_real_holding(client)
    _enable_demo(client)

    response = client.get("/holdings")
    assert response.status_code == 200
    tickers = {h["ticker"] for h in response.json()}
    assert tickers == DEMO_TICKERS
    assert "REAL1" not in tickers
    assert all(h["id"] != real_id for h in response.json())


def test_get_real_holding_by_id_404s_in_demo_mode(client):
    real_id = _seed_real_holding(client)
    _enable_demo(client)
    response = client.get(f"/holdings/{real_id}")
    assert response.status_code == 404


def test_portfolio_overview_is_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/portfolio/overview")
    assert response.status_code == 200
    body = response.json()
    tickers = {p["ticker"] for p in body["positions"]}
    assert tickers == DEMO_TICKERS
    assert body["holding_count"] == 10


def test_accounts_are_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/accounts")
    assert response.status_code == 200
    names = {a["name"] for a in response.json()}
    assert names == {"Demo Nordnet ASK", "Demo Nordnet Investment"}


def test_valuation_board_is_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/valuation/board")
    assert response.status_code == 200
    tickers = {r["ticker"] for r in response.json()["rows"]}
    assert tickers == DEMO_TICKERS


def test_watchlist_is_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/watchlist")
    assert response.status_code == 200
    tickers = {r["ticker"] for r in response.json()["rows"]}
    assert tickers == {"NVDA", "COST"}


def test_journal_is_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/journal")
    assert response.status_code == 200
    tickers = {e["ticker"] for e in response.json()["entries"]}
    assert tickers == {"AAPL", "MSFT", "XOM"}


def test_precious_metals_overview_is_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/precious-metals/overview")
    assert response.status_code == 200
    metals = {h["metal"] for h in response.json()["holdings"]}
    assert metals == {"gold", "silver"}


def test_macro_indicators_are_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/macro/indicators")
    assert response.status_code == 200
    assert response.json()["series_version"] == "demo"


def test_system_status_shows_demo_mode_flag(client):
    response = client.get("/system/status")
    assert response.status_code == 200
    assert response.json()["demo_mode"] is False

    _enable_demo(client)
    response = client.get("/system/status")
    assert response.status_code == 200
    assert response.json()["demo_mode"] is True


def test_thesis_monitor_is_fabricated_in_demo_mode(client):
    _enable_demo(client)
    response = client.get("/thesis/monitor")
    assert response.status_code == 200
    tickers = {r["ticker"] for r in response.json()["rows"]}
    assert tickers == DEMO_TICKERS


def test_risk_and_performance_are_fabricated_in_demo_mode(client):
    _enable_demo(client)
    risk = client.get("/risk/portfolio")
    assert risk.status_code == 200
    assert set(risk.json()["correlation"]["tickers"]) == DEMO_TICKERS

    perf = client.get("/performance/portfolio")
    assert perf.status_code == 200
    assert perf.json()["method_note"]


# --- (c) every mutating endpoint 403s while demo mode is on ---------------


def test_documents_sources_research_funds_are_blocked_outright_in_demo_mode(client):
    _enable_demo(client)
    assert client.get("/documents").status_code == 403
    assert client.get(f"/documents/{NIL_UUID}").status_code == 403
    assert client.get(f"/sources/holdings/{NIL_UUID}").status_code == 403
    assert client.get(f"/research/holdings/{NIL_UUID}").status_code == 403
    assert client.get("/research/macro").status_code == 403
    assert client.get(f"/funds/{NIL_UUID}").status_code == 403


def test_every_mutating_endpoint_is_blocked_in_demo_mode(client):
    """Exhaustive per CLAUDE.md/the spec: every POST/PUT/PATCH/DELETE across
    the whole API, other than PUT /settings/demo-mode itself, must 403
    while demo mode is on. Payloads are minimal but schema-valid, since
    `require_not_demo` runs as the endpoint's first statement — before any
    404/FK lookup — so a well-typed body is enough to reach it."""
    _override_live_providers()
    _enable_demo(client)

    u = NIL_UUID
    calls = [
        # accounts
        ("post", "/accounts", {"json": {"name": "x", "account_number": "1"}}),
        ("patch", f"/accounts/{u}", {"json": {"name": "x"}}),
        ("delete", f"/accounts/{u}", {"params": {"confirm": True}}),
        # holdings
        (
            "post",
            "/holdings",
            {"json": {"ticker": "X", "name": "X", "trading_currency": "USD"}},
        ),
        ("patch", f"/holdings/{u}", {"json": {"name": "x"}}),
        ("delete", "/holdings/all", {"params": {"confirm": True}}),
        ("delete", f"/holdings/{u}/documents", {"params": {"confirm": True}}),
        ("delete", f"/holdings/{u}", {"params": {"confirm": True}}),
        (
            "put",
            f"/holdings/{u}/share-count",
            {"json": {"shares": "1", "as_of": "2026-01-01T00:00:00Z"}},
        ),
        ("delete", f"/holdings/{u}/share-count", {"params": {"confirm": True}}),
        # portfolio
        (
            "post",
            "/portfolio/snapshots",
            {"json": {"source_file_id": u, "reporting_currency": "USD"}},
        ),
        ("get", "/portfolio/snapshots", {}),
        ("get", f"/portfolio/snapshots/{u}", {}),
        ("delete", f"/portfolio/snapshots/{u}", {"params": {"confirm": True}}),
        ("delete", "/portfolio/all", {"params": {"confirm": True}}),
        ("post", f"/portfolio/snapshots/{u}/positions", {"json": {"holding_id": u}}),
        (
            "delete",
            f"/portfolio/snapshots/{u}/positions/{u}",
            {"params": {"confirm": True}},
        ),
        ("get", f"/portfolio/snapshots/{u}/concentration", {}),
        # valuation
        ("post", f"/valuation/holdings/{u}/refresh", {}),
        # analysis
        ("post", f"/analysis/holdings/{u}/run", {}),
        ("post", f"/analysis/holdings/{u}/queue", {}),
        ("post", "/analysis/queue/ready-holdings", {}),
        ("post", f"/analysis/runs/{u}/cancel", {}),
        ("put", f"/analysis/holdings/{u}/notes", {"json": {"content": "x"}}),
        # thesis
        (
            "post",
            f"/thesis/holdings/{u}/tripwires",
            {"json": {"metric": "price", "operator": "below", "threshold": "1"}},
        ),
        ("patch", f"/thesis/tripwires/{u}", {"json": {"active": False}}),
        ("post", f"/thesis/tripwires/{u}/acknowledge", {}),
        ("delete", f"/thesis/tripwires/{u}", {"params": {"confirm": True}}),
        # risk / performance refresh
        ("post", "/risk/portfolio/refresh", {}),
        ("post", "/performance/portfolio/refresh", {}),
        # precious metals
        ("post", "/precious-metals/overview/refresh", {}),
        (
            "post",
            "/precious-metals",
            {"json": {"coin_series": "american_gold_eagle_1oz", "quantity": "1"}},
        ),
        ("patch", f"/precious-metals/{u}", {"json": {"quantity": "2"}}),
        ("delete", f"/precious-metals/{u}", {}),
        # journal
        (
            "post",
            "/journal",
            {
                "json": {
                    "holding_id": u,
                    "action": "buy",
                    "decided_on": "2026-01-01",
                    "thesis": "x",
                }
            },
        ),
        ("patch", f"/journal/{u}", {"json": {"thesis": "y"}}),
        ("delete", f"/journal/{u}", {"params": {"confirm": True}}),
        # watchlist
        ("post", "/watchlist", {"json": {"holding_id": u}}),
        ("patch", f"/watchlist/{u}", {"json": {"notes": "x"}}),
        ("delete", f"/watchlist/{u}", {"params": {"confirm": True}}),
        # macro
        ("post", "/macro/indicators/refresh", {}),
        # documents / sources / research / funds (already covered above too)
        ("delete", f"/documents/{u}", {"params": {"confirm": True}}),
        ("post", f"/sources/holdings/{u}/esef-index/import", {}),
        ("post", f"/sources/holdings/{u}/sec-edgar/import", {}),
        ("post", f"/sources/holdings/{u}/announcements/refresh", {}),
        ("post", "/research/macro/refresh", {}),
        ("post", "/research/sectors/technology/refresh", {}),
        ("post", f"/research/holdings/{u}/refresh", {}),
        (
            "put",
            f"/funds/{u}/profile",
            {"json": {"management_style": "active", "source_document_id": u}},
        ),
        ("put", f"/funds/{u}/returns", {"json": []}),
        (
            "put",
            f"/funds/{u}/exposures/sector",
            {"json": {"as_of_date": "2026-01-01", "source_document_id": u, "rows": []}},
        ),
        (
            "patch",
            f"/funds/{u}/exposures/{u}/link",
            {"json": {"linked_holding_id": None}},
        ),
    ]
    failures = []
    for method, path, kwargs in calls:
        response = getattr(client, method)(path, **kwargs)
        if response.status_code != 403:
            failures.append((method, path, response.status_code, response.text[:200]))

    assert not failures, f"expected 403 for every call, got: {failures}"


def test_upload_endpoints_are_blocked_in_demo_mode(client):
    _enable_demo(client)
    files = {"file": ("test.csv", io.BytesIO(b"a,b\n1,2\n"), "text/csv")}
    assert client.post("/documents/upload", files=files).status_code == 403
    assert client.post("/portfolio/import-csv", files=files).status_code == 403
    response = client.post(f"/funds/{NIL_UUID}/holdings/import", files=files)
    assert response.status_code == 403
