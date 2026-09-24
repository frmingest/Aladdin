"""Sprint 8 (F9): /funds/* and the fund analysis path end to end, with
fake LLM / research providers."""
from __future__ import annotations

import io
from decimal import Decimal

from app.domain.analysis_schema import FundBlindPassOutputV1, ReconciliationOutputV1
from app.main import app
from app.models.document import Document, DocumentChunk
from app.models.fund import FundExposure, FundProfile, FundReturnPeriod
from app.models.holding import Holding
from app.providers.base import LLMResponse, LLMUsageMetrics
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


class _FundLLM:
    name = "fake_llm"

    def __init__(self):
        self.prompts: list[tuple[str, str]] = []

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        self.prompts.append((system_prompt, user_prompt))
        if response_schema is FundBlindPassOutputV1:
            section = {"summary": "s", "evidence_ids": ["EV-002"]}
            content = FundBlindPassOutputV1(
                moat={
                    "circle_of_competence_summary": "Gold miners.",
                    "overall_rating": "None",
                    "coverage_caveat": "Rests on 37 % of the fund.",
                    "evidence_ids": ["EV-001", "EV-999"],
                },
                steward_and_costs=section,
                portfolio_construction=section,
                macro_stress_test=section,
                valuation_synthesis=section,
                role_in_portfolio=section,
                verdict=_VERDICT,
            ).model_dump_json()
        else:
            content = ReconciliationOutputV1(
                verdict=_VERDICT, reconciliation_narrative="unchanged", changed_from_blind=False,
                evidence_ids=["EV-001"],
            ).model_dump_json()
        return LLMResponse(
            content=content,
            usage=LLMUsageMetrics(provider=self.name, model="fake", input_tokens=1, output_tokens=1, total_tokens=2),
        )


class _NoResearch:
    name = "fake"

    def get_macro_research(self):
        return []

    def get_sector_research(self, sector):
        return []

    def get_company_research(self, *, company_name, ticker, sector):  # pragma: no cover
        raise AssertionError("a fund run must not do company research")


class _NoMarket:
    name = "fake"

    def __getattr__(self, item):  # pragma: no cover
        raise AssertionError("a fund run must not call market data")


def _override(llm):
    app.dependency_overrides[get_llm_provider] = lambda: llm
    app.dependency_overrides[get_llm_fallback_provider] = lambda: None
    app.dependency_overrides[get_market_data_provider] = lambda: _NoMarket()
    app.dependency_overrides[get_risk_free_rate_provider] = lambda: _NoMarket()
    app.dependency_overrides[get_research_provider] = lambda: _NoResearch()


def _clear():
    for dep in (get_llm_provider, get_llm_fallback_provider, get_market_data_provider,
                get_risk_free_rate_provider, get_research_provider):
        app.dependency_overrides.pop(dep, None)


def _holding(client, db_session, ticker, name, instrument_type, sector=None) -> str:
    body = {"ticker": ticker, "name": name, "trading_currency": "USD"}
    if sector:
        body["sector"] = sector
    response = client.post("/holdings", json=body)
    assert response.status_code == 201, response.text
    holding = db_session.get(Holding, response.json()["id"])
    holding.asset_class_raw = instrument_type
    db_session.commit()
    return str(holding.id)


def _document(db_session, holding_id, name="factsheet.pdf", doc_type="fund_factsheet", sha="a") -> str:
    document = Document(
        holding_id=holding_id, type=doc_type, original_filename=name, mime_type="application/pdf",
        size_bytes=1, storage_path=f"x/{name}", sha256=sha * 64, status="processed", quality_flags={},
    )
    db_session.add(document)
    db_session.commit()
    return str(document.id)


def _setup_fund(client, db_session):
    fund_id = _holding(client, db_session, "AUCO", "L&G Gold Mining UCITS ETF", "equity_etf", "Materials")
    doc_id = _document(db_session, fund_id)
    return fund_id, doc_id


def _profile(doc_id, **extra):
    body = {
        "management_style": "index", "benchmark_name": "Global Gold Miners Index NTR",
        "ongoing_charge_pct": "0.55", "domicile": "Ireland", "base_currency": "usd",
        "replication": "physical", "distribution": "accumulating", "risk_class": 6, "holdings_count": 44,
        "strategy_summary": "Aims to track the Global Gold Miners Index.", "source_document_id": doc_id,
        "source_page": 1,
    }
    body.update(extra)
    return body


def test_non_fund_holding_is_refused(client, db_session):
    stock = _holding(client, db_session, "NEM", "Newmont Corporation", "stock")
    response = client.get(f"/funds/{stock}")
    assert response.status_code == 422
    assert "Equity ETF or Equity fund" in response.json()["detail"]


