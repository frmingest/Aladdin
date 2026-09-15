"""
Integration tests for the Phase 5 valuation-case endpoints (architecture
§17). Uses a FakeLLMProvider dependency override, same pattern as
tests/integration/test_analysis_api.py — never touches Google AI Studio.
"""

import json

import pytest

from app.main import app
from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.providers.factory import get_llm_provider
from tests.support import make_portfolio_csv

VALID_CSV = make_portfolio_csv(
    ["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,Long-term conviction holding"]
)

_CRITIQUE_OUTPUT = {
    "assumptions_reasonable": True,
    "reasoning": "Growth and margin assumptions track the reported trend.",
    "key_risks_to_assumptions": ["Oil price volatility could compress margin"],
    "highest_uncertainty_areas": ["Terminal growth rate"],
    "source_references": [],
}


class FakeLLMProvider(LLMProvider):
    def __init__(self, always_fail: bool = False):
        self.always_fail = always_fail

    def generate_structured(self, *, system_prompt, user_content, response_schema, prompt_version):
        if self.always_fail:
            raise LLMUnavailableError("simulated provider outage")
        return LLMResponse(
            content=json.dumps(_CRITIQUE_OUTPUT), model="fake-model",
            input_tokens=10, output_tokens=5, latency_ms=1.0,
        )


@pytest.fixture()
def fake_llm():
    provider = FakeLLMProvider()
    app.dependency_overrides[get_llm_provider] = lambda: provider
    yield provider
    app.dependency_overrides.pop(get_llm_provider, None)


def _upload_holding_id(client) -> str:
    upload = client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})
    return upload.json()["snapshot"]["positions"][0]["holding_id"]


def _fake_pdf_bytes() -> bytes:
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Revenue grew 12% year over year driven by higher production volumes.")
    content = doc.tobytes()
    doc.close()
    return content


def _add_evidence_document(client, holding_id: str) -> None:
    """A valuation critique needs an AnalysisContext (app.services.analysis.
    context), same as a Phase 3 holding analysis — without at least one
    document/fact/market observation on record, build_analysis_context
    raises InsufficientContextError (§28 rule 10: nothing to reason over)."""
    client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "ANNUAL_REPORT"},
        files={"file": ("report.pdf", _fake_pdf_bytes(), "application/pdf")},
    )


_BASE_ASSUMPTIONS = {
    "case_type": "base",
    "revenue_growth_pct": "8",
    "margin_pct": "20",
    "capex_pct_of_revenue": "5",
    "tax_rate_pct": "22",
    "discount_rate_pct": "9",
    "terminal_growth_pct": "2",
    "shares_outstanding": "1000000",
}


def test_create_valuation_case_without_revenue_fact_returns_undefined_value(client, fake_llm):
    """No FinancialLineItem on record for this holding — the DCF has no
    base revenue to project from, so calculated_value is None with an
    explanatory note, but the case is still persisted (§21)."""
    holding_id = _upload_holding_id(client)

    response = client.post(f"/valuation/holdings/{holding_id}/cases", json=_BASE_ASSUMPTIONS)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["calculated_value"] is None
    assert "base revenue" in body["calculation_note"]


def test_create_valuation_case_with_base_revenue_override(client, fake_llm):
    holding_id = _upload_holding_id(client)

    request = {**_BASE_ASSUMPTIONS, "base_revenue_override": "100000000", "run_critique": False}
    response = client.post(f"/valuation/holdings/{holding_id}/cases", json=request)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["calculated_value"] is not None
    assert float(body["calculated_value"]) > 0
    assert body["critique"] is None
    assert body["critique_error"] is None


def test_create_valuation_case_runs_critique_when_context_available(client, fake_llm):
    holding_id = _upload_holding_id(client)
    _add_evidence_document(client, holding_id)
    request = {**_BASE_ASSUMPTIONS, "base_revenue_override": "100000000"}

    response = client.post(f"/valuation/holdings/{holding_id}/cases", json=request)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["critique"] is not None
    assert body["critique"]["assumptions_reasonable"] is True
    assert body["critique_error"] is None


def test_create_valuation_case_critique_failure_does_not_block_calculated_value(client, fake_llm):
    fake_llm.always_fail = True
    holding_id = _upload_holding_id(client)
    request = {**_BASE_ASSUMPTIONS, "base_revenue_override": "100000000"}

    response = client.post(f"/valuation/holdings/{holding_id}/cases", json=request)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["calculated_value"] is not None
    assert body["critique"] is None
    assert body["critique_error"] is not None


def test_create_valuation_case_survives_unexpected_context_build_error(client, fake_llm, monkeypatch):
    """Regression test (2026-09-15 live-verification pass): a live Railway
    check found that when build_analysis_context raised anything other than
    InsufficientContextError, it escaped _run_critique uncaught and crashed
    the whole POST with an unhandled 500 — losing the deterministic
    calculated_value along with it, exactly what this module's docstring
    ("a valuation case is never lost because the LLM step failed") promises
    never happens. Simulates that by making build_analysis_context raise a
    plain RuntimeError instead of InsufficientContextError."""
    import app.services.valuation.dcf as dcf_module

    def _boom(db, holding_id, snapshot_id):
        raise RuntimeError("simulated unexpected evidence-context bug")

    monkeypatch.setattr(dcf_module, "build_analysis_context", _boom)

    holding_id = _upload_holding_id(client)
    _add_evidence_document(client, holding_id)
    request = {**_BASE_ASSUMPTIONS, "base_revenue_override": "100000000"}

    response = client.post(f"/valuation/holdings/{holding_id}/cases", json=request)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["calculated_value"] is not None
    assert body["critique"] is None
    assert body["critique_error"] is not None
    assert "unexpected evidence-context bug" in body["critique_error"]


def test_create_valuation_case_invalid_case_type_returns_422(client, fake_llm):
    holding_id = _upload_holding_id(client)
    request = {**_BASE_ASSUMPTIONS, "case_type": "not-a-real-case", "run_critique": False}

    response = client.post(f"/valuation/holdings/{holding_id}/cases", json=request)
    assert response.status_code == 422


def test_create_valuation_case_unknown_holding_returns_404(client, fake_llm):
    response = client.post(
        "/valuation/holdings/00000000-0000-0000-0000-000000000000/cases",
        json={**_BASE_ASSUMPTIONS, "run_critique": False},
    )
    assert response.status_code == 404


def test_list_and_get_valuation_cases(client, fake_llm):
    holding_id = _upload_holding_id(client)
    request = {**_BASE_ASSUMPTIONS, "base_revenue_override": "100000000", "run_critique": False}
    created = client.post(f"/valuation/holdings/{holding_id}/cases", json=request).json()

    listed = client.get(f"/valuation/holdings/{holding_id}/cases")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    fetched = client.get(f"/valuation/cases/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created["id"]


def test_get_unknown_valuation_case_returns_404(client, fake_llm):
    response = client.get("/valuation/cases/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
