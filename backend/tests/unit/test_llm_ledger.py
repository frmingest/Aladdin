"""LLM usage ledger: recording, the persistent budget guard, provider wiring."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from google.genai import errors as genai_errors
from pydantic import BaseModel
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, LlmUsageEvent
from app.providers.base import LLMResponse, LLMUnavailableError, LLMUsageMetrics
from app.providers.gemini_retry import DailyBudgetExceededError, call_with_retry
from app.providers.ledger_budget import LedgerBudgetGuard
from app.providers.ledger_recording import LedgerRecordingMixin
from app.services.llm_ledger import build_usage_summary, count_calls_today, record_event

GEMINI = "google_ai_studio"


@pytest.fixture()
def factory():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _guard(factory, limit=5):
    return LedgerBudgetGuard(
        daily_limit=limit, provider=GEMINI, model_name="gemini-test", session_factory=factory
    )


def _rows(factory):
    with factory() as db:
        return list(db.scalars(select(LlmUsageEvent).order_by(LlmUsageEvent.occurred_at)))


def test_record_event_writes_a_row(factory):
    assert record_event(factory, provider=GEMINI, model_name="m", call_type="structured",
                        latency_ms=12.5, input_tokens=10, output_tokens=4)
    (row,) = _rows(factory)
    assert (row.provider, row.outcome, row.input_tokens, row.output_tokens) == (GEMINI, "success", 10, 4)


def test_record_event_without_a_database_is_a_noop():
    assert record_event(None, provider=GEMINI, model_name="m", call_type="structured") is False


def test_record_event_swallows_database_errors():
    def broken():
        raise RuntimeError("db down")

    assert record_event(broken, provider=GEMINI, model_name="m", call_type="structured") is False
    assert count_calls_today(broken, GEMINI) is None


def test_guard_counts_from_the_ledger_across_instances(factory):
    """The whole point: a fresh guard (a restart, or the other process) sees
    calls an earlier one made."""
    first = _guard(factory)
    first.record_usage(1, call_type="structured")
    first.record_usage(1, call_type="grounded_research", outcome="error", error_detail="429")
    restarted = _guard(factory)
    assert restarted.remaining_today() == 3


def test_guard_ignores_other_providers_and_yesterday(factory):
    record_event(factory, provider="mistral", model_name="m", call_type="structured")
    record_event(factory, provider=GEMINI, model_name="m", call_type="structured",
                 now=datetime.now(timezone.utc) - timedelta(days=1, minutes=1))
    assert _guard(factory).remaining_today() == 5


def test_blocked_requests_are_logged_but_never_counted(factory):
    guard = _guard(factory, limit=1)
    guard.record_usage(1)
    guard.record_usage(0, call_type="structured", outcome="blocked_by_budget", error_detail="spent")
    assert guard.remaining_today() == 0
    assert [r.outcome for r in _rows(factory)] == ["success", "blocked_by_budget"]


def test_guard_falls_back_to_in_process_count_when_ledger_unreadable():
    def broken():
        raise RuntimeError("db down")

    guard = LedgerBudgetGuard(daily_limit=3, provider=GEMINI, model_name="m", session_factory=broken)
    guard.record_usage(1)
    assert guard.remaining_today() == 2


def test_guard_honours_in_process_count_if_a_ledger_write_was_lost(factory):
    guard = _guard(factory, limit=3)
    guard.record_usage(1)
    with factory() as db:  # simulate the ledger row never having landed
        db.query(LlmUsageEvent).delete()
        db.commit()
    assert guard.remaining_today() == 2  # conservative: min(ledger, in-process)


def test_call_with_retry_records_each_real_attempt_with_tokens_and_errors(factory):
    guard = _guard(factory, limit=10)
    attempts = {"n": 0}

    class Usage:
        prompt_token_count, candidates_token_count = 100, 40

    class Resp:
        usage_metadata = Usage()

    def flaky():
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise genai_errors.ServerError(code=503, response_json={"error": {"message": "busy"}})
        return Resp()

    call_with_retry(
        flaky, rpm=0, budget_guard=guard, call_type="structured", model_name="gemini-test",
        usage_of=lambda r: (r.usage_metadata.prompt_token_count, r.usage_metadata.candidates_token_count),
        _sleep=lambda _s: None, _random=lambda: 0.0,
    )
    failed, ok = _rows(factory)
    assert (failed.outcome, ok.outcome) == ("error", "success")
    assert "503" in (failed.error_detail or "") or "ServerError" in (failed.error_detail or "")
    assert (ok.input_tokens, ok.output_tokens, ok.call_type) == (100, 40, "structured")
    assert guard.remaining_today() == 8


def test_call_with_retry_logs_a_blocked_call_when_budget_is_spent(factory):
    guard = _guard(factory, limit=1)
    guard.record_usage(1)
    with pytest.raises(DailyBudgetExceededError):
        call_with_retry(lambda: "never", rpm=0, budget_guard=guard, call_type="grounded_research")
    assert _rows(factory)[-1].outcome == "blocked_by_budget"
    assert guard.remaining_today() == 0


class _Out(BaseModel):
    x: int = 1


class _FakeProvider(LedgerRecordingMixin):
    name = "ollama"
    _model = "qwen-test"

    def __init__(self, factory, fail=False):
        self.ledger_session_factory = factory
        self._fail = fail

    def _generate_structured(self, **kwargs):
        if self._fail:
            raise LLMUnavailableError("timed out")
        return LLMResponse(content="{}", usage=LLMUsageMetrics("ollama", "qwen-test", 7, 3, 10))


def test_mixin_records_success_and_failure(factory):
    kwargs = {"system_prompt": "s", "user_prompt": "u", "response_schema": _Out}
    _FakeProvider(factory).generate_structured(**kwargs)
    with pytest.raises(LLMUnavailableError):
        _FakeProvider(factory, fail=True).generate_structured(**kwargs)
    ok, bad = _rows(factory)
    assert (ok.outcome, ok.input_tokens, ok.output_tokens) == ("success", 7, 3)
    assert (bad.outcome, bad.provider) == ("error", "ollama")
    assert "timed out" in (bad.error_detail or "")
    # Local calls never touch the Gemini budget.
    assert _guard(factory).remaining_today() == 5


def test_summary_rolls_up_per_day_and_call_type(factory):
    now = datetime(2026, 9, 28, 15, 0, tzinfo=timezone.utc)
    for _ in range(3):
        record_event(factory, provider=GEMINI, model_name="g", call_type="structured",
                     input_tokens=10, output_tokens=5, now=now)
    record_event(factory, provider=GEMINI, model_name="g", call_type="grounded_research",
                 outcome="error", error_detail="429", now=now)
    record_event(factory, provider=GEMINI, model_name="g", call_type="structured",
                 outcome="blocked_by_budget", now=now)
    record_event(factory, provider="ollama", model_name="q", call_type="structured",
                 now=now - timedelta(days=2))
    with factory() as db:
        summary = build_usage_summary(db, days=7, daily_limits={GEMINI: 20}, now=now)
    today = next(d for d in summary["daily"] if d["provider"] == GEMINI)
    assert (today["requests"], today["failed"], today["blocked"]) == (4, 1, 1)
    assert (today["input_tokens"], today["output_tokens"]) == (30, 15)
    assert (today["daily_limit"], today["remaining"]) == (20, 16)
    older = next(d for d in summary["daily"] if d["provider"] == "ollama")
    assert older["remaining"] is None and older["daily_limit"] is None
    assert {(c["provider"], c["call_type"]): c["requests"] for c in summary["by_call_type"]} == {
        (GEMINI, "structured"): 3, (GEMINI, "grounded_research"): 1, ("ollama", "structured"): 1,
    }
    assert summary["recent_errors"][0]["detail"] == "429"
