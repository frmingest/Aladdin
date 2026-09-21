"""Unit tests for app.providers.mistral_retry, against the real installed
mistralai SDK's SDKError (introspected: SDKError(message, status_code, body,
raw_response), .status_code carries the HTTP status).
"""
import pytest
from mistralai.models.sdkerror import SDKError

from app.providers.mistral_retry import call_with_retry


def _sdk_error(status_code: int) -> SDKError:
    return SDKError("boom", status_code=status_code, body="{}")


def test_succeeds_first_try_no_sleep():
    sleeps = []
    result = call_with_retry(lambda: "ok", rpm=0, _sleep=sleeps.append)
    assert result == "ok"
    assert sleeps == []


@pytest.mark.parametrize("code", [429, 500, 502, 503, 504])
def test_retries_on_transient_status_then_succeeds(code):
    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 2:
            raise _sdk_error(code)
        return "ok"

    result = call_with_retry(flaky, rpm=0, _sleep=lambda _: None, _random=lambda: 0.0)
    assert result == "ok"
    assert attempts["n"] == 2


def test_retries_exhausted_raises_last_error():
    def always_fails():
        raise _sdk_error(503)

    with pytest.raises(SDKError):
        call_with_retry(always_fails, rpm=0, _sleep=lambda _: None, _random=lambda: 0.0)


def test_non_retryable_400_fails_immediately():
    attempts = {"n": 0}

    def bad_request():
        attempts["n"] += 1
        raise _sdk_error(400)

    with pytest.raises(SDKError):
        call_with_retry(bad_request, rpm=0, _sleep=lambda _: None)
    assert attempts["n"] == 1


def test_non_vendor_exception_fails_immediately():
    attempts = {"n": 0}

    def broken():
        attempts["n"] += 1
        raise RuntimeError("not a vendor error")

    with pytest.raises(RuntimeError):
        call_with_retry(broken, rpm=0, _sleep=lambda _: None)
    assert attempts["n"] == 1


def test_gemini_and_mistral_retry_pace_independently():
    """Regression guard: the two vendors must not share a pacing clock."""
    from app.providers import gemini_retry, mistral_retry

    assert gemini_retry._limiter is not mistral_retry._limiter
