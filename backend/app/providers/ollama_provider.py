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

CLAUDE.md Rule 1 still applies: this layer only hands back the model's raw
structured record; nothing here computes a financial figure.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
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


@dataclass(frozen=True)
class OllamaHealth:
    ok: bool
    detail: str


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
    return OllamaHealth(True, f"Ollama reachable, model '{model}' available.")


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
        timeout_seconds: float = 900.0,
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
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(timeout_seconds, connect=10.0),
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
            "stream": False,
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

    def _post(self, payload: dict[str, Any]) -> httpx.Response:
        url = f"{self._base_url}/api/chat"
        last_exc: Exception | None = None
        for attempt in range(len(_CONNECT_RETRY_DELAYS_SECONDS) + 1):
            try:
                return self._client.post(url, json=payload)
            except httpx.ConnectError as exc:
                last_exc = exc
                if attempt < len(_CONNECT_RETRY_DELAYS_SECONDS):
                    time.sleep(_CONNECT_RETRY_DELAYS_SECONDS[attempt])
            except httpx.TimeoutException as exc:
                raise LLMUnavailableError(
                    f"Ollama timed out generating (model={self._model}). A 14B model on a 12GB "
                    "card can take several minutes per pass — raise OLLAMA_TIMEOUT_SECONDS or "
                    "use a smaller model."
                ) from exc
            except httpx.HTTPError as exc:
                raise LLMUnavailableError(f"Ollama request failed (model={self._model}): {exc}") from exc
        raise LLMUnavailableError(
            f"Can't reach Ollama at {self._base_url} (model={self._model}) — is the Ollama app "
            f"running? ({last_exc})"
        )

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
    ) -> LLMResponse:
        schema = response_schema.model_json_schema()
        resp = self._post(self._payload(system_prompt, user_prompt, schema, with_think=True))

        # Models without a thinking mode reject the `think` field outright;
        # retry once without it rather than making the setting a trap.
        if resp.status_code == 400 and "think" in resp.text.lower() and self._think is not None:
            resp = self._post(self._payload(system_prompt, user_prompt, schema, with_think=False))

        if resp.status_code == 404:
            raise LLMUnavailableError(
                f"Ollama doesn't have model '{self._model}' — run: ollama pull {self._model}"
            )
        if resp.status_code >= 400:
            raise LLMUnavailableError(
                f"Ollama returned HTTP {resp.status_code} (model={self._model}): {resp.text[:500]}"
            )

        try:
            body = resp.json()
        except ValueError as exc:
            raise LLMUnavailableError(f"Ollama returned non-JSON (model={self._model})") from exc

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

        content = (body.get("message") or {}).get("content") or ""
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
