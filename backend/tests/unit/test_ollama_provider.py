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


def _ndjson(chunks: list[dict]) -> bytes:
    return ("\n".join(json.dumps(c) for c in chunks) + "\n").encode()


def _stream_body(pieces: list[str], prompt=1200, output=300, done_reason="stop") -> bytes:
    """What Ollama streams for ``stream: true``: one chunk per piece of
    content, then a final ``done`` chunk carrying the counts."""
    chunks = [
        {"model": "qwen3:14b", "message": {"role": "assistant", "content": p}, "done": False}
        for p in pieces
    ]
    chunks.append(
        {
            "model": "qwen3:14b",
            "message": {"role": "assistant", "content": ""},
            "done": True,
            "done_reason": done_reason,
            "prompt_eval_count": prompt,
            "eval_count": output,
        }
    )
    return _ndjson(chunks)


def _ok(content='{"verdict": "Hold"}', **kw) -> httpx.Response:
    return httpx.Response(200, content=_stream_body([content], **kw))


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


def _call(provider: OllamaProvider, **kwargs):
    return provider.generate_structured(
        system_prompt="sys", user_prompt="user", response_schema=_EchoSchema, **kwargs
    )


def test_successful_call_returns_content_and_usage():
    provider, seen = _provider(lambda r: _ok())
    result = _call(provider)

    assert result.content == '{"verdict": "Hold"}'
    assert result.usage.provider == "ollama"
    assert result.usage.model == "qwen3:14b"
    assert (result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens) == (1200, 300, 1500)

    payload = seen[0]
    # A real schema constraint, not prompt-engineered JSON.
    assert payload["format"] == _EchoSchema.model_json_schema()
    assert payload["stream"] is True
    assert payload["think"] is False
    assert payload["options"]["num_ctx"] == 16384
    assert [m["role"] for m in payload["messages"]] == ["system", "user"]


def test_think_none_omits_the_field():
    provider, seen = _provider(lambda r: _ok(), think=None)
    _call(provider)
    assert "think" not in seen[0]


def test_model_without_thinking_support_retries_without_think():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(400, json={"error": '"gemma3:12b" does not support thinking'})
        return _ok()

    provider, seen = _provider(handler, model="gemma3:12b")
    assert _call(provider).content == '{"verdict": "Hold"}'
    assert "think" in seen[0] and "think" not in seen[1]


def test_prompt_filling_context_window_is_refused():
    provider, _ = _provider(lambda r: _ok(prompt=16384))
    with pytest.raises(LLMUnavailableError, match="OLLAMA_NUM_CTX"):
        _call(provider)


def test_truncated_output_is_refused():
    provider, _ = _provider(lambda r: _ok(content='{"verd', done_reason="length"))
    with pytest.raises(LLMUnavailableError, match="output limit"):
        _call(provider)


def test_max_output_tokens_override_sets_num_predict():
    """A caller (e.g. blind_pass.py for the bigger fund_v1 schema) can ask
    for more room than this provider's own configured default for one
    call (2026-09-27)."""
    provider, seen = _provider(lambda r: _ok(), max_output_tokens=8192)
    _call(provider, max_output_tokens=16384)
    assert seen[0]["options"]["num_predict"] == 16384


def test_no_override_keeps_the_providers_own_default():
    provider, seen = _provider(lambda r: _ok(), max_output_tokens=8192)
    _call(provider)
    assert seen[0]["options"]["num_predict"] == 8192


def test_truncated_output_message_reports_the_budget_actually_used():
    provider, _ = _provider(lambda r: _ok(content='{"verd', done_reason="length", output=16384))
    with pytest.raises(LLMUnavailableError, match=r"16384/16384 tokens"):
        _call(provider, max_output_tokens=16384)


def test_empty_content_is_refused():
    provider, _ = _provider(lambda r: _ok(content="  "))
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


def test_timeout_is_not_retried(monkeypatch):
    monkeypatch.setattr(op, "gpu_share", lambda **_kw: None)
    attempts = {"n": 0}

    def handler(request):
        attempts["n"] += 1
        raise httpx.ReadTimeout("slow", request=request)

    provider, _ = _provider(handler)
    with pytest.raises(LLMUnavailableError, match="OLLAMA_STALL_TIMEOUT_SECONDS") as err:
        _call(provider)
    assert attempts["n"] == 1
    assert "no output after" in str(err.value)


