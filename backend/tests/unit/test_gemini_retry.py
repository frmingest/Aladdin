"""Unit tests for app.providers.gemini_retry, against the real installed
google-genai SDK's actual error classes (not fakes) — introspected this
session: google.genai.errors.APIError(code, response_json).code carries the
HTTP status, ClientError is 4xx, ServerError is 5xx.
"""
import pytest
from google.genai import errors as genai_errors

from app.providers.budget import DailyBudgetGuard
from app.providers.gemini_retry import DailyBudgetExceededError, call_with_retry


def _client_error(code: int) -> genai_errors.ClientError:
    return genai_errors.ClientError(code=code, response_json={"error": {"message": "boom"}})


def _server_error(code: int) -> genai_errors.ServerError:
    return genai_errors.ServerError(code=code, response_json={"error": {"message": "boom"}})


def test_succeeds_first_try_no_sleep():
    sleeps = []
    result = call_with_retry(lambda: "ok", rpm=0, _sleep=sleeps.append)
    assert result == "ok"
    assert sleeps == []


def test_retries_on_503_then_succeeds():
    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise _server_error(503)
        return "ok"

    sleeps = []
    result = call_with_retry(flaky, rpm=0, _sleep=sleeps.append, _random=lambda: 0.0)
    assert result == "ok"
    assert attempts["n"] == 3
    assert len(sleeps) == 2  # backoff before attempts 2 and 3


def test_retries_on_429_then_succeeds():
    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 2:
            raise _client_error(429)
        return "ok"

    result = call_with_retry(flaky, rpm=0, _sleep=lambda _: None, _random=lambda: 0.0)
    assert result == "ok"
    assert attempts["n"] == 2


def test_retries_exhausted_raises_last_error():
    def always_fails():
        raise _server_error(503)

    with pytest.raises(genai_errors.ServerError):
        call_with_retry(always_fails, rpm=0, _sleep=lambda _: None, _random=lambda: 0.0)


def test_non_retryable_client_error_fails_immediately():
    attempts = {"n": 0}

    def bad_request():
        attempts["n"] += 1
        raise _client_error(400)

    with pytest.raises(genai_errors.ClientError):
        call_with_retry(bad_request, rpm=0, _sleep=lambda _: None)
    assert attempts["n"] == 1


def test_non_retryable_generic_exception_fails_immediately():
    attempts = {"n": 0}

    def broken():
        attempts["n"] += 1
        raise RuntimeError("not a vendor error")

    with pytest.raises(RuntimeError):
        call_with_retry(broken, rpm=0, _sleep=lambda _: None)
    assert attempts["n"] == 1


def test_exhausted_budget_guard_fails_immediately_no_pacing_no_call():
    """2026-09-22 fix: previously a DailyBudgetGuard was built
    (app/providers/factory.py's get_primary_budget_guard) but never
    consulted anywhere, so an exhausted daily quota still paid the full
    pacing wait + a real (doomed) network call + the full retry/backoff
    ladder before failing — this is what made pages like Macro feel like
    they hung. Now it fails before any of that."""
    guard = DailyBudgetGuard(daily_limit=1)
    guard.record_usage(1)  # budget already spent

    calls = {"n": 0}
    sleeps = []

    def fn():
        calls["n"] += 1
        return "should never run"

    with pytest.raises(DailyBudgetExceededError):
        call_with_retry(fn, rpm=5, budget_guard=guard, _sleep=sleeps.append)

    assert calls["n"] == 0
    assert sleeps == []  # no RPM pacing wait either


def test_budget_guard_records_usage_on_success():
    guard = DailyBudgetGuard(daily_limit=5)
    call_with_retry(lambda: "ok", rpm=0, budget_guard=guard, _sleep=lambda _: None)
    assert guard.remaining_today() == 4


def test_budget_guard_records_usage_per_attempt_on_retries():
    guard = DailyBudgetGuard(daily_limit=5)
    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise genai_errors.ServerError(code=503, response_json={"error": {"message": "busy"}})
        return "ok"

    call_with_retry(
        flaky, rpm=0, budget_guard=guard, _sleep=lambda _: None, _random=lambda: 0.0
    )
    assert attempts["n"] == 3
    assert guard.remaining_today() == 2  # 5 - 3 real attempts, each debited


def test_pacing_invoked_before_every_attempt(monkeypatch):
    pace_calls = {"n": 0}

    def fake_pace(rpm, _sleep=None):
        pace_calls["n"] += 1

    monkeypatch.setattr("app.providers.gemini_retry.pace_call", fake_pace)

    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise _server_error(503)
        return "ok"

    call_with_retry(flaky, rpm=5, _sleep=lambda _: None, _random=lambda: 0.0)
    assert pace_calls["n"] == 3  # once per attempt, including retries
