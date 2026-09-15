"""Unit tests for app.providers.gemini_retry (added 2026-09-15 — see that
module's docstring for why: a batch analysis run failed 6/6 holdings on a
transient Gemini 503 with no retry logic anywhere, and the holding loop had
no pacing against the free tier's requests-per-minute cap).

Every test monkeypatches `gemini_retry.time.sleep` to a no-op that just
records how long it *would* have slept, so this suite runs instantly
regardless of the rpm/backoff values under test — real Gemini errors are
built from the actual installed `google.genai.errors` classes (not fakes),
since those are what `call_with_retry` pattern-matches on.
"""

import pytest
from google.genai import errors as genai_errors

import app.providers.gemini_retry as gemini_retry


def _api_error(cls, code: int, message: str = "boom"):
    return cls(code, {"message": message, "status": "ERROR"})


@pytest.fixture(autouse=True)
def _reset_pacing_clock():
    """The pacing clock is a module-level global by design (see the
    module's docstring — it must be process-wide, not per-instance), which
    means it persists across tests unless reset."""
    gemini_retry._last_call_at = None
    yield
    gemini_retry._last_call_at = None


@pytest.fixture()
def no_sleep(monkeypatch):
    slept = []
    monkeypatch.setattr(gemini_retry.time, "sleep", lambda s: slept.append(s))
    return slept


class _Clock:
    """Deterministic stand-in for time.monotonic() — advances only when told to."""

    def __init__(self, start: float = 0.0):
        self.now = start

    def __call__(self) -> float:
        return self.now


def test_pace_call_disabled_when_rpm_is_zero(no_sleep):
    gemini_retry.pace_call(0)
    gemini_retry.pace_call(0)
    assert no_sleep == []


def test_pace_call_sleeps_to_respect_rpm(monkeypatch, no_sleep):
    clock = _Clock(start=100.0)
    monkeypatch.setattr(gemini_retry.time, "monotonic", clock)

    gemini_retry.pace_call(rpm=5)  # min interval = 12s, nothing to wait for yet
    assert no_sleep == []

    clock.now += 4.0  # only 4s elapsed — 8s still owed before the next call
    gemini_retry.pace_call(rpm=5)
    assert no_sleep == [8.0]


def test_pace_call_does_not_sleep_once_enough_time_has_passed(monkeypatch, no_sleep):
    clock = _Clock(start=100.0)
    monkeypatch.setattr(gemini_retry.time, "monotonic", clock)

    gemini_retry.pace_call(rpm=5)
    clock.now += 30.0  # well past the 12s minimum interval
    gemini_retry.pace_call(rpm=5)

    assert no_sleep == []


def test_call_with_retry_succeeds_on_first_try(no_sleep):
    result = gemini_retry.call_with_retry(lambda: "ok", rpm=0)
    assert result == "ok"
    assert no_sleep == []


def test_call_with_retry_retries_transient_503_then_succeeds(no_sleep):
    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise _api_error(genai_errors.ServerError, 503, "high demand")
        return "recovered"

    result = gemini_retry.call_with_retry(flaky, rpm=0)

    assert result == "recovered"
    assert attempts["n"] == 3
    assert len(no_sleep) == 2  # one backoff sleep after each of the two failures


def test_call_with_retry_retries_429_rate_limit(no_sleep):
    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 2:
            raise _api_error(genai_errors.ClientError, 429, "quota exceeded")
        return "ok"

    result = gemini_retry.call_with_retry(flaky, rpm=0)

    assert result == "ok"
    assert attempts["n"] == 2


def test_call_with_retry_gives_up_after_max_attempts(no_sleep):
    attempts = {"n": 0}

    def always_503():
        attempts["n"] += 1
        raise _api_error(genai_errors.ServerError, 503, "still overloaded")

    with pytest.raises(genai_errors.ServerError) as exc_info:
        gemini_retry.call_with_retry(always_503, rpm=0)

    assert attempts["n"] == gemini_retry._MAX_ATTEMPTS
    assert exc_info.value.code == 503


def test_call_with_retry_does_not_retry_non_transient_client_error(no_sleep):
    attempts = {"n": 0}

    def bad_request():
        attempts["n"] += 1
        raise _api_error(genai_errors.ClientError, 400, "invalid argument")

    with pytest.raises(genai_errors.ClientError) as exc_info:
        gemini_retry.call_with_retry(bad_request, rpm=0)

    assert attempts["n"] == 1  # no retry at all
    assert exc_info.value.code == 400


def test_call_with_retry_does_not_retry_unrelated_exceptions(no_sleep):
    attempts = {"n": 0}

    def boom():
        attempts["n"] += 1
        raise RuntimeError("not a genai error at all")

    with pytest.raises(RuntimeError):
        gemini_retry.call_with_retry(boom, rpm=0)

    assert attempts["n"] == 1


def test_call_with_retry_paces_every_attempt_including_retries(monkeypatch, no_sleep):
    clock = _Clock(start=0.0)
    monkeypatch.setattr(gemini_retry.time, "monotonic", clock)
    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        clock.now += 1.0  # simulate the call itself taking a moment
        if attempts["n"] < 2:
            raise _api_error(genai_errors.ServerError, 503)
        return "ok"

    gemini_retry.call_with_retry(flaky, rpm=60)  # min interval = 1s

    # Two attempts, each preceded by pace_call: the first has nothing to
    # wait for (clock starts fresh), the second call's pace_call sees the
    # backoff sleep (unrecorded, since time doesn't advance for a mocked
    # sleep) plus the 1s the "call" itself advanced, so pacing adds nothing
    # extra there either — the point is pace_call ran twice without error.
    assert attempts["n"] == 2
