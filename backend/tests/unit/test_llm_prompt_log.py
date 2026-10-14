"""LLM prompt log: recording from every provider path, retention, and the API."""
from __future__ import annotations

import importlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.database import get_db
from app.config.settings import get_settings
from app.main import app
from app.models import Base, LlmPromptLog
from app.providers.base import LLMResponse, LLMUnavailableError, LLMUsageMetrics
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider
from app.providers.ledger_recording import LedgerRecordingMixin
from app.services import llm_prompt_log as module
from app.services.llm_prompt_log import (
    list_prompt_logs,
    purge_older_than,
    record_prompt,
)
from app.services.settings.demo_mode import set_demo_mode


@pytest.fixture()
def factory():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture()
def client(factory):
    def override():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def _reset_purge_clock(monkeypatch):
    monkeypatch.setattr(module, "_last_purge_at", float("-inf"))
    monkeypatch.setenv("LLM_PROMPT_LOG_ENABLED", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _rows(factory):
    with factory() as db:
        return list(db.scalars(select(LlmPromptLog).order_by(LlmPromptLog.occurred_at)))


class _Out(BaseModel):
    x: int = 1


def test_record_prompt_stores_exact_text(factory):
    assert record_prompt(
        factory, provider="ollama", model_name="q", call_type="structured", schema_name="Out",
        system_prompt="SYSTEM\nline2", user_prompt="USER <evidence id=E1>", response_text='{"x": 1}',
        input_tokens=5, output_tokens=2, latency_ms=10.0,
    )
    (row,) = _rows(factory)
    assert row.system_prompt == "SYSTEM\nline2"
    assert row.user_prompt == "USER <evidence id=E1>"
    assert row.response_text == '{"x": 1}'
    assert row.prompt_chars == len("SYSTEM\nline2") + len("USER <evidence id=E1>")


def test_record_prompt_without_database_or_when_disabled_is_a_noop(factory, monkeypatch):
    assert record_prompt(None, provider="p", model_name="m", call_type="c", user_prompt="u") is False
    monkeypatch.setenv("LLM_PROMPT_LOG_ENABLED", "false")
    get_settings.cache_clear()
    assert record_prompt(factory, provider="p", model_name="m", call_type="c", user_prompt="u") is False
    assert _rows(factory) == []


def test_record_prompt_swallows_database_errors():
    def broken():
        raise RuntimeError("db down")

    assert record_prompt(broken, provider="p", model_name="m", call_type="c", user_prompt="u") is False


def test_purge_removes_only_rows_past_retention(factory, monkeypatch):
    monkeypatch.setenv("LLM_PROMPT_LOG_RETENTION_DAYS", "0")  # 0 = no automatic purge on write
    get_settings.cache_clear()
    now = datetime.now(timezone.utc)
    record_prompt(factory, provider="p", model_name="m", call_type="c", user_prompt="old",
                  now=now - timedelta(days=40))
    record_prompt(factory, provider="p", model_name="m", call_type="c", user_prompt="new",
                  now=now - timedelta(days=1))
    with factory() as db:
        assert purge_older_than(db, 30) == 1
    assert [r.user_prompt for r in _rows(factory)] == ["new"]


def test_writing_triggers_the_hourly_purge(factory, monkeypatch):
    monkeypatch.setenv("LLM_PROMPT_LOG_RETENTION_DAYS", "7")
    get_settings.cache_clear()
    record_prompt(factory, provider="p", model_name="m", call_type="c", user_prompt="ancient",
                  now=datetime.now(timezone.utc) - timedelta(days=30))
    record_prompt(factory, provider="p", model_name="m", call_type="c", user_prompt="fresh")
    assert [r.user_prompt for r in _rows(factory)] == ["fresh"]


def test_first_purge_runs_even_on_a_freshly_booted_host(factory, monkeypatch):
    # time.monotonic() counts from boot; a host up for under an hour must still purge on first write.
    monkeypatch.setenv("LLM_PROMPT_LOG_RETENTION_DAYS", "7")
    get_settings.cache_clear()
    importlib.reload(module)  # the module's own start value, not the fixture's reset
    monkeypatch.setattr(module.time, "monotonic", lambda: 120.0)
    record_prompt(factory, provider="p", model_name="m", call_type="c", user_prompt="ancient",
                  now=datetime.now(timezone.utc) - timedelta(days=30))
    record_prompt(factory, provider="p", model_name="m", call_type="c", user_prompt="fresh")
    assert [r.user_prompt for r in _rows(factory)] == ["fresh"]


class _FakeProvider(LedgerRecordingMixin):
    name = "ollama"
    _model = "qwen-test"

    def __init__(self, factory, fail=False):
        self.ledger_session_factory = factory
        self._fail = fail

    def _generate_structured(self, **kwargs):
        if self._fail:
            raise LLMUnavailableError("timed out")
        return LLMResponse(content='{"x": 2}', usage=LLMUsageMetrics("ollama", "qwen-test", 7, 3, 10))


def test_local_and_mistral_path_logs_success_and_failure(factory):
    kwargs = {"system_prompt": "sys", "user_prompt": "usr", "response_schema": _Out}
    _FakeProvider(factory).generate_structured(**kwargs)
    with pytest.raises(LLMUnavailableError):
        _FakeProvider(factory, fail=True).generate_structured(**kwargs)
    ok, bad = _rows(factory)
    assert (ok.outcome, ok.user_prompt, ok.system_prompt, ok.response_text) == ("success", "usr", "sys", '{"x": 2}')
    assert ok.schema_name == "_Out"
    assert (bad.outcome, bad.response_text) == ("error", None)
    assert "timed out" in (bad.error_detail or "")


def test_gemini_structured_logs_the_prompt_once(factory, monkeypatch):
    provider = GoogleAIStudioProvider(api_key="k", model="gemini-test")
    provider.prompt_log_session_factory = factory

    def fake(self, **kwargs):
        return LLMResponse(content='{"x": 3}', usage=LLMUsageMetrics("google_ai_studio", "gemini-test", 11, 4, 15))

    monkeypatch.setattr(GoogleAIStudioProvider, "_generate_structured", fake)
    provider.generate_structured(system_prompt="S", user_prompt="U", response_schema=_Out)
    (row,) = _rows(factory)
    assert (row.provider, row.model_name, row.system_prompt, row.user_prompt) == (
        "google_ai_studio", "gemini-test", "S", "U")
    assert (row.input_tokens, row.output_tokens, row.response_text) == (11, 4, '{"x": 3}')

    def boom(self, **kwargs):
        raise LLMUnavailableError("Gemini daily request budget exhausted")

    monkeypatch.setattr(GoogleAIStudioProvider, "_generate_structured", boom)
    with pytest.raises(LLMUnavailableError):
        provider.generate_structured(system_prompt="S2", user_prompt="U2", response_schema=_Out)
    assert [r.outcome for r in _rows(factory)] == ["success", "error"]


def test_list_filters_and_search(factory):
    record_prompt(factory, provider="ollama", model_name="q", call_type="structured", user_prompt="alpha ASML")
    record_prompt(factory, provider="google_ai_studio", model_name="g", call_type="grounded_research",
                  user_prompt="beta", outcome="error", error_detail="429")
    with factory() as db:
        assert list_prompt_logs(db)["total"] == 2
        assert list_prompt_logs(db, provider="ollama")["total"] == 1
        assert list_prompt_logs(db, outcome="error")["items"][0].user_prompt == "beta"
        assert list_prompt_logs(db, search="asml")["total"] == 1  # case-insensitive
        assert list_prompt_logs(db)["providers"] == ["google_ai_studio", "ollama"]


def test_api_list_and_detail(factory, client):
    record_prompt(factory, provider="ollama", model_name="q", call_type="structured",
                  system_prompt="SYS", user_prompt="x" * 500, response_text="RESP")
    listing = client.get("/system/prompt-log").json()
    assert listing["total"] == 1 and listing["enabled"] is True
    item = listing["items"][0]
    assert item["preview"].endswith("…") and len(item["preview"]) <= 161
    assert "user_prompt" not in item  # bodies only come from the detail endpoint
    detail = client.get(f"/system/prompt-log/{item['id']}").json()
    assert (detail["system_prompt"], detail["user_prompt"], detail["response_text"]) == ("SYS", "x" * 500, "RESP")


def test_api_detail_404_for_unknown_id(client):
    assert client.get("/system/prompt-log/00000000-0000-0000-0000-000000000000").status_code == 404


def test_api_hides_everything_in_demo_mode(factory, client):
    record_prompt(factory, provider="ollama", model_name="q", call_type="structured", user_prompt="secret")
    with factory() as db:
        set_demo_mode(db, True)
    listing = client.get("/system/prompt-log").json()
    assert listing["demo_mode"] is True and listing["items"] == [] and listing["total"] == 0
    with factory() as db:
        row_id = db.scalar(select(LlmPromptLog.id))
    assert client.get(f"/system/prompt-log/{row_id}").status_code == 404