def test_streamed_chunks_are_joined():
    pieces = ['{"ver', 'dict"', ': "Ho', 'ld"}']
    provider, _ = _provider(lambda r: httpx.Response(200, content=_stream_body(pieces, output=4)))
    result = _call(provider)
    assert result.content == '{"verdict": "Hold"}'
    assert result.usage.output_tokens == 4


def test_wall_clock_cap_reports_progress_and_gpu_share(monkeypatch):
    # The whole pass is capped even while tokens keep arriving, and the
    # error says how far it got and that the model spilled onto the CPU.
    monkeypatch.setattr(op, "gpu_share", lambda **_kw: 0.7)
    clock = iter(float(t) for t in range(0, 10_000, 100))
    monkeypatch.setattr(op.time, "monotonic", lambda: next(clock))
    provider, _ = _provider(
        lambda r: httpx.Response(200, content=_stream_body(["{"] + ['"a"'] * 50)),
        timeout_seconds=1000,
    )
    with pytest.raises(LLMUnavailableError, match="OLLAMA_TIMEOUT_SECONDS") as err:
        _call(provider)
    message = str(err.value)
    assert "tokens/s" in message
    assert "70% of the model is on the GPU" in message


def test_partly_on_cpu_model_is_refused_at_first_token(monkeypatch):
    monkeypatch.setattr(op, "gpu_share", lambda **_kw: 0.78)
    provider, _ = _provider(lambda r: _ok(), min_gpu_share=0.95)
    with pytest.raises(LLMUnavailableError, match="only 78% of the model is on the GPU") as err:
        _call(provider)
    assert "OLLAMA_MIN_GPU_SHARE" in str(err.value)


def test_fully_on_gpu_or_unknown_share_is_allowed(monkeypatch):
    for share in (1.0, 0.96, None):
        monkeypatch.setattr(op, "gpu_share", lambda _s=share, **_kw: _s)
        provider, _ = _provider(lambda r: _ok(), min_gpu_share=0.95)
        assert _call(provider).content


def test_gpu_check_is_off_by_default(monkeypatch):
    monkeypatch.setattr(op, "gpu_share", lambda **_kw: 0.5)
    provider, _ = _provider(lambda r: _ok())
    assert _call(provider).content


def test_endless_whitespace_is_stopped_early():
    pieces = ['{"verdict": '] + ["\n"] * 700
    provider, _ = _provider(lambda r: httpx.Response(200, content=_stream_body(pieces)))
    with pytest.raises(LLMUnavailableError, match="blank output"):
        _call(provider)


def test_error_chunk_mid_stream_is_llm_unavailable():
    body = _ndjson([{"message": {"content": "{"}, "done": False}, {"error": "CUDA out of memory"}])
    provider, _ = _provider(lambda r: httpx.Response(200, content=body))
    with pytest.raises(LLMUnavailableError, match="CUDA out of memory"):
        _call(provider)


def test_stream_ending_without_done_is_refused():
    body = _ndjson([{"message": {"content": "{"}, "done": False}])
    provider, _ = _provider(lambda r: httpx.Response(200, content=body))
    with pytest.raises(LLMUnavailableError, match="before finishing"):
        _call(provider)


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


def _ps_and_tags(monkeypatch, *, size, size_vram):
    def fake_get(url, headers=None, timeout=None):
        req = httpx.Request("GET", url)
        if url.endswith("/api/ps"):
            return httpx.Response(
                200,
                json={"models": [{"name": "qwen3:14b", "size": size, "size_vram": size_vram}]},
                request=req,
            )
        return httpx.Response(200, json={"models": [{"name": "qwen3:14b"}]}, request=req)

    monkeypatch.setattr(op.httpx, "get", fake_get)


def test_health_warns_when_model_is_partly_on_cpu(monkeypatch):
    _ps_and_tags(monkeypatch, size=10_000, size_vram=6_000)
    health = check_ollama_health(base_url="http://x", model="qwen3:14b")
    assert health.ok
    assert health.warning and "60% of the model is on the GPU" in health.warning


