"""Integration tests for /analysis/* — full FastAPI TestClient stack, with
every live-data dependency (LLM, market data, risk-free rate, research)
overridden by fakes (see tests/integration/conftest.py for the shared
`client`/`db_session` fixtures)."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.domain.analysis_schema import BlindPassOutputV1, ReconciliationOutputV1
from app.main import app
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.base import (
    FxRate,
    LLMResponse,
    LLMUnavailableError,
    LLMUsageMetrics,
    PricePoint,
    RiskFreeRate,
)
from app.providers.factory import (
    get_llm_fallback_provider,
    get_llm_provider,
    get_market_data_provider,
    get_research_provider,
    get_risk_free_rate_provider,
)

D = Decimal

_VERDICT = {
    "rating": "Hold",
    "thesis_bullets": ["a", "b", "c"],
    "top_risks": ["r1", "r2"],
    "metrics_to_monitor": ["m1"],
    "invalidation_triggers": ["t1"],
    "evidence_ids": ["EV-001"],
}


def _blind_json() -> str:
    return BlindPassOutputV1(
        moat={
            "circle_of_competence_summary": "Simple business.",
            "overall_rating": "Narrow",
            "sources": [{"source": "brand", "rating": "Narrow", "reasoning": "ok", "evidence_ids": ["EV-001"]}],
            "evidence_ids": ["EV-001"],
        },
        capital_efficiency={"summary": "fine", "evidence_ids": ["EV-001"]},
        financial_fortress={"summary": "fine", "evidence_ids": ["EV-001"]},
        macro_stress_test={"summary": "fine", "evidence_ids": ["EV-001"]},
        valuation_synthesis={"summary": "fine", "evidence_ids": ["EV-001"]},
        verdict=_VERDICT,
    ).model_dump_json()


def _reconciliation_json() -> str:
    return ReconciliationOutputV1(
        verdict=_VERDICT, reconciliation_narrative="unchanged", changed_from_blind=False, evidence_ids=["EV-001"]
    ).model_dump_json()


class _FakeLLM:
    name = "fake_llm"

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        content = _blind_json() if response_schema is BlindPassOutputV1 else _reconciliation_json()
        return LLMResponse(content=content, usage=LLMUsageMetrics(provider=self.name, model="fake-model", input_tokens=1, output_tokens=1, total_tokens=2))


class _FailingLLM:
    name = "failing_llm"

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        raise LLMUnavailableError("simulated outage")


class _FakeMarket:
    name = "fake"

    def get_current_price(self, ticker, *, currency_hint=None):
        return PricePoint(price=D("100"), currency="USD", observed_at=datetime.now(timezone.utc), provider="fake")

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover
        raise NotImplementedError

    def get_fx_rate(self, from_currency, to_currency):
        return FxRate(from_currency=from_currency, to_currency=to_currency, rate=D("1"), observed_at=datetime.now(timezone.utc), provider="fake")

    def get_beta(self, ticker):
        return D("1.0")


class _FakeRate:
    def get_risk_free_rate(self, currency):
        return RiskFreeRate(currency=currency, rate=D("4.0"), observed_at=datetime.now(timezone.utc), provider="fake", source_series_id="FAKE10Y")


class _FakeResearch:
    name = "fake"

    def get_macro_research(self):
        return []

    def get_sector_research(self, sector):
        return []

    def get_company_research(self, *, company_name, ticker, sector):
        return []


def _override_providers(*, llm=None, llm_fallback=None):
    app.dependency_overrides[get_llm_provider] = lambda: (llm or _FakeLLM())
    app.dependency_overrides[get_llm_fallback_provider] = lambda: llm_fallback
    app.dependency_overrides[get_market_data_provider] = lambda: _FakeMarket()
    app.dependency_overrides[get_risk_free_rate_provider] = lambda: _FakeRate()
    app.dependency_overrides[get_research_provider] = lambda: _FakeResearch()


def _clear_overrides():
    for dep in (get_llm_provider, get_llm_fallback_provider, get_market_data_provider, get_risk_free_rate_provider, get_research_provider):
        app.dependency_overrides.pop(dep, None)


def _create_stock_holding(client, db_session, ticker="AAPL") -> str:
    response = client.post("/holdings", json={"ticker": ticker, "name": "Apple Inc.", "trading_currency": "USD", "sector": "Information Technology"})
    assert response.status_code == 201, response.text
    holding_id = response.json()["id"]
    holding = db_session.get(Holding, holding_id)
    holding.asset_class_raw = "stock"
    db_session.commit()
    return holding_id


def _add_two_periods(db_session, holding_id: str) -> None:
    from app.models.document import Document

    holding = db_session.get(Holding, holding_id)
    document = Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="documents/10k.pdf", sha256="b" * 64, status="processed", quality_flags={},
    )
    db_session.add(document)
    db_session.flush()
    for period, net_income, equity in (("FY2024", "100", "500"), ("FY2025", "120", "550")):
        for metric, value in {
            "net_income": net_income, "total_equity": equity,
            "depreciation_and_amortization": "10", "capital_expenditures": "5", "shares_outstanding": "10",
        }.items():
            db_session.add(FinancialLineItem(document=document, holding=holding, metric=metric, value=D(value), unit="USD", currency="USD", period=period, confidence=0.9))
    db_session.commit()


def test_run_analysis_full_flow(client, db_session):
    holding_id = _create_stock_holding(client, db_session)
    _add_two_periods(db_session, holding_id)
    _override_providers()
    try:
        response = client.post(f"/analysis/holdings/{holding_id}/run")
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["status"] == "COMPLETED"
        assert body["blind_pass"]["verdict"]["rating"] == "Hold"
        assert body["reconciliation"]["verdict"]["rating"] == "Hold"
        assert body["price_target_low"] is not None

        get_response = client.get(f"/analysis/holdings/{holding_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == body["id"]
    finally:
        _clear_overrides()


def test_get_latest_analysis_404_before_any_run(client, db_session):
    holding_id = _create_stock_holding(client, db_session)
    response = client.get(f"/analysis/holdings/{holding_id}")
    assert response.status_code == 404


def test_run_rejects_non_equity_holding(client, db_session):
    response = client.post("/holdings", json={"ticker": "BND", "name": "Bond Fund", "trading_currency": "USD"})
    assert response.status_code == 201, response.text
    holding_id = response.json()["id"]
    holding = db_session.get(Holding, holding_id)
    holding.asset_class_raw = "bond_fund"
    db_session.commit()

    _override_providers()
    try:
        response = client.post(f"/analysis/holdings/{holding_id}/run")
        assert response.status_code == 422
    finally:
        _clear_overrides()


def test_notes_get_default_then_put_roundtrip(client, db_session):
    holding_id = _create_stock_holding(client, db_session)

    empty = client.get(f"/analysis/holdings/{holding_id}/notes")
    assert empty.status_code == 200
    assert empty.json()["content"] == ""
    assert empty.json()["updated_at"] is None

    put_response = client.put(f"/analysis/holdings/{holding_id}/notes", json={"content": "Watching margin trends."})
    assert put_response.status_code == 200
    assert put_response.json()["content"] == "Watching margin trends."
    assert put_response.json()["updated_at"] is not None

    get_response = client.get(f"/analysis/holdings/{holding_id}/notes")
    assert get_response.json()["content"] == "Watching margin trends."


def test_run_analysis_with_no_fallback_returns_failed_run_not_a_500(client, db_session):
    holding_id = _create_stock_holding(client, db_session)
    _add_two_periods(db_session, holding_id)
    _override_providers(llm=_FailingLLM())
    try:
        response = client.post(f"/analysis/holdings/{holding_id}/run")
        assert response.status_code == 201
        assert response.json()["status"] == "FAILED"
    finally:
        _clear_overrides()


def test_run_output_includes_evidence_items_for_citations(client, db_session):
    holding_id = _create_stock_holding(client, db_session)
    _add_two_periods(db_session, holding_id)
    _override_providers()
    try:
        body = client.post(f"/analysis/holdings/{holding_id}/run").json()
    finally:
        _clear_overrides()
    ids = {item["id"] for item in body["evidence_items"]}
    assert "EV-001" in ids  # the fake verdict cites EV-001; the UI must be able to resolve it
    first = next(item for item in body["evidence_items"] if item["id"] == "EV-001")
    assert first["label"] and first["content"]


def test_readiness_endpoint_reports_without_any_provider(client, db_session):
    """No provider overrides at all: readiness must never touch a live
    provider, so it works even when those are misconfigured."""
    holding_id = _create_stock_holding(client, db_session)
    response = client.get(f"/analysis/holdings/{holding_id}/readiness")
    assert response.status_code == 200, response.text
    body = response.json()
    keys = {check["key"] for check in body["checks"]}
    assert {"instrument_type", "providers", "ticker", "price", "financials", "sector", "research", "quota"} <= keys
    assert body["ready"] is False  # no financials yet
    assert body["blockers"] >= 1
    assert body["estimated_gemini_calls"] >= 2


def test_readiness_404_for_unknown_holding(client):
    response = client.get("/analysis/holdings/00000000-0000-0000-0000-000000000000/readiness")
    assert response.status_code == 404


# --- Sprint 5B: local worker queue (F8 + F5) ---


def test_queue_endpoint_needs_no_provider_and_hides_pending_from_latest(client, db_session):
    """No provider overrides: queueing must never touch an LLM/research/market
    provider on the server."""
    holding_id = _create_stock_holding(client, db_session)
    response = client.post(f"/analysis/holdings/{holding_id}/queue")
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] == "QUEUED" and body["engine"] == "local" and body["ticker"] == "AAPL"

    # a second click returns the same run
    again = client.post(f"/analysis/holdings/{holding_id}/queue")
    assert again.json()["id"] == body["id"]

    # a queued run is not "the latest analysis"
    assert client.get(f"/analysis/holdings/{holding_id}").status_code == 404

    queue_body = client.get("/analysis/queue").json()
    assert [r["id"] for r in queue_body["pending"]] == [body["id"]]
    assert queue_body["workers"] == [] and queue_body["any_worker_online"] is False


def test_pending_local_run_does_not_hide_previous_verdict(client, db_session):
    holding_id = _create_stock_holding(client, db_session)
    _add_two_periods(db_session, holding_id)
    _override_providers()
    try:
        done = client.post(f"/analysis/holdings/{holding_id}/run").json()
    finally:
        _clear_overrides()
    client.post(f"/analysis/holdings/{holding_id}/queue")
    latest = client.get(f"/analysis/holdings/{holding_id}").json()
    assert latest["id"] == done["id"] and latest["engine"] == "cloud"


def test_queue_rejects_non_equity(client, db_session):
    holding_id = _create_stock_holding(client, db_session)
    holding = db_session.get(Holding, holding_id)
    holding.asset_class_raw = "bond_fund"
    db_session.commit()
    assert client.post(f"/analysis/holdings/{holding_id}/queue").status_code == 422


def test_cancel_queued_run_then_conflict(client, db_session):
    holding_id = _create_stock_holding(client, db_session)
    run_id = client.post(f"/analysis/holdings/{holding_id}/queue").json()["id"]
    cancelled = client.post(f"/analysis/runs/{run_id}/cancel")
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "CANCELLED"
    assert client.post(f"/analysis/runs/{run_id}/cancel").status_code == 409
    assert client.get("/analysis/queue").json()["pending"] == []
    assert client.post("/analysis/runs/00000000-0000-0000-0000-000000000000/cancel").status_code == 404


def test_queue_shows_online_worker_and_readiness_check(client, db_session):
    from app.services.analysis import queue as analysis_queue

    holding_id = _create_stock_holding(client, db_session)
    analysis_queue.record_heartbeat(db_session, "DESKTOP-1", state="idle", model_name="qwen3:14b")
    body = client.get("/analysis/queue").json()
    assert body["any_worker_online"] is True
    assert body["workers"][0]["worker_id"] == "DESKTOP-1"

    checks = {c["key"]: c for c in client.get(f"/analysis/holdings/{holding_id}/readiness").json()["checks"]}
    assert checks["local_worker"]["status"] == "ok"


def test_queue_ready_holdings_endpoint_with_nothing_owned(client):
    body = client.post("/analysis/queue/ready-holdings").json()
    assert body == {"queued": [], "already_queued": [], "skipped": []}


def test_run_refreshes_stale_macro_data_and_cites_it(client, db_session):
    """2026-09-24: stale macro series are fetched before the run (not
    during it) and land in the packet as macro_indicator items (v5)."""
    from datetime import datetime, timedelta, timezone

    from app.providers.factory import get_macro_data_provider_or_none
    from app.providers.macro_data_providers import MacroDataProvider, MacroPoint

    class _Macro(MacroDataProvider):
        name = "fake"
        calls = 0

        def fetch(self, spec, start):
            _Macro.calls += 1
            return [MacroPoint(datetime.now(timezone.utc).date() - timedelta(days=1), D("4.25"))]

    holding_id = _create_stock_holding(client, db_session)
    _add_two_periods(db_session, holding_id)
    _override_providers()
    app.dependency_overrides[get_macro_data_provider_or_none] = lambda: _Macro()
    try:
        body = client.post(f"/analysis/holdings/{holding_id}/run").json()
    finally:
        _clear_overrides()
    assert body["status"] == "COMPLETED"
    assert body["evidence_packet_version"] == "v7"
    assert _Macro.calls == 13
    macro_items = [i for i in body["evidence_items"] if i["category"] == "macro_indicator"]
    policy = next(i for i in macro_items if i["label"] == "Norges Bank policy rate (NO)")
    assert "4.25%" in policy["content"] and "IR/B.KPRA.SD.R" in policy["citation"]
