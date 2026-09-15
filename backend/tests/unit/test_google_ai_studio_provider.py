"""Unit tests for GoogleAIStudioProvider (§26 Phase 3). Monkeypatches
`genai.Client` with a fake shaped like the real google-genai==2.23.0 SDK's
response objects — same style as tests/unit/test_gemini_research_provider.py.
No real network/API call.

Added 2026-09-15 alongside app.providers.gemini_retry: this provider
previously had no dedicated unit test at all (its own docstring noted the
sandbox had no live network path to verify the SDK's exception types
against — since resolved by introspecting the installed SDK directly, see
gemini_retry.py's docstring). These tests focus on what's new — retry and
pacing — since the rest of generate_structured's behavior (schema
validation, empty-content handling) belongs to
app.services.analysis.llm_analysis and app.services.analysis.context.
"""

from types import SimpleNamespace

import pytest
from google.genai import errors as genai_errors
from pydantic import BaseModel

import app.providers.gemini_retry as gemini_retry
import app.providers.google_ai_studio_provider as provider_module
from app.providers.base import LLMUnavailableError


class _DummySchema(BaseModel):
    value: str = "x"


def _api_error(cls, code: int, message: str = "boom"):
    return cls(code, {"message": message, "status": "ERROR"})


def _response(text='{"value": "ok"}', usage_metadata=None):
    return SimpleNamespace(
        text=text,
        usage_metadata=usage_metadata or SimpleNamespace(prompt_token_count=10, candidates_token_count=5),
        candidates=[SimpleNamespace(finish_reason="STOP")],
    )


class _FakeModels:
    def __init__(self, *, response=None, fail_times: int = 0, error_code: int = 503):
        self._response = response or _response()
        self._fail_times = fail_times
        self._error_code = error_code
        self.calls = 0

    def generate_content(self, **kwargs):
        self.calls += 1
        if self.calls <= self._fail_times:
            error_cls = genai_errors.ClientError if 400 <= self._error_code < 500 else genai_errors.ServerError
            raise _api_error(error_cls, self._error_code)
        return self._response


class _FakeClient:
    def __init__(self, models: _FakeModels):
        self.models = models


@pytest.fixture(autouse=True)
def _reset_pacing_clock():
    gemini_retry._last_call_at = None
    yield
    gemini_retry._last_call_at = None


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    monkeypatch.setattr(gemini_retry.time, "sleep", lambda _s: None)


def _provider(rpm: int = 0) -> provider_module.GoogleAIStudioProvider:
    return provider_module.GoogleAIStudioProvider(
        api_key="k", model="gemini-3.6-flash", max_output_tokens=100, temperature=0.2, rpm=rpm
    )


def test_missing_api_key_raises_immediately():
    with pytest.raises(LLMUnavailableError, match="GOOGLE_AI_STUDIO_API_KEY"):
        provider_module.GoogleAIStudioProvider(
            api_key="", model="gemini-3.6-flash", max_output_tokens=100, temperature=0.2
        )


def test_pacing_defaults_to_disabled():
    provider = _provider()
    assert provider._rpm == 0


def test_successful_call_returns_llm_response(monkeypatch):
    provider = _provider()
    fake_models = _FakeModels()
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_models))

    response = provider.generate_structured(
        system_prompt="persona",
        user_content="analyze this",
        response_schema=_DummySchema,
        prompt_version="v2",
    )

    assert response.content == '{"value": "ok"}'
    assert response.input_tokens == 10
    assert response.output_tokens == 5
    assert fake_models.calls == 1


def test_transient_503_is_retried_and_eventually_succeeds(monkeypatch):
    provider = _provider()
    fake_models = _FakeModels(fail_times=2, error_code=503)
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_models))

    response = provider.generate_structured(
        system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2"
    )

    assert response.content == '{"value": "ok"}'
    assert fake_models.calls == 3  # 2 failures + 1 success


def test_transient_429_is_retried(monkeypatch):
    provider = _provider()
    fake_models = _FakeModels(fail_times=1, error_code=429)
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_models))

    provider.generate_structured(
        system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2"
    )

    assert fake_models.calls == 2


def test_retries_exhausted_raises_llm_unavailable(monkeypatch):
    provider = _provider()
    fake_models = _FakeModels(fail_times=99, error_code=503)  # never recovers
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_models))

    with pytest.raises(LLMUnavailableError, match="Gemini API call failed"):
        provider.generate_structured(
            system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2"
        )

    assert fake_models.calls == gemini_retry._MAX_ATTEMPTS


def test_non_retryable_error_fails_on_first_attempt(monkeypatch):
    provider = _provider()
    fake_models = _FakeModels(fail_times=99, error_code=404)  # e.g. retired/unknown model
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_models))

    with pytest.raises(LLMUnavailableError, match="Gemini API call failed"):
        provider.generate_structured(
            system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2"
        )

    assert fake_models.calls == 1  # no retry for a permanent error


def test_empty_response_text_raises_unavailable(monkeypatch):
    provider = _provider()
    fake_models = _FakeModels(response=_response(text=""))
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_models))

    with pytest.raises(LLMUnavailableError, match="no usable content"):
        provider.generate_structured(
            system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2"
        )


def test_pacing_is_applied_when_rpm_configured(monkeypatch):
    """rpm > 0 should route through gemini_retry.pace_call — verified by
    spying on it rather than asserting real sleep durations (covered by
    test_gemini_retry.py already)."""
    provider = _provider(rpm=5)
    fake_models = _FakeModels()
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_models))
    pace_calls = []
    monkeypatch.setattr(gemini_retry, "pace_call", lambda rpm: pace_calls.append(rpm))

    provider.generate_structured(
        system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2"
    )

    assert pace_calls == [5]
