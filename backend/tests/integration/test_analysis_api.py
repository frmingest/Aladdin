"""
Integration tests for the Phase 3 analysis endpoints. Uses a
FakeLLMProvider dependency override — never touches Google AI Studio,
consistent with the Phase 2 pattern (FakeMarketDataProvider) of keeping
tests independent of external infrastructure (§22).
"""

import json
from decimal import Decimal

import pytest

from app.main import app
from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.providers.factory import get_llm_provider
from tests.support import make_portfolio_csv

VALID_CSV = make_portfolio_csv(
    ["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,Long-term conviction holding"]
)

_BLIND_OUTPUT = {
    "executive_summary": "Solid energy producer with growing volumes.",
    "thesis_status": "new",
    "business_quality": {"score": 7, "confidence": "medium", "reasoning": "Reasonable moat."},
    "financial_strength": {"score": 6, "confidence": "medium", "reasoning": "Adequate balance sheet."},
    "valuation": {"score": 5, "confidence": "low", "reasoning": "Limited multiples data."},
    "key_strengths": ["Growing production volumes"],
    "key_risks": ["Commodity price exposure"],
    "new_information": [],
    "invalidation_triggers": ["Sustained oil price collapse"],
    "decision_considerations": ["Monitor next quarterly report"],
    "source_references": ["E1"],
    "insufficient_evidence_areas": [],
}

_RECONCILIATION_OUTPUT = {
    "thesis_divergence": {
        "blind_assessment_summary": "Cautiously positive.",
        "user_thesis_summary": "Bullish on the energy transition angle.",
        "material_disagreement": False,
        "disagreement_notes": "Aligned.",
    },
    "additional_risks": [],
    "additional_considerations": [],
    "source_references": [],
}


class FakeLLMProvider(LLMProvider):
    def __init__(self, always_fail: bool = False):
        self.always_fail = always_fail

    def generate_structured(self, *, system_prompt, user_content, response_schema, prompt_version):
        if self.always_fail:
            raise LLMUnavailableError("simulated provider outage")
        payload = _BLIND_OUTPUT if "persona" in prompt_version else _RECONCILIATION_OUTPUT
        return LLMResponse(content=json.dumps(payload), model="fake-model", input_tokens=10, output_tokens=5, latency_ms=1.0)


@pytest.fixture()
def fake_llm():
    provider = FakeLLMProvider()
    app.dependency_overrides[get_llm_provider] = lambda: provider
    yield provider
    app.dependency_overrides.pop(get_llm_provider, None)


def _upload_and_add_evidence(client):
    upload = client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})
    snapshot_id = upload.json()["snapshot"]["id"]
    holding_id = upload.json()["snapshot"]["positions"][0]["holding_id"]

    client.patch(f"/portfolio/holdings/{holding_id}", json={"market_ticker": "VAR.OL"})

    document_id = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "ANNUAL_REPORT"},
        files={"file": ("report.pdf", _fake_pdf_bytes(), "application/pdf")},
    ).json()["document"]["id"]

    return snapshot_id, holding_id, document_id


def _fake_pdf_bytes() -> bytes:
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Revenue grew 12% year over year driven by higher production volumes.")
    content = doc.tobytes()
    doc.close()
    return content


def test_create_analysis_run_completes_and_persists(client, fake_llm):
    snapshot_id, holding_id, _ = _upload_and_add_evidence(client)

    response = client.post(f"/analysis/snapshots/{snapshot_id}/runs", json={})
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["status"] == "COMPLETED"
    assert body["holding_analysis_count"] == 1
    assert body["failure_count"] == 0
    assert len(body["holding_analyses"]) == 1
    ha_summary = body["holding_analyses"][0]
    assert ha_summary["ticker"] == "VAR.OL"
    assert Decimal(ha_summary["overall_score"]) == Decimal("6.10")  # 7*.4 + 6*.3 + 5*.3

    detail = client.get(f"/analysis/holding-analyses/{ha_summary['id']}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["structured_output"]["executive_summary"] == _BLIND_OUTPUT["executive_summary"]
    assert len(detail_body["factor_assessments"]) == 3
    # E1 was cited by the blind pass and exists in the evidence packet (the
    # document chunk) — it should have become a persisted EvidenceReference.
    assert len(detail_body["evidence_references"]) == 1

    memo_response = client.get(f"/analysis/holding-analyses/{ha_summary['id']}/memo")
    assert memo_response.status_code == 200
    assert "Vår Energi" in memo_response.text
    assert "Cautiously positive" in memo_response.text  # reconciliation ran (notes were present)


def test_analysis_run_with_no_evidence_returns_422(client, fake_llm):
    upload = client.post(
        "/portfolio/upload",
        files={"file": ("portfolio.csv", make_portfolio_csv(["EQNR.OL,Equinor,Aksje,500,100,300,NOK,Energy,"]), "text/csv")},
    )
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/analysis/snapshots/{snapshot_id}/runs", json={})
    assert response.status_code == 422


def test_analysis_run_provider_failure_marks_run_failed_not_500(client, fake_llm):
    fake_llm.always_fail = True
    snapshot_id, holding_id, _ = _upload_and_add_evidence(client)

    response = client.post(f"/analysis/snapshots/{snapshot_id}/runs", json={})
    assert response.status_code == 201  # the run itself is a resource, even when it failed
    body = response.json()
    assert body["status"] == "FAILED"
    assert body["holding_analysis_count"] == 0


def test_unknown_snapshot_returns_404(client, fake_llm):
    response = client.post(
        "/analysis/snapshots/00000000-0000-0000-0000-000000000000/runs", json={}
    )
    assert response.status_code == 404


def test_list_holding_analyses_orders_newest_first(client, fake_llm):
    snapshot_id, holding_id, _ = _upload_and_add_evidence(client)
    client.post(f"/analysis/snapshots/{snapshot_id}/runs", json={})
    client.post(f"/analysis/snapshots/{snapshot_id}/runs", json={})

    response = client.get(f"/analysis/holdings/{holding_id}/analyses")
    assert response.status_code == 200
    assert len(response.json()) == 2
