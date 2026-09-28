"""GET /usage/summary."""
from __future__ import annotations

from app.config.database import get_db
from app.main import app
from app.services.llm_ledger import record_event


def test_summary_reports_gemini_budget_from_the_ledger(client):
    factory = None
    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        factory = db.get_bind()
    finally:
        db_gen.close()
    from sqlalchemy.orm import sessionmaker

    sf = sessionmaker(bind=factory, autoflush=False, autocommit=False)
    for _ in range(3):
        record_event(sf, provider="google_ai_studio", model_name="g", call_type="structured",
                     input_tokens=5, output_tokens=2)
    record_event(sf, provider="ollama", model_name="q", call_type="structured")

    body = client.get("/usage/summary").json()
    assert body["gemini_used_today"] == 3
    assert body["gemini_remaining_today"] == body["gemini_daily_limit"] - 3
    providers = {d["provider"]: d for d in body["daily"]}
    assert providers["google_ai_studio"]["requests"] == 3
    assert providers["ollama"]["daily_limit"] is None
    assert body["demo_mode"] is False


def test_summary_is_empty_when_nothing_was_called(client):
    body = client.get("/usage/summary?days=3").json()
    assert body["daily"] == [] and body["gemini_used_today"] == 0 and body["days"] == 3


def test_summary_rejects_absurd_windows(client):
    assert client.get("/usage/summary?days=0").status_code == 422
    assert client.get("/usage/summary?days=365").status_code == 422
