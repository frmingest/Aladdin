"""Unit tests for OllamaProvider and check_ollama_health, against an
httpx.MockTransport — no real Ollama server or GPU needed."""
from __future__ import annotations

import json

import httpx
import pytest
from pydantic import BaseModel

from app.providers import ollama_provider as op
from app.providers.base import LLMUnavailableError
from app.providers.ollama_provider import OllamaProvider, check_ollama_health


class _EchoSchema(BaseModel):
    verdict: str


def _ok_body(content='{"verdict": "Hold"}', prompt=1200, output=300, done_reason="stop"):
    return {
        "model": "qwen3:14b",
        "message": {"role": "assistant", "content": content},
        "done": True,
        "done_reason": done_reason,
        "prompt_eval_count": prompt,
        "eval_count": output,
    }


def _provider(handler, **overrides) -> tuple[OllamaProvider, list[dict]]:
    seen: list[dict] = []

    def _wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content) if request.content else {})
        return handler(request)

    kwargs = {
        "base_url": "http://localhost:11434",
        "model": "qwen3:14b",
        "num_ctx": 16384,
        "client": httpx.Client(transport=httpx.MockTransport(_wrapped)),
    }
    kwargs.update(overrides)
    return OllamaProvider(**kwargs), seen


def _call(provider: OllamaProvider):
    return provider.generate_structured(system_prompt="sys", user_prompt="user", response_schema=_EchoSchema)


def test_successful_call_returns_content_and_usage():
    provider, seen = _provider(lambda r: httpx.Response(200, json=_ok_body()))
    result = _call(provider)

    assert result.content == '{"verdict": "Hold"}'
    assert result.usage.provider == "ollama"
    assert result.usage.model == "qwen3:14b"
    assert (result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens) == (1200, 300, 1500)

    payload = seen[0]
    # A real schema constraint, not prompt-engineered JSON.
    assert payload["format"] == _EchoSchema.model_json_schema()
    assert payload["stream"] is False
    assert payload["think"] is False
    assert payload["options"]["num_ctx"] == 16384
    assert [m["role"] for m in payload["messages"]] == ["system", "user"]


def test_think_none_omits_the_field():
    provider, seen = _provider(lambda r: httpx.Response(200, json=_ok_body()), think=None)
    _call(provider)
    assert "think" not in seen[0]


def test_model_without_thinking_support_retries_without_think():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(400, json={"error": '"gemma3:12b" does not support thinking'})
        return httpx.Response(200, json=_ok_body())

    provider, seen = _provider(handler, model="gemma3:12b")
    assert _call(provider).content == '{"verdict": "Hold"}'
    assert "think" in seen[0] and "think" not in seen[1]


def test_prompt_filling_context_window_is_refused():
    provider, _ = _provider(lambda r: httpx.Response(200, json=_ok_body(prompt=16384)))
    with pytest.raises(LLMUnavailableError, match="OLLAMA_NUM_CTX"):
        _call(provider)


def test_truncated_output_is_refused():
    provider, _ = _provider(lambda r: httpx.Response(200, json=_ok_body(content='{"verd', done_reason="length")))
    with pytest.raises(LLMUnavailableError, match="output limit"):
        _call(provider)


def test_empty_content_is_refused():
    provider, _ = _provider(lambda r: httpx.Response(200, json=_ok_body(content="  ")))
    with pytest.raises(LLMUnavailableError, match="empty"):
        _call(provider)


def test_missing_model_gives_pull_instruction():
    provider, _ = _provider(lambda r: httpx.Response(404, json={"error": "model not found"}))
    with pytest.raises(LLMUnavailableError, match="ollama pull qwen3:14b"):
        _call(provider)


def test_server_error_is_llm_unavailable():
    provider, _ = _provider(lambda r: httpx.Response(500, json={"error": "out of memory"}))
    with pytest.raises(LLMUnavailableError, match="HTTP 500"):
        _call(provider)


def test_connection_refused_retries_then_fails(monkeypatch):
    monkeypatch.setattr(op.time, "sleep", lambda _s: None)
    attempts = {"n": 0}

    def handler(request):
        attempts["n"] += 1
        raise httpx.ConnectError("refused", request=request)

    provider, _ = _provider(handler)
    with pytest.raises(LLMUnavailableError, match="Can't reach Ollama"):
        _call(provider)
    assert attempts["n"] == 3


def test_timeout_is_not_retried():
    attempts = {"n": 0}

    def handler(request):
        attempts["n"] += 1
        raise httpx.ReadTimeout("slow", request=request)

    provider, _ = _provider(handler)
    with pytest.raises(LLMUnavailableError, match="OLLAMA_TIMEOUT_SECONDS"):
        _call(provider)
    assert attempts["n"] == 1


def test_missing_base_url_or_model_raises_immediately():
    with pytest.raises(LLMUnavailableError):
        OllamaProvider(base_url="", model="qwen3:14b")
    with pytest.raises(LLMUnavailableError):
        OllamaProvider(base_url="http://localhost:11434", model="")


def _tags(monkeypatch, response=None, exc=None):
    def fake_get(url, headers=None, timeout=None):
        if exc:
            raise exc
        return response

    monkeypatch.setattr(op.httpx, "get", fake_get)


def _tags_response(names):
    req = httpx.Request("GET", "http://localhost:11434/api/tags")
    return httpx.Response(200, json={"models": [{"name": n} for n in names]}, request=req)


def test_health_ok_when_model_pulled(monkeypatch):
    _tags(monkeypatch, _tags_response(["qwen3:14b", "gemma3:12b"]))
    assert check_ollama_health(base_url="http://localhost:11434", model="qwen3:14b").ok


def test_health_accepts_untagged_model_name_as_latest(monkeypatch):
    _tags(monkeypatch, _tags_response(["mistral-nemo:latest"]))
    assert check_ollama_health(base_url="http://x", model="mistral-nemo").ok


def test_health_reports_missing_model(monkeypatch):
    _tags(monkeypatch, _tags_response(["gemma3:12b"]))
    health = check_ollama_health(base_url="http://x", model="qwen3:14b")
    assert not health.ok and "ollama pull qwen3:14b" in health.detail


def test_health_reports_unreachable_server(monkeypatch):
    _tags(monkeypatch, exc=httpx.ConnectError("refused"))
    health = check_ollama_health(base_url="http://localhost:11434", model="qwen3:14b")
    assert not health.ok and "running" in health.detail