def test_health_ok_without_warning_when_fully_on_gpu(monkeypatch):
    _ps_and_tags(monkeypatch, size=10_000, size_vram=10_000)
    health = check_ollama_health(base_url="http://x", model="qwen3:14b")
    assert health.ok and health.warning is None
    assert "100% on the GPU" in health.detail


# ---- adaptive fit: choose model + context before the pass (2026-09-30) ----


def _router(shares: dict[tuple[str, int], float], loads: list, installed=("qwen3:14b", "qwen3:8b")):
    """Mock Ollama: /api/generate 'loads' a model at a ctx, /api/ps then
    reports the share for whatever was loaded last; /api/chat streams."""
    state: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        body = json.loads(request.content) if request.content else {}
        if path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": n} for n in installed]})
        if path == "/api/generate":
            state["loaded"] = (body["model"], body["options"]["num_ctx"])
            loads.append(state["loaded"])
            return httpx.Response(200, json={"done": True})
        if path == "/api/chat":
            state["chat"] = (body["model"], body["options"]["num_ctx"])
            return _ok()
        return httpx.Response(404)

    return handler, state


def _fit_provider(monkeypatch, shares, loads, **overrides):
    handler, state = _router(shares, loads)
    monkeypatch.setattr(
        op, "gpu_share", lambda **kw: shares.get(state.get("loaded"), None)
    )
    provider, _ = _provider(
        handler, min_gpu_share=0.95, adaptive_fit=True, fallback_model="qwen3:8b",
        num_ctx=24576, **overrides,
    )
    return provider, state


def test_adaptive_fit_uses_smallest_context_that_holds_the_call(monkeypatch):
    loads: list = []
    provider, state = _fit_provider(monkeypatch, {("qwen3:14b", 12288): 1.0}, loads)
    assert _call(provider, max_output_tokens=9000).content
    assert loads == [("qwen3:14b", 12288)]
    assert state["chat"] == ("qwen3:14b", 12288)


def test_adaptive_fit_falls_back_to_smaller_model_when_primary_spills(monkeypatch):
    loads: list = []
    shares = {("qwen3:14b", 24576): 0.78, ("qwen3:8b", 24576): 1.0}
    provider, state = _fit_provider(monkeypatch, shares, loads)
    assert _call(provider, max_output_tokens=23000).content
    assert loads == [("qwen3:14b", 24576), ("qwen3:8b", 24576)]
    assert state["chat"] == ("qwen3:8b", 24576)
    assert provider._model == "qwen3:8b"  # so the usage ledger records the model that ran


def test_adaptive_fit_remembers_a_misfit_and_resets_the_model_per_call(monkeypatch):
    loads: list = []
    shares = {("qwen3:14b", 24576): 0.78, ("qwen3:8b", 24576): 1.0, ("qwen3:14b", 8192): 1.0}
    provider, state = _fit_provider(monkeypatch, shares, loads)
    _call(provider, max_output_tokens=23000)  # 14b misfits -> 8b
    _call(provider, max_output_tokens=23000)  # 14b skipped straight away
    assert loads == [("qwen3:14b", 24576), ("qwen3:8b", 24576), ("qwen3:8b", 24576)]
    _call(provider, max_output_tokens=3000)  # smaller call: 14b fits again
    assert state["chat"] == ("qwen3:14b", 8192)


def test_adaptive_fit_fails_clearly_when_nothing_fits(monkeypatch):
    loads: list = []
    shares = {("qwen3:14b", 24576): 0.78, ("qwen3:8b", 24576): 0.9}
    provider, _ = _fit_provider(monkeypatch, shares, loads)
    with pytest.raises(LLMUnavailableError, match="No model fits fully on the GPU") as err:
        _call(provider, max_output_tokens=23000)
    assert "qwen3:14b@24576: 78%" in str(err.value)


def test_adaptive_fit_refuses_a_call_bigger_than_num_ctx(monkeypatch):
    provider, _ = _fit_provider(monkeypatch, {}, [])
    with pytest.raises(LLMUnavailableError, match="Raise OLLAMA_NUM_CTX"):
        _call(provider, max_output_tokens=30000)
