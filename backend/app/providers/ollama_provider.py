"""Ollama local LLM provider — runs the analysis LLM against a self-hosted
Ollama server instead of a cloud vendor (§29, 2026-09-17 local-LLM migration
— see docs/decisions/0017-local-llm-migration-ollama.md and
claude/local-llm-migration-plan-2026-09-17.md for the full reasoning: why
Gemini's/Mistral's free tiers proved unworkable for a document-heavy,
on-demand analysis workload, and why a 12B-14B-class open-weight model on
Faiz's own RTX 3060 12GB is the replacement rather than a bigger/paid cloud
tier).

Uses Ollama's native structured-outputs feature: `chat(..., format=<json
schema dict>)` grammar-constrains the model's decoding to a JSON Schema,
the same category of guarantee `response_schema` gives on Gemini and
Mistral (a real shape guarantee, not prompt-engineered JSON) — see
https://ollama.com/blog/structured-outputs. Unlike those two providers, the
schema is generated with pydantic's own `model_json_schema()` rather than a
vendor SDK helper, since Ollama's `format` parameter accepts a plain JSON
Schema dict directly.

No API key: there's no vendor account here, just a server Faiz runs himself
(see the ADR for the localhost-vs-LAN/Tailscale topology decision). The
closest equivalent failure mode to "wrong/missing API key" is "wrong
OLLAMA_BASE_URL" or "the model named in OLLAMA_MODEL_NAME was never pulled
on that server" — both surface as an error from the call itself (connection
refused, or a 404 from Ollama), not a constructor-time check, since this
provider has no cheap way to verify either up front without making a call.
"""

import time
from typing import Any

import ollama
from pydantic import BaseModel

from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.providers.ollama_retry import call_with_retry


class OllamaProvider(LLMProvider):
    def __init__(
        self,
        base_url: str,
        model: str,
        max_output_tokens: int,
        temperature: float,
        context_window: int,
        keep_alive_minutes: int,
    ):
        if not base_url:
            raise LLMUnavailableError("OLLAMA_BASE_URL is not configured — set it in backend/.env")
        if not model:
            raise LLMUnavailableError("OLLAMA_MODEL_NAME is not configured — set it in backend/.env")
        self._base_url = base_url
        self._client = ollama.Client(host=base_url)
        self._model = model
        self._max_output_tokens = max_output_tokens
        self._temperature = temperature
        # KV-cache size, not model size — kept modest by default (see
        # settings.ollama_context_window's docstring) because Aladdin's own
        # prompts (persona/synthesis + a ~12K-char evidence excerpt budget,
        # settings.llm_excerpt_char_budget) never come close to needing a
        # 40K+ context window, and a smaller KV cache leaves more of the
        # 3060's 12GB for the model weights themselves.
        self._context_window = context_window
        # Keeps the model resident in VRAM between calls instead of
        # reloading it from disk on every holding (a 9GB Q4 model can take
        # real seconds to load) — see the ADR's "keep_alive" note. Ollama's
        # own duration-string format, e.g. "30m"; "-1" would mean "forever"
        # but a bounded value is safer default behavior on a single-GPU
        # desktop Faiz also uses for other things.
        self._keep_alive = f"{keep_alive_minutes}m"

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        prompt_version: str,
    ) -> LLMResponse:
        # started is measured around the whole retried call, same convention
        # as the other providers — see GoogleAIStudioProvider's docstring for
        # why (honest latency accounting, retries included).
        started = time.monotonic()
        schema = response_schema.model_json_schema()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        try:
            response = call_with_retry(
                lambda: self._client.chat(
                    model=self._model,
                    messages=messages,
                    format=schema,
                    options={
                        "temperature": self._temperature,
                        "num_predict": self._max_output_tokens,
                        "num_ctx": self._context_window,
                    },
                    keep_alive=self._keep_alive,
                )
            )
        except Exception as exc:
            # LLMUnavailableError (§28 rule 8: provider-specific details never
            # leak past this boundary). call_with_retry already retried the
            # transient cases — anything still raising here is either a
            # permanent error (model not pulled, bad schema/options) or a
            # transient one that didn't clear within the retry budget.
            raise LLMUnavailableError(
                f"Ollama call failed (prompt_version={prompt_version}, model={self._model}, "
                f"host={self._base_url}): {exc}"
            ) from exc

        latency_ms = (time.monotonic() - started) * 1000
        text = response.message.content if response.message else None
        if not text:
            raise LLMUnavailableError(
                f"Ollama returned no usable content for prompt_version={prompt_version} "
                f"(done_reason={_done_reason(response)})"
            )

        return LLMResponse(
            content=text,
            model=self._model,
            input_tokens=response.prompt_eval_count,
            output_tokens=response.eval_count,
            latency_ms=latency_ms,
        )


def _done_reason(response: Any) -> str:
    return str(getattr(response, "done_reason", None) or "unknown")
