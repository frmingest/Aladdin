"""Unit tests for MistralProvider (§29, 2026-09-17 fallback-provider addition
— see claude/llm-provider-alternatives-2026-09-17.md). Monkeypatches
`Mistral.chat` with a fake shaped like the real installed mistralai==2.10.1
SDK's response/error objects (introspected directly, same approach
test_google_ai_studio_provider.py's own docstring describes for
google-genai) — no real network/API call.

Mirrors test_google_ai_studio_provider.py's structure closely: same
retry/pacing/empty-content/missing-key behaviors are expected of every
LLMProvider implementation (app.providers.base), just against a different
vendor's SDK and error hierarchy (mistralai.client.errors.MistralError,
keyed off a plain `.status_code` int rather than google.genai's `.code`).
"""

from types import SimpleNamespace

import pytest
from mistralai.client.errors import MistralError
from pydantic import BaseModel

import app.providers.mistral_retry as mistral_retry
import app.providers.mistral_provider as provider_module
from app.providers.base import LLMUnavailableError


class _DummySchema(BaseModel):
    value: str = "x"


def _mistral_error(status_code: int, message: str = "boom") -> MistralError:
    raw_response = SimpleNamespace(status_code=status_code, headers={}, text=message)
    return MistralError(message, raw_response)


def _response(content='{"value": "ok"}', prompt_tokens=10, completion_tokens=5, finish_reason="stop"):
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message, finish_reason=finish_reason)
    usage = SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)
    return SimpleNamespace(choices=[choice], usage=usage)


class _FakeChat:
    def __init__(self, *, response=None, fail_times: int = 0, error_status: int = 503):
        self._response = response or _response()
        self._fail_times = fail_times
        self._error_status = error_status
        self.calls = 0

    def complete(self, **kwargs):
        self.calls += 1
        if self.calls <= self._fail_times:
            raise _mistral_error(self._error_status)
        return self._response


class _FakeClient:
    def __init__(self, chat: _FakeChat):
        self.chat = chat


@pytest.fixture(autouse=True)
def _reset_pacing_clock():
    mistral_retry._last_call_at = None
    yield
    mistral_retry._last_call_at = None


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    monkeypatch.setattr(mistral_retry.time, "sleep", lambda _s: None)


def _provider(rpm: int = 0) -> provider_module.MistralProvider:
    return provider_module.MistralProvider(
        api_key="k", model="mistral-small-latest", max_output_tokens=100, temperature=0.2, rpm=rpm
    )


def test_missing_api_key_raises_immediately():
    with pytest.raises(LLMUnavailableError, match="MISTRAL_API_KEY"):
        provider_module.MistralProvider(api_key="", model="mistral-small-latest", max_output_tokens=100, temperature=0.2)


def test_pacing_defaults_to_disabled():
    provider = _provider()
    assert provider._rpm == 0


def test_successful_call_returns_llm_response(monkeypatch):
    provider = _provider()
    fake_chat = _FakeChat()
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_chat))

    response = provider.generate_structured(
        system_prompt="persona", user_content="analyze this", response_schema=_DummySchema, prompt_version="v2"
    )

    assert response.content == '{"value": "ok"}'
    assert response.input_tokens == 10
    assert response.output_tokens == 5
    assert fake_chat.calls == 1


def test_transient_503_is_retried_and_eventually_succeeds(monkeypatch):
    provider = _provider()
    fake_chat = _FakeChat(fail_times=2, error_status=503)
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_chat))

    response = provider.generate_structured(
        system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2"
    )

    assert response.content == '{"value": "ok"}'
    assert fake_chat.calls == 3  # 2 failures + 1 success


def test_transient_429_is_retried(monkeypatch):
    provider = _provider()
    fake_chat = _FakeChat(fail_times=1, error_status=429)
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_chat))

    provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2")

    assert fake_chat.calls == 2


def test_retries_exhausted_raises_llm_unavailable(monkeypatch):
    provider = _provider()
    fake_chat = _FakeChat(fail_times=99, error_status=503)  # never recovers
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_chat))

    with pytest.raises(LLMUnavailableError, match="Mistral API call failed"):
        provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2")

    assert fake_chat.calls == mistral_retry._MAX_ATTEMPTS


def test_non_retryable_error_fails_on_first_attempt(monkeypatch):
    provider = _provider()
    fake_chat = _FakeChat(fail_times=99, error_status=400)  # e.g. bad request
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_chat))

    with pytest.raises(LLMUnavailableError, match="Mistral API call failed"):
        provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2")

    assert fake_chat.calls == 1  # no retry for a permanent error


def test_empty_response_text_raises_unavailable(monkeypatch):
    provider = _provider()
    fake_chat = _FakeChat(response=_response(content=""))
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_chat))

    with pytest.raises(LLMUnavailableError, match="no usable content"):
        provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2")


def test_pacing_is_applied_when_rpm_configured(monkeypatch):
    """rpm > 0 should route through mistral_retry.pace_call — verified by
    spying on it rather than asserting real sleep durations (covered by a
    dedicated pacing-math test if one is ever added, same as gemini_retry)."""
    provider = _provider(rpm=5)
    fake_chat = _FakeChat()
    monkeypatch.setattr(provider, "_client", _FakeClient(fake_chat))
    pace_calls = []
    monkeypatch.setattr(mistral_retry, "pace_call", lambda rpm: pace_calls.append(rpm))

    provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v2")

    assert pace_calls == [5]
