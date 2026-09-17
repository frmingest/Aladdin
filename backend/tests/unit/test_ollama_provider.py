"""Unit tests for OllamaProvider (§29, 2026-09-17 local-LLM migration — see
docs/decisions/0017-local-llm-migration-ollama.md). Monkeypatches
`ollama.Client.chat` with the real installed `ollama==0.6.2` SDK's own
response/error classes (introspected directly, same approach
test_mistral_provider.py/test_google_ai_studio_provider.py use for their
vendors) — no real network call, no real Ollama server required.

Mirrors those two files' structure: same retry/empty-content/missing-config
behaviors are expected of every LLMProvider implementation (app.providers.
base), just against Ollama's client shape (ollama.RequestError for
connection failures, ollama.ResponseError.status_code for HTTP-level
failures) instead of a cloud vendor's.
"""


import ollama
import pytest
from pydantic import BaseModel

import app.providers.ollama_provider as provider_module
from app.providers import ollama_retry
from app.providers.base import LLMUnavailableError


class _DummySchema(BaseModel):
    value: str = "x"


def _response(content='{"value": "ok"}', prompt_eval_count=10, eval_count=5, done_reason="stop"):
    message = ollama.Message(role="assistant", content=content)
    return ollama.ChatResponse(
        model="qwen3:14b",
        message=message,
        done=True,
        done_reason=done_reason,
        prompt_eval_count=prompt_eval_count,
        eval_count=eval_count,
    )


class _FakeClient:
    def __init__(self, *, response=None, fail_times: int = 0, error: Exception | None = None):
        self._response = response or _response()
        self._fail_times = fail_times
        self._error = error or ollama.ResponseError("boom", status_code=503)
        self.calls = 0
        self.last_kwargs: dict | None = None

    def chat(self, **kwargs):
        self.calls += 1
        self.last_kwargs = kwargs
        if self.calls <= self._fail_times:
            raise self._error
        return self._response


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    monkeypatch.setattr(ollama_retry.time, "sleep", lambda _s: None)


def _provider(**overrides) -> provider_module.OllamaProvider:
    kwargs = {
        "base_url": "http://localhost:11434",
        "model": "qwen3:14b",
        "max_output_tokens": 8192,
        "temperature": 0.2,
        "context_window": 8192,
        "keep_alive_minutes": 30,
    }
    kwargs.update(overrides)
    return provider_module.OllamaProvider(**kwargs)


def test_missing_base_url_raises_immediately():
    with pytest.raises(LLMUnavailableError, match="OLLAMA_BASE_URL"):
        provider_module.OllamaProvider(
            base_url="", model="qwen3:14b", max_output_tokens=100, temperature=0.2,
            context_window=8192, keep_alive_minutes=30,
        )


def test_missing_model_raises_immediately():
    with pytest.raises(LLMUnavailableError, match="OLLAMA_MODEL_NAME"):
        provider_module.OllamaProvider(
            base_url="http://localhost:11434", model="", max_output_tokens=100, temperature=0.2,
            context_window=8192, keep_alive_minutes=30,
        )


def test_successful_call_returns_llm_response(monkeypatch):
    provider = _provider()
    fake_client = _FakeClient()
    monkeypatch.setattr(provider, "_client", fake_client)

    response = provider.generate_structured(
        system_prompt="persona", user_content="analyze this", response_schema=_DummySchema, prompt_version="v3"
    )

    assert response.content == '{"value": "ok"}'
    assert response.input_tokens == 10
    assert response.output_tokens == 5
    assert response.model == "qwen3:14b"
    assert fake_client.calls == 1


def test_schema_and_options_passed_through(monkeypatch):
    provider = _provider(temperature=0.1, max_output_tokens=4096, context_window=16384)
    fake_client = _FakeClient()
    monkeypatch.setattr(provider, "_client", fake_client)

    provider.generate_structured(
        system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v3"
    )

    assert fake_client.last_kwargs["format"] == _DummySchema.model_json_schema()
    assert fake_client.last_kwargs["options"] == {
        "temperature": 0.1,
        "num_predict": 4096,
        "num_ctx": 16384,
    }
    assert fake_client.last_kwargs["keep_alive"] == "30m"


def test_connection_error_is_retried_and_eventually_succeeds(monkeypatch):
    provider = _provider()
    fake_client = _FakeClient(fail_times=2, error=ollama.RequestError("connection refused"))
    monkeypatch.setattr(provider, "_client", fake_client)

    response = provider.generate_structured(
        system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v3"
    )

    assert response.content == '{"value": "ok"}'
    assert fake_client.calls == 3  # 2 failures + 1 success


def test_retryable_response_error_is_retried(monkeypatch):
    provider = _provider()
    fake_client = _FakeClient(fail_times=1, error=ollama.ResponseError("overloaded", status_code=503))
    monkeypatch.setattr(provider, "_client", fake_client)

    provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v3")

    assert fake_client.calls == 2


def test_retries_exhausted_raises_llm_unavailable(monkeypatch):
    provider = _provider()
    fake_client = _FakeClient(fail_times=99, error=ollama.RequestError("still down"))
    monkeypatch.setattr(provider, "_client", fake_client)

    with pytest.raises(LLMUnavailableError, match="Ollama call failed"):
        provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v3")

    assert fake_client.calls == ollama_retry._MAX_ATTEMPTS


def test_model_not_found_fails_on_first_attempt(monkeypatch):
    """A 404 (model never pulled on this server) is permanent — retrying it
    just delays telling Faiz to `ollama pull` the model."""
    provider = _provider()
    fake_client = _FakeClient(fail_times=99, error=ollama.ResponseError("model not found", status_code=404))
    monkeypatch.setattr(provider, "_client", fake_client)

    with pytest.raises(LLMUnavailableError, match="Ollama call failed"):
        provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v3")

    assert fake_client.calls == 1  # no retry for a permanent error


def test_empty_response_text_raises_unavailable(monkeypatch):
    provider = _provider()
    fake_client = _FakeClient(response=_response(content="", done_reason="length"))
    monkeypatch.setattr(provider, "_client", fake_client)

    with pytest.raises(LLMUnavailableError, match="no usable content"):
        provider.generate_structured(system_prompt="persona", user_content="x", response_schema=_DummySchema, prompt_version="v3")
