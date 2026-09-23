"""Integration tests for POST /documents/{id}/financials/{propose,approve}
with a fake LLM (no Ollama/Gemini call)."""
from __future__ import annotations

import json

from app.domain.extraction_schema.v1 import FinancialsExtractionV1
from app.main import app
from app.models.document import Document, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.base import LLMResponse, LLMUnavailableError, LLMUsageMetrics
from app.providers.factory import get_llm_fallback_provider, get_llm_provider

INCOME = "Consolidated statement of income\n(USD million) 2025 2024\nTotal revenues 7,873 7,583\nOperating profit 3,112 3,457\nNet profit for the year 1,006 841\n"
BALANCE = "Consolidated statement of financial position\nTotal assets 26 410 24 118\nTotal equity 4 172 3 905\nTotal liabilities 22 238 20 213\n"

LLM_FACTS = [
    {"metric": "revenue", "fiscal_year": 2025, "value_as_printed": "7,873", "scale": "millions",
     "currency": "USD", "source_page": 45, "label_as_printed": "Total revenues"},
    {"metric": "revenue", "fiscal_year": 2024, "value_as_printed": "7,583", "scale": "millions",
     "currency": "USD", "source_page": 45, "label_as_printed": "Total revenues"},
    {"metric": "total_equity", "fiscal_year": 2025, "value_as_printed": "4 172", "scale": "millions",
     "currency": "USD", "source_page": 46, "label_as_printed": "Total equity"},
    # hallucinated: not on the page
    {"metric": "net_income", "fiscal_year": 2025, "value_as_printed": "1,106", "scale": "millions",
     "currency": "USD", "source_page": 45, "label_as_printed": "Net profit for the year"},
]


class _FakeLLM:
    name = "fake_llm"

    def __init__(self):
        self.prompts: list[str] = []

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        assert response_schema is FinancialsExtractionV1
        self.prompts.append(user_prompt)
        return LLMResponse(
            content=json.dumps({"facts": LLM_FACTS}),
            usage=LLMUsageMetrics(provider=self.name, model="fake-model", input_tokens=10, output_tokens=5, total_tokens=15),
        )


class _FailingLLM:
    name = "failing"

    def generate_structured(self, **_):
        raise LLMUnavailableError("down")


def _setup(db, *, doc_type="annual_report"):
    holding = Holding(ticker="VAR.OL", name="Vår Energi", trading_currency="NOK", asset_class_raw="stock")
    db.add(holding)
    db.flush()
    document = Document(
        holding_id=holding.id, type=doc_type, original_filename="Var-Energi-Annual-Report-2025.pdf",
        mime_type="application/pdf", size_bytes=1, storage_path="x.pdf", sha256="a" * 64,
        status="processed", quality_flags={}, reporting_period="2025",
    )
    db.add(document)
    db.flush()
    for number, text in [(1, "Letter from the CEO"), (45, INCOME), (46, BALANCE)]:
        db.add(DocumentPage(document_id=document.id, page_number=number, extracted_text=text, extraction_quality="good"))
    db.commit()
    return holding, document


def _override(llm, fallback=None):
    app.dependency_overrides[get_llm_provider] = lambda: llm
    app.dependency_overrides[get_llm_fallback_provider] = lambda: fallback


def test_propose_verifies_and_saves_nothing(client, db_session):
    _, document = _setup(db_session)
    llm = _FakeLLM()
    _override(llm)
    resp = client.post(f"/documents/{document.id}/financials/propose")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["pages_sent"] == [45, 46] and body["auto_selected"] is True
    by_status = {(f["metric"], f["fiscal_year"]): f["status"] for f in body["facts"]}
    assert by_status[("revenue", 2025)] == "verified"
    assert by_status[("net_income", 2025)] == "rejected"
    assert "Letter from the CEO" not in llm.prompts[0]
    assert "untrusted" in llm.prompts[0]
    assert db_session.query(FinancialLineItem).count() == 0


def test_manual_pages_override_selection(client, db_session):
    _, document = _setup(db_session)
    _override(_FakeLLM())
    body = client.post(f"/documents/{document.id}/financials/propose", json={"pages": [45]}).json()
    assert body["pages_sent"] == [45] and body["auto_selected"] is False
    equity = next(f for f in body["facts"] if f["metric"] == "total_equity")
    assert equity["status"] == "rejected"  # page 46 wasn't read this time


def test_approve_saves_only_reverified_facts(client, db_session):
    holding, document = _setup(db_session)
    resp = client.post(
        f"/documents/{document.id}/financials/approve",
        json={"facts": LLM_FACTS, "provider": "ollama", "model": "qwen3:14b"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["saved"]) == 3 and len(body["refused"]) == 1
    rows = db_session.query(FinancialLineItem).filter_by(holding_id=holding.id).all()
    assert {(r.metric, r.period) for r in rows} == {("revenue", "FY2025"), ("revenue", "FY2024"), ("total_equity", "FY2025")}
    rev = next(r for r in rows if r.period == "FY2025" and r.metric == "revenue")
    assert int(rev.value) == 7_873_000_000 and rev.source_page == 45
    db_session.expire_all()
    assert db_session.get(Document, document.id).quality_flags["financials_extraction"]["facts_saved"] == 3

    # Re-approving replaces, never duplicates.
    client.post(f"/documents/{document.id}/financials/approve", json={"facts": LLM_FACTS[:1]})
    assert db_session.query(FinancialLineItem).filter_by(document_id=document.id).count() == 1


def test_quarterly_report_is_refused(client, db_session):
    _, document = _setup(db_session, doc_type="quarterly_report")
    _override(_FakeLLM())
    resp = client.post(f"/documents/{document.id}/financials/propose")
    assert resp.status_code == 422 and "annual" in resp.json()["detail"]


def test_llm_outage_uses_fallback_then_503(client, db_session):
    _, document = _setup(db_session)
    _override(_FailingLLM(), _FakeLLM())
    assert client.post(f"/documents/{document.id}/financials/propose").status_code == 200
    _override(_FailingLLM(), None)
    assert client.post(f"/documents/{document.id}/financials/propose").status_code == 503
