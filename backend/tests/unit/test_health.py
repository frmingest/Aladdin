from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_reports_active_versions():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    # Reproducibility (§2.3): the health check should surface exactly which
    # prompt/scoring/schema versions are active, not just "ok".
    assert "active_prompt_version" in body
    assert "active_scoring_version" in body
    assert "active_extraction_schema_version" in body
