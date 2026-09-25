"""Ollama provider — a local LLM on Faiz's own GPU (2026-09-23).

Why: Google AI Studio's free tier (20 requests/day) can't carry the heavy,
long-prompt analysis passes. The analysis work (blind + reconciliation pass)
moves to a self-hosted Ollama server; Gemini stays for the light,
search-grounded research calls (app/providers/gemini_research_provider.py),
which have no local equivalent. Setup guide: docs/local-llm-ollama-setup.md.

Talks to Ollama's native REST API (``POST /api/chat``) over httpx — already
a dependency, so no new package. Structured output uses Ollama's
``format=<JSON schema>``: a real grammar-constrained guarantee on shape,
the same bar Gemini's ``response_schema`` and Mistral's strict json_schema
meet (not prompt-engineered JSON).

Two local-model failure modes are turned into loud errors rather than a
quietly worse analysis (CLAUDE.md Rule 2 — evidence-first):

* Context overflow. Ollama silently truncates a prompt longer than
  ``num_ctx`` — which would drop evidence the model is then asked to cite.
  If the prompt fills the window, the call is refused with a message
  telling you to raise ``OLLAMA_NUM_CTX``.
* Output truncation (``done_reason == "length"``) — half a JSON object.

2026-09-25 — streaming. A non-streaming call has to finish inside one HTTP
read timeout, so a slow-but-healthy generation (14B on a 12GB card, part of
the model spilled to the CPU) failed with "timed out" even though tokens were
still coming. Calls now stream: the read timeout only has to cover the gap
between two chunks (``stall_timeout_seconds`` — model load + reading the
prompt), and ``timeout_seconds`` is an overall wall-clock cap. A timeout
reports how far it got (tokens, tokens/s) and how much of the model sits on
the GPU (``/api/ps``), so the error says *why* it was slow. A model stuck
emitting whitespace (a known failure of grammar-constrained JSON) is stopped
early instead of burning the whole budget.

CLAUDE.md Rule 1 still applies: this layer only hands back the model's raw
structured record; nothing here computes a financial figure.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from pydantic import BaseModel

from app.providers.base import (
    LLMProvider,
    LLMResponse,
    LLMUnavailableError,
    LLMUsageMetrics,
)

# Connection-level retries only: a local server has no quota to pace
# against, and a slow generation is not retried (it would just be slow again).
_CONNECT_RETRY_DELAYS_SECONDS = (2.0, 5.0)

# Grammar-constrained JSON sometimes degenerates into an endless run of
# newlines/spaces until num_predict. Real indentation never gets near this.
_MAX_WHITESPACE_RUN = 600
_PROGRESS_LOG_SECONDS = 60.0

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class OllamaHealth:
    ok: bool
    detail: str
    # Set when the model is loaded but part of it runs on the CPU, the
    # usual reason a local pass is several times slower than expected.
    warning: str | None = None


def gpu_share(
    *, base_url: str, model: str, api_key: str | None = None, timeout: float = 3.0
) -> float | None:
    """Fraction (0–1) of the loaded model that sits in VRAM, from
    ``GET /api/ps``. None when the model isn't loaded or Ollama can't be
    asked. Never raises: it only feeds diagnostics."""
    try:
        resp = httpx.get(base_url.rstrip("/") + "/api/ps", headers=_headers(api_key), timeout=timeout)
        resp.raise_for_status()
        for m in resp.json().get("models", []):
            if _model_matches(model, m.get("name") or m.get("model") or ""):
                size = float(m.get("size") or 0)
                if size <= 0:
                    return None
                return max(0.0, min(1.0, float(m.get("size_vram") or 0) / size))
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    return None


def _offload_advice(share: float | None) -> str:
    if share is None or share >= 0.99:
        return ""
    return (
        f" Only {share:.0%} of the model is on the GPU; the rest runs on the CPU, which is "
        "several times slower. Close other GPU-heavy apps, lower OLLAMA_NUM_CTX, check "
        "OLLAMA_NUM_PARALLEL=1 and OLLAMA_KV_CACHE_TYPE=q8_0, or use qwen3:8b."
    )


def _headers(api_key: str | None) -> dict[str, str]:
    # Plain Ollama has no auth. The header only matters when Ollama sits
    # behind an authenticating reverse proxy/tunnel (see the setup guide).
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _model_matches(wanted: str, installed: str) -> bool:
    if ":" in wanted:
        return installed == wanted
    return installed == wanted or installed == f"{wanted}:latest"


def check_ollama_health(
    *, base_url: str, model: str, api_key: str | None = None, timeout: float = 3.0
) -> OllamaHealth:
    """Is the server reachable, and is the configured model pulled?

    Cheap (``GET /api/tags``, no generation) — used by the analysis
    readiness check so a stopped Ollama shows up before a run, not as a
    failed run.
    """
    url = base_url.rstrip("/") + "/api/tags"
    try:
        resp = httpx.get(url, headers=_headers(api_key), timeout=timeout)
        resp.raise_for_status()
        names = [m.get("name", "") for m in resp.json().get("models", [])]
    except (httpx.HTTPError, ValueError) as exc:
        return OllamaHealth(
            False,
            f"Can't reach Ollama at {base_url} ({exc.__class__.__name__}). "
            "Is the Ollama app running on this computer?",
        )
    if not any(_model_matches(model, n) for n in names):
        return OllamaHealth(
            False,
            f"Ollama is running but model '{model}' isn't pulled — run: ollama pull {model}",
        )
    share = gpu_share(base_url=base_url, model=model, api_key=api_key, timeout=timeout)
    if share is not None and share < 0.99:
        return OllamaHealth(
            True,
            f"Ollama reachable, model '{model}' loaded, but only {share:.0%} of it is on the GPU.",
            warning=_offload_advice(share).strip(),
        )
    loaded = " (loaded, 100% on the GPU)" if share is not None else ""
    return OllamaHealth(True, f"Ollama reachable, model '{model}' available{loaded}.")


@dataclass
class _ChatResult:
    """What one streamed ``/api/chat`` call produced — shaped like
    Ollama's non-streaming response so the checks below read the same."""

    status_code: int
    error_text: str = ""
    content: str = ""
    final: dict[str, Any] = field(default_factory=dict)


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        temperature: float = 0.2,
        max_output_tokens: int = 8192,
        num_ctx: int = 16384,
        keep_alive: str = "30m",
        timeout_seconds: float = 1800.0,
        stall_timeout_seconds: float = 600.0,
        think: bool | None = False,
        api_key: str | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        if not base_url:
            raise LLMUnavailableError("OLLAMA_BASE_URL is not set — cannot call Ollama.")
        if not model:
            raise LLMUnavailableError("OLLAMA_MODEL_NAME is not set — cannot call Ollama.")
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._temperature = temperature
        self._max_output_tokens = max_output_tokens
        self._num_ctx = num_ctx
        self._keep_alive = keep_alive
        self._think = think
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds
        self._stall_timeout_seconds = stall_timeout_seconds
        # Streaming: the read timeout is the longest allowed gap between two
        # chunks, not the whole generation (see the module docstring).
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(stall_timeout_seconds, connect=10.0),
            headers=_headers(api_key),
        )

    def _payload(
        self, system_prompt: str, user_prompt: str, schema: dict[str, Any], *, with_think: bool
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "format": schema,
            "stream": True,
            "keep_alive": self._keep_alive,
            "options": {
                "temperature": self._temperature,
                "num_ctx": self._num_ctx,
                "num_predict": self._max_output_tokens,
            },
        }
        if with_think and self._think is not None:
            payload["think"] = self._think
        return payload

    def _timeout_error(self, reason: str, started: float, output_tokens: int) -> LLMUnavailableError:
        elapsed = time.monotonic() - started
        mins, secs = divmod(int(elapsed), 60)
        if output_tokens:
            progress = (
                f"~{output_tokens:,} tokens in {mins}m {secs:02d}s "
                f"(~{output_tokens / max(elapsed, 1e-6):.1f} tokens/s)"
            )
        else:
            progress = f"no output after {mins}m {secs:02d}s (still loading the model or reading the prompt)"
        share = gpu_share(base_url=self._base_url, model=self._model, api_key=self._api_key)
        advice = _offload_advice(share) or (
            " If this keeps happening, raise OLLAMA_TIMEOUT_SECONDS / OLLAMA_STALL_TIMEOUT_SECONDS "
            "or use a smaller model (qwen3:8b)."
        )
        return LLMUnavailableError(
            f"Ollama timed out generating (model={self._model}): {reason}; {progress}.{advice}"
        )

    def _chat(self, payload: dict[str, Any]) -> _ChatResult:
        """One streamed ``/api/chat`` call, with connection-level retries."""
        url = f"{self._base_url}/api/chat"
        last_exc: Exception | None = None
        for attempt in range(len(_CONNECT_RETRY_DELAYS_SECONDS) + 1):
            try:
                return self._stream_once(url, payload)
            except httpx.ConnectError as exc:
                last_exc = exc
                if attempt < len(_CONNECT_RETRY_DELAYS_SECONDS):
                    time.sleep(_CONNECT_RETRY_DELAYS_SECONDS[attempt])
            except httpx.HTTPError as exc:
                raise LLMUnavailableError(f"Ollama request failed (model={self._model}): {exc}") from exc
        raise LLMUnavailableError(
            f"Can't reach Ollama at {self._base_url} (model={self._model}) — is the Ollama app "
            f"running? ({last_exc})"
        )

    def _stream_once(self, url: str, payload: dict[str, Any]) -> _ChatResult:
        started = time.monotonic()
        last_log = started
        parts: list[str] = []
        chunks = 0
        whitespace_run = 0
        try:
            with self._client.stream("POST", url, json=payload) as resp:
                if resp.status_code >= 400:
                    resp.read()
                    return _ChatResult(resp.status_code, error_text=resp.text)
                for line in resp.iter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except ValueError as exc:
                        raise LLMUnavailableError(
                            f"Ollama returned non-JSON (model={self._model})"
                        ) from exc
                    if chunk.get("error"):
                        raise LLMUnavailableError(
                            f"Ollama failed mid-generation (model={self._model}): {chunk['error']}"
                        )
                    piece = (chunk.get("message") or {}).get("content") or ""
                    if piece:
                        parts.append(piece)
                        chunks += 1
                        stripped = piece.rstrip()
                        if not stripped:
                            whitespace_run += len(piece)
                        else:
                            whitespace_run = len(piece) - len(stripped)
                        if whitespace_run > _MAX_WHITESPACE_RUN:
                            raise LLMUnavailableError(
                                f"Ollama got stuck emitting blank output after {chunks:,} chunks "
                                f"(model={self._model}) — stopped early instead of waiting for the "
                                "output limit. Running again usually works; if it repeats, try "
                                "another model."
                            )
                    if chunk.get("done"):
                        return _ChatResult(resp.status_code, content="".join(parts), final=chunk)
                    now = time.monotonic()
                    if now - started > self._timeout_seconds:
                        raise self._timeout_error(
                            f"passed the {int(self._timeout_seconds)}s limit (OLLAMA_TIMEOUT_SECONDS)",
                            started,
                            chunks,
                        )
                    if now - last_log >= _PROGRESS_LOG_SECONDS:
                        last_log = now
                        log.info(
                            "ollama %s: %d chunks in %.0fs (%.1f/s)",
                            self._model, chunks, now - started, chunks / (now - started),
                        )
        except httpx.TimeoutException as exc:
            raise self._timeout_error(
                f"no new output for {int(self._stall_timeout_seconds)}s (OLLAMA_STALL_TIMEOUT_SECONDS)",
                started,
                chunks,
            ) from exc
        raise LLMUnavailableError(
            f"Ollama closed the stream before finishing (model={self._model}, {chunks:,} chunks)."
        )

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
    ) -> LLMResponse:
        schema = response_schema.model_json_schema()
        result = self._chat(self._payload(system_prompt, user_prompt, schema, with_think=True))

        # Models without a thinking mode reject the `think` field outright;
        # retry once without it rather than making the setting a trap.
        if (
            result.status_code == 400
            and "think" in result.error_text.lower()
            and self._think is not None
        ):
            result = self._chat(self._payload(system_prompt, user_prompt, schema, with_think=False))

        if result.status_code == 404:
            raise LLMUnavailableError(
                f"Ollama doesn't have model '{self._model}' — run: ollama pull {self._model}"
            )
        if result.status_code >= 400:
            raise LLMUnavailableError(
                f"Ollama returned HTTP {result.status_code} (model={self._model}): {result.error_text[:500]}"
            )

        body = result.final
        prompt_tokens = int(body.get("prompt_eval_count") or 0)
        output_tokens = int(body.get("eval_count") or 0)

        if prompt_tokens >= self._num_ctx - 16:
            raise LLMUnavailableError(
                f"The analysis prompt ({prompt_tokens} tokens) filled Ollama's context window "
                f"(OLLAMA_NUM_CTX={self._num_ctx}), so evidence may have been cut off. "
                "Raise OLLAMA_NUM_CTX (and keep OLLAMA_KV_CACHE_TYPE=q8_0 so it still fits in VRAM)."
            )
        if body.get("done_reason") == "length":
            raise LLMUnavailableError(
                f"Ollama stopped at the output limit ({output_tokens} tokens) before finishing the "
                f"JSON (model={self._model}) — raise LLM_MAX_OUTPUT_TOKENS or OLLAMA_NUM_CTX."
            )

        content = result.content
        if not content.strip():
            raise LLMUnavailableError(f"Ollama returned an empty response (model={self._model})")

        return LLMResponse(
            content=content,
            usage=LLMUsageMetrics(
                provider=self.name,
                model=self._model,
                input_tokens=prompt_tokens,
                output_tokens=output_tokens,
                total_tokens=prompt_tokens + output_tokens,
            ),
        )
