"""Analysis for bond funds, money-market funds and physical-metal ETCs
(2026-10-07): /funds/{id}/instrument-facts, readiness and a full run on the
income and commodity paths, with fake LLM / research providers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.config.settings import get_settings
from app.domain.analysis_schema import (
    CommodityBlindPassOutputV1,
    IncomeBlindPassOutputV1,
    ReconciliationOutputV1,
)
from app.main import app
from app.models.analysis import EquityAnalysisRun
from app.models.document import Document
from app.models.holding import Holding
from app.models.macro import MacroObservation
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
_SECTION = {"summary": "s", "evidence_ids": ["EV-002"]}


class _LLM:
    name = "fake_llm"

    def __init__(self):
        self.prompts: list[tuple[str, str]] = []
        self.max_output_tokens_seen: list[int | None] = []

    def generate_structured(self, *, system_prompt, user_prompt, response_schema, max_output_tokens=None):
        self.max_output_tokens_seen.append(max_output_tokens)
        self.prompts.append((system_prompt, user_prompt))
        if response_schema is IncomeBlindPassOutputV1:
            content = IncomeBlindPassOutputV1(
                yield_and_alternatives=_SECTION, credit_and_rate_risk=_SECTION, steward_and_costs=_SECTION,
                portfolio_construction=_SECTION, macro_stress_test=_SECTION, role_in_portfolio=_SECTION,
                verdict=_VERDICT,
            ).model_dump_json()
        elif response_schema is CommodityBlindPassOutputV1:
            content = CommodityBlindPassOutputV1(
                what_you_own=_SECTION, cost_and_carry={"summary": "s", "evidence_ids": ["EV-999"]},
                macro_stress_test=_SECTION, role_in_portfolio=_SECTION, verdict=_VERDICT,
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
        raise AssertionError("an income / commodity run must not do company research")


class _NoMarket:
    name = "fake"

    def __getattr__(self, item):  # pragma: no cover
        raise AssertionError("an income / commodity run must not call market data")


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


def _holding(client, db_session, ticker, name, instrument_type, currency="NOK", sector=None) -> str:
    body = {"ticker": ticker, "name": name, "trading_currency": currency}
    if sector:
        body["sector"] = sector
    response = client.post("/holdings", json=body)
    assert response.status_code == 201, response.text
    holding = db_session.get(Holding, response.json()["id"])
    holding.asset_class_raw = instrument_type
    db_session.commit()
    return str(holding.id)


_SHA = iter(range(10_000))


def _document(db_session, holding_id, name="factsheet.pdf") -> str:
    document = Document(
        holding_id=holding_id, type="fund_factsheet", original_filename=name, mime_type="application/pdf",
        size_bytes=1, storage_path=f"x/{name}", sha256=f"{next(_SHA):064d}", status="processed", quality_flags={},
    )
    db_session.add(document)
    db_session.commit()
    return str(document.id)


def _macro(db_session, key, value, *, months_ago=0):
    now = datetime.now(timezone.utc)
    db_session.add(MacroObservation(
        series_key=key, provider="test", region="NO", value=D(value), unit="%",
        observed_at=now - timedelta(days=round(months_ago * 30.4375)), retrieved_at=now,
    ))
    db_session.commit()


def _profile(doc_id, **extra):
    body = {
        "management_style": "active", "benchmark_name": "NORM Credit Index", "ongoing_charge_pct": "0.80",
        "base_currency": "nok", "source_document_id": doc_id, "source_page": 1,
    }
    body.update(extra)
    return body


def _bond_facts(doc_id):
    return {"facts": [
        {"fact_key": "yield_to_maturity_pct", "value_number": "7.5", "source_document_id": doc_id, "source_page": 1},
        {"fact_key": "effective_duration_years", "value_number": "2.5", "source_document_id": doc_id},
        {"fact_key": "average_credit_rating", "value_text": "BB+", "source_document_id": doc_id},
        {"fact_key": "high_yield_share_pct", "value_number": "70", "source_document_id": doc_id},
    ]}


def test_instrument_facts_refused_for_stock_and_equity_fund(client, db_session):
    stock = _holding(client, db_session, "NEM", "Newmont", "stock", "USD")
    doc = _document(db_session, stock)
    response = client.put(f"/funds/{stock}/instrument-facts", json=_bond_facts(doc))
    assert response.status_code == 422
    assert "bond funds, money-market funds and commodity ETCs" in response.json()["detail"]


def test_instrument_facts_validation(client, db_session):
    fund = _holding(client, db_session, "ABHY", "Alfred Berg Nordic High Yield", "bond_fund")
    doc = _document(db_session, fund)
    other = _holding(client, db_session, "OTHR", "Other fund", "bond_fund")
    foreign_doc = _document(db_session, other, name="other.pdf")

    def put(facts):
        return client.put(f"/funds/{fund}/instrument-facts", json={"facts": facts})

    assert put([{"fact_key": "metal", "value_text": "gold", "source_document_id": doc}]).status_code == 422
    assert put([{"fact_key": "yield_to_maturity_pct", "value_number": "250", "source_document_id": doc}]).status_code == 422
    assert put([{"fact_key": "yield_to_maturity_pct", "value_text": "high", "source_document_id": doc}]).status_code == 422
    assert put([{"fact_key": "average_credit_rating", "value_number": "3", "source_document_id": doc}]).status_code == 422
    # a figure must cite a document uploaded to this same fund
    assert put([{"fact_key": "yield_to_maturity_pct", "value_number": "7", "source_document_id": foreign_doc}]).status_code == 422
    twice = [{"fact_key": "yield_to_maturity_pct", "value_number": "7", "source_document_id": doc}] * 2
    assert put(twice).status_code == 422


def test_income_readiness_facts_run_and_prompt(client, db_session):
    fund = _holding(client, db_session, "ABHY", "Alfred Berg Nordic High Yield II R", "bond_fund", sector="Financials")
    doc = _document(db_session, fund)

    checks = {c["key"]: c["status"] for c in client.get(f"/analysis/holdings/{fund}/readiness").json()["checks"]}
    assert checks["fund_profile"] == "block"
    assert checks["instrument_facts"] == "block"
    assert "financials" not in checks and "ticker" not in checks

    assert client.put(f"/funds/{fund}/profile", json=_profile(doc)).status_code == 200
    saved = client.put(f"/funds/{fund}/instrument-facts", json=_bond_facts(doc))
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["analysis_path"] == "income"
    assert {s["key"] for s in body["instrument_fact_specs"]} >= {"yield_to_maturity_pct", "average_credit_rating"}
    assert len(body["instrument_facts"]) == 4

    checks = {c["key"]: c["status"] for c in client.get(f"/analysis/holdings/{fund}/readiness").json()["checks"]}
    assert checks["instrument_type"] == "ok"
    assert checks["fund_profile"] == "ok"
    assert checks["instrument_facts"] == "ok"

    _macro(db_session, "no_3m_bill", "4.00")
    _macro(db_session, "no_10y", "4.00")
    # Norway CPI is stored as an index; the 12-month change is computed (100 -> 103 = 3.00 %).
    _macro(db_session, "no_cpi_yoy", "100", months_ago=12)
    _macro(db_session, "no_cpi_yoy", "103")

    llm = _LLM()
    _override(llm)
    try:
        response = client.post(f"/analysis/holdings/{fund}/run")
        assert response.status_code == 201, response.text
        run = response.json()
    finally:
        _clear()
    assert run["status"] == "COMPLETED"
    assert run["schema_version"] == "income_v1"
    assert run["blind_prompt_version"] == "income_v1"
    assert run["evidence_packet_version"] == "income-v1"
    assert run["price_target_low"] is None
    assert run["blind_pass_citation_warnings"] == []
    assert llm.max_output_tokens_seen[0] == get_settings().llm_max_output_tokens_fund

    system_prompt, user_prompt = llm.prompts[0]
    assert "MONEY-MARKET FUND" in system_prompt
    # arithmetic is Python's: 7.5 - 4.00 = +3.50 pp; 7.5 - 3.00 = +4.50 pp; 0.80 / 7.5 = 10.7 %;
    # -2.5 x 1 = -2.50 %; 7.5 / 2.5 = 3.00 pp
    assert "spread over the Norway 3-month T-bill (4.00%): +3.50 pp" in user_prompt
    assert "real yield after Norway CPI (3.00%): +4.50 pp" in user_prompt
    assert "equals 10.7% of that yield" in user_prompt
    assert "+1 pp parallel rate move changes the price by about -2.50%" in user_prompt
    assert "rate rise of about 3.00 pp" in user_prompt
    assert "BB+" in user_prompt
    categories = {item["category"] for item in run["evidence_items"]}
    assert {"instrument_facts", "income_metrics", "fund_cost"} <= categories
    assert "fund_look_through" not in categories

    latest = client.get(f"/analysis/holdings/{fund}")
    assert latest.json()["blind_pass"]["credit_and_rate_risk"]["summary"] == "s"


def test_income_metrics_skip_cross_currency_spreads(client, db_session):
    fund = _holding(client, db_session, "USHY", "US High Yield Fund", "bond_fund", currency="USD")
    doc = _document(db_session, fund)
    client.put(f"/funds/{fund}/profile", json=_profile(doc, base_currency="usd"))
    client.put(f"/funds/{fund}/instrument-facts", json=_bond_facts(doc))
    _macro(db_session, "no_3m_bill", "4.00")
    body = client.get(f"/funds/{fund}").json()
    income = body["instrument_metrics"]["income"]
    assert income["spread_vs_no_3m_bill_pp"] is None
    assert income["real_yield_pp"] is None
    assert any("fund currency is USD" in g for g in body["instrument_metrics"]["gaps"])
    assert income["fee_share_of_yield_pct"] == "10.67"  # currency-free


def test_money_market_fund_takes_the_income_path(client, db_session):
    fund = _holding(client, db_session, "HHP", "Heimdal Høyrente Pluss B", "money_market_fund")
    doc = _document(db_session, fund)
    client.put(f"/funds/{fund}/profile", json=_profile(doc, ongoing_charge_pct="0.25"))
    client.put(f"/funds/{fund}/instrument-facts", json={"facts": [
        {"fact_key": "distribution_yield_pct", "value_number": "4.4", "source_document_id": doc},
        {"fact_key": "weighted_avg_maturity_days", "value_number": "60", "source_document_id": doc},
    ]})
    body = client.get(f"/funds/{fund}").json()
    assert body["analysis_path"] == "income"
    assert body["instrument_metrics"]["income"]["reference_yield_basis"] == "distribution yield"
    checks = {c["key"]: c["status"] for c in client.get(f"/analysis/holdings/{fund}/readiness").json()["checks"]}
    # a yield is entered, so only the missing duration is flagged
    assert checks["instrument_facts"] == "warn"


def test_commodity_readiness_and_run(client, db_session):
    etc = _holding(client, db_session, "4GLD.DE", "Xetra-Gold", "commodity_etc", currency="EUR", sector="Materials")
    doc = _document(db_session, etc)
    client.put(f"/funds/{etc}/profile", json=_profile(doc, management_style="index", ongoing_charge_pct="0.36",
                                                       base_currency="eur"))
    checks = {c["key"]: c["status"] for c in client.get(f"/analysis/holdings/{etc}/readiness").json()["checks"]}
    assert checks["instrument_facts"] == "block"
    assert "fund_holdings" not in checks  # a metal has no holdings list

    saved = client.put(f"/funds/{etc}/instrument-facts", json={"facts": [
        {"fact_key": "metal", "value_text": "gold", "source_document_id": doc},
        {"fact_key": "backing", "value_text": "Fully allocated physical gold in Frankfurt", "source_document_id": doc},
        {"fact_key": "redemption_right", "value_text": "Holders may demand physical delivery", "source_document_id": doc},
        {"fact_key": "nav_per_unit", "value_number": "100", "source_document_id": doc},
        {"fact_key": "market_price_per_unit", "value_number": "100.5", "source_document_id": doc},
    ]})
    assert saved.status_code == 200, saved.text
    assert saved.json()["analysis_path"] == "commodity"
    assert saved.json()["instrument_metrics"]["commodity"]["premium_discount_pct"] == "0.50"
    _macro(db_session, "no_3m_bill", "4.00")

    llm = _LLM()
    _override(llm)
    try:
        response = client.post(f"/analysis/holdings/{etc}/run")
        assert response.status_code == 201, response.text
        run = response.json()
    finally:
        _clear()
    assert run["status"] == "COMPLETED"
    assert run["schema_version"] == "commodity_v1"
    assert run["evidence_packet_version"] == "commodity-v1"
    assert run["blind_pass_citation_warnings"] == ["cited unknown evidence id: EV-999"]
    system_prompt, user_prompt = llm.prompts[0]
    assert "PHYSICAL-METAL" in system_prompt
    # (1.04)^5 / (0.9964)^5 - 1 = 23.9 %; (1.04)^10 / (0.9964)^10 - 1 = 53.5 %
    assert "over 5 years the metal must rise 23.9%" in user_prompt
    assert "over 10 years the metal must rise 53.5%" in user_prompt
    assert "0.50% (premium)" in user_prompt
    assert "Fully allocated physical gold in Frankfurt" in user_prompt
    categories = {item["category"] for item in run["evidence_items"]}
    assert "fund_holdings" not in categories and "fund_look_through" not in categories


def test_queue_accepts_the_new_types(client, db_session):
    fund = _holding(client, db_session, "ABHY", "Alfred Berg Nordic High Yield", "bond_fund")
    response = client.post(f"/analysis/holdings/{fund}/queue")
    assert response.status_code == 202, response.text
    assert db_session.get(EquityAnalysisRun, response.json()["id"]).schema_version == "income_v1"
    etc = _holding(client, db_session, "GLD", "Gold ETC", "commodity_etc")
    response = client.post(f"/analysis/holdings/{etc}/queue")
    assert response.status_code == 202, response.text
    run = db_session.get(EquityAnalysisRun, response.json()["id"])
    assert (run.schema_version, run.evidence_packet_version) == ("commodity_v1", "commodity-v1")


def test_valuation_says_there_is_no_model(client, db_session):
    fund = _holding(client, db_session, "ABHY", "Alfred Berg Nordic High Yield", "bond_fund")
    response = client.get(f"/valuation/holdings/{fund}")
    if response.status_code == 200:
        reasons = response.json().get("unavailable_reasons", [])
        assert any("No intrinsic-value model" in r for r in reasons)
