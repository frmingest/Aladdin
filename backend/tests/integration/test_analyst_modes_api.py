"""Epic F22 API: the whole-app mode switch (22.1), persona-aware analysis
endpoints (22.2/22.6), side-by-side (22.7), synthesis gate (22.8), the
Dalio endpoints (22.9-22.11) and their demo-mode data (22.12)."""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.analysis import EquityAnalysisRun
from app.models.holding import Holding

NIL = "00000000-0000-0000-0000-000000000000"


def _holding(db_session, **kw) -> Holding:
    fields = {"ticker": "EQNR.OL", "name": "Equinor", "trading_currency": "NOK", "asset_class_raw": "stock"}
    fields.update(kw)
    h = Holding(**fields)
    db_session.add(h)
    db_session.commit()
    return h


def _run(db_session, holding, persona, verdict):
    now = datetime.now(timezone.utc)
    if persona == "dalio":
        blind = {
            "debt_cycle": {"short_term_phase": "tightening", "long_term_phase": "late_leveraging", "summary": "s",
                           "evidence_ids": ["EV-001"]},
            "quadrant_fit": {"favoured_environments": ["rising_inflation"], "summary": "s", "evidence_ids": []},
            "currency_risk": {"summary": "s", "evidence_ids": []},
            "country_risk": {"summary": "s", "evidence_ids": []},
            "internal_external_order": {"summary": "s", "evidence_ids": []},
            "portfolio_role_and_diversification": {"summary": "s", "evidence_ids": []},
            "verdict": {"rating": verdict, "portfolio_role": "inflation_hedge", "thesis_bullets": [], "top_risks": [],
                        "metrics_to_monitor": [], "invalidation_triggers": [], "evidence_ids": []},
        }
        schema = "dalio_v1"
    else:
        blind = {
            "moat": {"circle_of_competence_summary": "c", "overall_rating": "Narrow", "sources": [], "evidence_ids": []},
            "capital_efficiency": {"summary": "s", "evidence_ids": []},
            "financial_fortress": {"summary": "s", "evidence_ids": []},
            "macro_stress_test": {"summary": "s", "evidence_ids": []},
            "valuation_synthesis": {"summary": "s", "evidence_ids": []},
            "verdict": {"rating": verdict, "thesis_bullets": [], "top_risks": [], "metrics_to_monitor": [],
                        "invalidation_triggers": [], "evidence_ids": []},
        }
        schema = "v1"
    run = EquityAnalysisRun(
        holding_id=holding.id, status="BLIND_ONLY", schema_version=schema, blind_prompt_version="x",
        evidence_packet_version="x", evidence_packet_json={"items": []}, evidence_unavailable_reasons=[],
        blind_pass_json=blind, started_at=now, blind_completed_at=now, persona=persona,
    )
    db_session.add(run)
    db_session.commit()
    return run


def test_mode_defaults_to_buffett_and_switches(client):
    body = client.get("/settings/analyst-mode").json()
    assert body["mode"] == "buffett_munger" and body["synthesis_enabled"] is False
    assert "Not business quality" in body["dalio_verdict_basis"]
    assert client.put("/settings/analyst-mode", json={"mode": "side_by_side"}).json()["mode"] == "side_by_side"
    assert client.get("/settings/analyst-mode").json()["label"] == "Side-by-side"
    assert client.put("/settings/analyst-mode", json={"mode": "soros"}).status_code == 422


def test_latest_analysis_is_per_persona(client, db_session):
    h = _holding(db_session)
    _run(db_session, h, "dalio", "Sell")
    assert client.get(f"/analysis/holdings/{h.id}").status_code == 404  # Buffett is the default
    body = client.get(f"/analysis/holdings/{h.id}", params={"persona": "dalio"}).json()
    assert body["persona"] == "dalio" and body["blind_pass"]["verdict"]["portfolio_role"] == "inflation_hedge"
    assert client.get(f"/analysis/holdings/{h.id}", params={"persona": "nope"}).status_code == 422


def test_queue_dalio_run_for_a_commodity(client, db_session):
    h = _holding(db_session, ticker="4GLD.DE", name="Xetra-Gold", trading_currency="EUR", asset_class_raw="commodity_etc")
    assert client.post(f"/analysis/holdings/{h.id}/queue").status_code == 422  # Buffett: not analyzable
    body = client.post(f"/analysis/holdings/{h.id}/queue", params={"persona": "dalio"}).json()
    assert body["persona"] == "dalio" and body["auto_queued"] is False
    pending = client.get("/analysis/queue").json()["pending"]
    assert [p["persona"] for p in pending] == ["dalio"]


def test_side_by_side_compares_deterministically(client, db_session):
    h = _holding(db_session)
    _run(db_session, h, "buffett_munger", "Buy")
    _run(db_session, h, "dalio", "Sell")
    body = client.get(f"/analysis/holdings/{h.id}/side-by-side").json()
    assert body["comparison"]["agreement"] == "disagree"
    assert body["buffett"]["persona"] == "buffett_munger" and body["dalio"]["persona"] == "dalio"
    assert body["synthesis"] is None and body["synthesis_enabled"] is False