def test_profile_returns_exposures_roundtrip_and_metrics(client, db_session):
    fund_id, doc_id = _setup_fund(client, db_session)
    newmont = _holding(client, db_session, "NEM", "Newmont Corporation", "stock")

    response = client.put(f"/funds/{fund_id}/profile", json=_profile(doc_id))
    assert response.status_code == 200, response.text
    assert response.json()["profile"]["base_currency"] == "USD"
    assert response.json()["metrics"]["cost"]["fee_drag_pct"]["20"] == "10.44"

    returns = [
        {"period_kind": "rolling_12m", "period_label": "12m to 2026-06-30", "fund_return_pct": "49.02",
         "benchmark_return_pct": "49.57", "source_document_id": doc_id, "source_page": 1},
        {"period_kind": "rolling_12m", "period_label": "12m to 2025-06-30", "fund_return_pct": "69.40",
         "benchmark_return_pct": "70.34", "source_document_id": doc_id},
    ]
    response = client.put(f"/funds/{fund_id}/returns", json=returns)
    assert response.status_code == 200, response.text
    track = response.json()["metrics"]["track_record"]
    assert track["gap_label"] == "tracking difference"
    assert track["one_year_periods_beaten"] == 0
    assert track["average_one_year_difference_pp"] == "-0.74"  # -0.745, half-even

    response = client.put(
        f"/funds/{fund_id}/exposures/holding",
        json={"as_of_date": "2026-08-31", "source_document_id": doc_id, "rows": [
            {"label": "Newmont", "weight_pct": "15.5", "source_page": 2},
            {"label": "Agnico-Eagle Mines", "weight_pct": "11.0"},
        ]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    rows = body["exposures"]["holding"]
    assert rows[0]["label"] == "Newmont" and rows[0]["linked_holding_id"] == newmont
    assert rows[0]["link_method"] == "name"
    assert body["metrics"]["concentration"]["coverage_pct"] == "26.50"
    assert not body["metrics"]["concentration"]["complete"]

    # Manual link survives a re-save of the same snapshot.
    agnico_row = rows[1]["id"]
    other = _holding(client, db_session, "AEM", "Some other name", "stock")
    response = client.patch(f"/funds/{fund_id}/exposures/{agnico_row}/link", json={"linked_holding_id": other})
    assert response.status_code == 200, response.text
    response = client.put(
        f"/funds/{fund_id}/exposures/holding",
        json={"as_of_date": "2026-08-31", "source_document_id": doc_id, "rows": [
            {"label": "Newmont", "weight_pct": "15.5"}, {"label": "Agnico-Eagle Mines", "weight_pct": "11.0"},
        ]},
    )
    agnico = next(r for r in response.json()["exposures"]["holding"] if r["label"].startswith("Agnico"))
    assert agnico["linked_holding_id"] == other and agnico["link_method"] == "manual"


def test_validation_errors(client, db_session):
    fund_id, doc_id = _setup_fund(client, db_session)
    other_fund = _holding(client, db_session, "HEIM", "Heimdal Utbytte A", "equity_fund")
    foreign_doc = _document(db_session, other_fund, name="other.pdf", sha="c")

    response = client.put(f"/funds/{fund_id}/profile", json=_profile(foreign_doc))
    assert response.status_code == 422
    assert "uploaded to this fund" in response.json()["detail"]

    response = client.put(f"/funds/{fund_id}/profile", json=_profile(doc_id, risk_class=9))
    assert response.status_code == 422

    response = client.put(
        f"/funds/{fund_id}/exposures/sector",
        json={"as_of_date": "2026-08-31", "source_document_id": doc_id, "rows": [
            {"label": "Materials", "weight_pct": "80"}, {"label": "Energy", "weight_pct": "30"},
        ]},
    )
    assert response.status_code == 422
    assert "more than 100" in response.json()["detail"]


def test_import_holdings_file(client, db_session):
    fund_id, _doc = _setup_fund(client, db_session)
    csv = (
        b"Holdings as of 31.08.2026\n"
        b"Name;Ticker;Country;Currency;Weight (%)\n"
        b"Newmont;NEM;United States;USD;15,5\n"
        b"Agnico-Eagle Mines;AEM;Canada;CAD;11,0\n"
        b"Kinross Gold;K;Canada;CAD;6,0\n"
    )
    response = client.post(
        f"/funds/{fund_id}/holdings/import",
        files={"file": ("lg-holdings.csv", io.BytesIO(csv), "text/csv")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["rows_imported"] == 3
    assert body["as_of_date"] == "2026-08-31"
    assert sorted(body["derived_dimensions"]) == ["country", "currency"]

    document = db_session.get(Document, body["document_id"])
    assert document.type == "fund_holdings"
    assert document.financial_line_items == []  # never promoted to financial facts

    facts = client.get(f"/funds/{fund_id}").json()
    countries = {r["label"]: r["weight_pct"] for r in facts["exposures"]["country"]}
    assert countries == {"Canada": "17.0000", "United States": "15.5000"}
    assert facts["metrics"]["foreign_currency_pct"] == "100.00"


def test_import_refuses_file_without_date(client, db_session):
    fund_id, _doc = _setup_fund(client, db_session)
    response = client.post(
        f"/funds/{fund_id}/holdings/import",
        files={"file": ("h.csv", io.BytesIO(b"Name;Weight\nA;10\n"), "text/csv")},
    )
    assert response.status_code == 422
    assert "as-of date" in response.json()["detail"]
    response = client.post(
        f"/funds/{fund_id}/holdings/import",
        files={"file": ("h.csv", io.BytesIO(b"Name;Weight\nA;10\n"), "text/csv")},
        data={"as_of_date": "2026-08-31"},
    )
    assert response.status_code == 201, response.text


def test_deleting_the_source_document_deletes_its_fund_rows(client, db_session):
    fund_id, doc_id = _setup_fund(client, db_session)
    client.put(f"/funds/{fund_id}/profile", json=_profile(doc_id))
    client.put(f"/funds/{fund_id}/returns", json=[
        {"period_kind": "calendar_year", "period_label": "2025", "fund_return_pct": "10", "source_document_id": doc_id}
    ])
    response = client.delete(f"/documents/{doc_id}?confirm=true")
    assert response.status_code == 200, response.text
    assert response.json()["fund_rows"] == 2
    assert db_session.query(FundProfile).count() == 0
    assert db_session.query(FundReturnPeriod).count() == 0


def test_deleting_a_linked_company_unlinks_but_keeps_the_fund_row(client, db_session):
    fund_id, doc_id = _setup_fund(client, db_session)
    newmont = _holding(client, db_session, "NEM", "Newmont", "stock")
    client.put(
        f"/funds/{fund_id}/exposures/holding",
        json={"as_of_date": "2026-08-31", "source_document_id": doc_id, "rows": [{"label": "Newmont", "weight_pct": "15.5"}]},
    )
    response = client.delete(f"/holdings/{newmont}?confirm=true")
    assert response.status_code in (200, 204), response.text
    db_session.expire_all()
    row = db_session.query(FundExposure).one()
    assert row.linked_holding_id is None


def test_fund_readiness_and_analysis_run(client, db_session):
    fund_id, doc_id = _setup_fund(client, db_session)

    readiness = client.get(f"/analysis/holdings/{fund_id}/readiness").json()
    checks = {c["key"]: c["status"] for c in readiness["checks"]}
    assert checks["fund_profile"] == "block"
    assert "financials" not in checks and "ticker" not in checks

    client.put(f"/funds/{fund_id}/profile", json=_profile(doc_id, report_name_filter="Gold Mining"))
    client.put(f"/funds/{fund_id}/exposures/holding", json={
        "as_of_date": "2026-08-31", "source_document_id": doc_id,
        "rows": [{"label": "Newmont", "weight_pct": "15.5"}],
    })
    # An umbrella-report passage about another sub-fund must not be used.
    report = Document(
        holding_id=fund_id, type="fund_report", original_filename="umbrella.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="x/umbrella.pdf", sha256="d" * 64, status="processed", quality_flags={},
    )
    db_session.add(report)
    db_session.flush()
    text = "The fund aims to track the index. Ongoing charge and tracking difference remained low. " * 6
    db_session.add_all([
        DocumentChunk(document_id=report.id, page_start=12, page_end=12, section="L&G Gold Mining UCITS ETF",
                      content="Gold Mining sub-fund review. " + text, content_hash="1" * 64),
        DocumentChunk(document_id=report.id, page_start=14, page_end=14, section="L&G Cyber Security UCITS ETF",
                      content="Cyber Security sub-fund review. " + text, content_hash="2" * 64),
    ])
    db_session.commit()

    readiness = client.get(f"/analysis/holdings/{fund_id}/readiness").json()
    checks = {c["key"]: c["status"] for c in readiness["checks"]}
    assert checks["fund_profile"] == "ok"
    assert checks["fund_holdings"] == "ok"

    llm = _FundLLM()
    _override(llm)
    try:
        response = client.post(f"/analysis/holdings/{fund_id}/run")
        assert response.status_code == 201, response.text
        body = response.json()
    finally:
        _clear()
    assert body["status"] == "COMPLETED"
    assert body["schema_version"] == "fund_v1"
    assert body["evidence_packet_version"] == "fund-v2"
    assert body["blind_prompt_version"] == "fund_v1"
    assert body["price_target_low"] is None
    assert body["blind_pass"]["moat"]["coverage_caveat"].startswith("Rests on")
    assert body["blind_pass_citation_warnings"] == ["cited unknown evidence id: EV-999"]

    system_prompt, user_prompt = llm.prompts[0]
    assert "FUND or ETF" in system_prompt
    assert "Ongoing charge 0.55% per year" in user_prompt
    assert "Gold Mining sub-fund review" in user_prompt
    assert "Cyber Security sub-fund review" not in user_prompt
    categories = {item["category"] for item in body["evidence_items"]}
    assert {"fund_profile", "fund_cost", "fund_concentration", "fund_holdings", "document_excerpt"} <= categories

    latest = client.get(f"/analysis/holdings/{fund_id}")
    assert latest.status_code == 200
    assert latest.json()["blind_pass"]["role_in_portfolio"]["summary"] == "s"