def test_auto_queue_endpoint_only_acts_in_side_by_side(client, db_session):
    h = _holding(db_session)
    _run(db_session, h, "buffett_munger", "Buy")
    assert client.post(f"/analysis/holdings/{h.id}/auto-queue").json()["queued_count"] == 0
    client.put("/settings/analyst-mode", json={"mode": "side_by_side"})
    body = client.post(f"/analysis/holdings/{h.id}/auto-queue").json()
    assert body["queued_count"] == 1
    pending = client.get("/analysis/queue").json()["pending"]
    assert pending[0]["auto_queued"] is True and pending[0]["persona"] == "dalio"


def test_synthesis_is_off_by_default(client, db_session):
    h = _holding(db_session)
    response = client.post(f"/analysis/holdings/{h.id}/synthesis")
    assert response.status_code == 409 and "switched off" in response.json()["detail"]
    client.put("/settings/analyst-synthesis", json={"enabled": True})
    response = client.post(f"/analysis/holdings/{h.id}/synthesis")
    assert response.status_code == 409 and "needs both" in response.json()["detail"]


def test_dalio_endpoints_serve_stored_data_without_network(client, db_session):
    h = _holding(db_session)
    _run(db_session, h, "dalio", "Buy")
    board = client.get("/dalio/cycle-fit-board").json()
    assert board["rows"] == []  # not owned: the board lists owned positions only
    macro = client.get("/dalio/macro").json()
    assert {d["key"] for d in macro["derived"]} == {"us_fed_net_liquidity", "us_interest_to_receipts"}
    assert all(d["value"] is None and d["reason"] for d in macro["derived"])
    assert macro["gold_demand"]["as_of"] == "Q1 2025"
    weather = client.get("/dalio/all-weather").json()
    assert weather["positions"] == [] and weather["regime"] == "baseline"


def test_demo_mode_serves_all_three_modes(client):
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    # Switching the view stays allowed in demo mode (story 22.12).
    assert client.put("/settings/analyst-mode", json={"mode": "dalio"}).status_code == 200
    board = client.get("/dalio/cycle-fit-board").json()
    assert board["dalio_analyzed_count"] == len(board["rows"]) > 0
    hid = board["rows"][0]["holding_id"]
    dalio = client.get(f"/analysis/holdings/{hid}", params={"persona": "dalio"}).json()
    assert dalio["persona"] == "dalio" and "Demo data" in dalio["blind_pass"]["currency_risk"]["summary"]
    assert client.get(f"/analysis/holdings/{hid}/side-by-side").json()["comparison"]["agreement"] in {
        "agree", "partly_agree", "disagree"
    }
    assert client.get("/dalio/all-weather").json()["positions"]
    assert client.get("/dalio/macro").status_code == 200
    assert client.get(f"/analysis/holdings/{NIL}/side-by-side").status_code == 404


def test_synthesis_cites_prefixed_ids_and_never_touches_either_verdict(client, db_session):
    from app.domain.analysis_schema.synthesis_v1 import SynthesisOutputV1
    from app.main import app
    from app.providers.base import LLMResponse, LLMUsageMetrics
    from app.providers.factory import get_llm_provider

    class _LLM:
        name = "fake"

        def generate_structured(self, *, system_prompt, user_prompt, response_schema, max_output_tokens=None):
            assert "B:EV-001" in user_prompt and "D:EV-001" in user_prompt
            out = SynthesisOutputV1(
                agreements=[{"text": "a", "evidence_ids": ["B:EV-001", "D:EV-001"]}],
                disagreements=[{"text": "d", "evidence_ids": ["X:EV-9"]}],
                where_they_would_argue="crux",
                what_would_settle_it=[],
            )
            return LLMResponse(content=out.model_dump_json(), usage=LLMUsageMetrics(
                provider="fake", model="m", input_tokens=1, output_tokens=1, total_tokens=2))

    h = _holding(db_session)
    b = _run(db_session, h, "buffett_munger", "Buy")
    d = _run(db_session, h, "dalio", "Sell")
    for run in (b, d):
        run.evidence_packet_json = {"items": [{"id": "EV-001", "category": "c", "label": "l", "content": "x"}]}
    db_session.commit()
    before = (dict(b.blind_pass_json), dict(d.blind_pass_json))
    app.dependency_overrides[get_llm_provider] = lambda: _LLM()
    client.put("/settings/analyst-synthesis", json={"enabled": True})
    body = client.post(f"/analysis/holdings/{h.id}/synthesis").json()
    assert body["status"] == "COMPLETED"
    assert body["citation_warnings"] == ["cited unknown evidence id: X:EV-9"]
    db_session.refresh(b)
    db_session.refresh(d)
    assert (b.blind_pass_json, d.blind_pass_json) == before
    assert client.get(f"/analysis/holdings/{h.id}/side-by-side").json()["synthesis"]["output"]["where_they_would_argue"] == "crux"
