"""Mistral LLM provider — fallback behind Google AI Studio's free tier
(§29, 2026-09-17 — see claude/llm-provider-alternatives-2026-09-17.md for
the full comparison against local Ollama and other alternatives). Only ever
constructed/called when app.services.analysis.runner determines Gemini's
daily free-tier request budget (settings.llm_rate_limit_rpd) is exhausted
for a holding and settings.llm_fallback_provider == "mistral" — Gemini stays
the primary/default provider (docs/decisions/0005) for its stronger observed
reasoning quality on real filings; this exists purely so a holding gets a
real (if lower-priority) analysis instead of being skipped outright once the
daily cap is spent.

Uses the mistralai SDK's native structured-outputs feature: a JSON schema
generated from the pydantic response_schema, passed as `response_format`
with `"strict": True` (mistralai.extra.utils.response_format.
response_format_from_pydantic_model, introspected against the real installed
mistralai==2.10.1 SDK) — a genuine schema-constrained guarantee on output
*shape*, not prompt-engineered JSON, matching what
app.providers.base.LLMProvider requires of every implementation. This calls
`client.chat.complete` directly rather than the SDK's `.chat.parse()`
convenience wrapper (which returns an already-parsed pydantic instance) —
keeping the raw JSON string as `LLMResponse.content`, exactly like
GoogleAIStudioProvider, so schema validation stays in
app.services.analysis.llm_analysis for every provider alike (§28 rule 8:
vendor details never leak past this boundary).

Every call is paced and retried through app.providers.mistral_retry — see
that module's docstring for why it's a separate, Mistral-specific twin of
app.providers.gemini_retry rather than a shared abstraction.
"""

import time
from typing import Any

from mistralai.client import Mistral
from mistralai.client.models.systemmessage import SystemMessageTypedDict
from mistralai.client.models.usermessage import UserMessageTypedDict
from mistralai.extra.utils.response_format import response_format_from_pydantic_model
from pydantic import BaseModel

from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.providers.mistral_retry import call_with_retry


class MistralProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        max_output_tokens: int,
        temperature: float,
        rpm: int = 0,
    ):
        if not api_key:
            raise LLMUnavailableError("MISTRAL_API_KEY is not configured — set it in backend/.env")
        self._client = Mistral(api_key=api_key)
        self._model = model
        self._max_output_tokens = max_output_tokens
        self._temperature = temperature
        # 0 (default) disables pacing — app.providers.factory always passes
        # the real settings.mistral_rate_limit_rpm for production wiring;
        # tests construct this provider directly and get no pacing unless a
        # test explicitly asks for it (see mistral_retry.pace_call).
        self._rpm = rpm

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        prompt_version: str,
    ) -> LLMResponse:
        # started is measured around the whole paced/retried call, same
        # convention as GoogleAIStudioProvider — see that provider's
        # docstring for why (honest latency accounting, retries included).
        started = time.monotonic()
        response_format = response_format_from_pydantic_model(response_schema)
        messages: list[SystemMessageTypedDict | UserMessageTypedDict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        try:
            response = call_with_retry(
                lambda: self._client.chat.complete(
                    model=self._model,
                    messages=messages,
                    response_format=response_format,
                    max_tokens=self._max_output_tokens,
                    temperature=self._temperature,
                ),
                rpm=self._rpm,
            )
        except Exception as exc:
            # LLMUnavailableError (§28 rule 8: provider-specific details, including
            # the mistralai exception hierarchy, never leak past this boundary).
            # call_with_retry already retried the retryable cases (429/5xx) —
            # anything still raising here is either a permanent error or a
            # transient one that didn't clear within the retry budget.
            raise LLMUnavailableError(
                f"Mistral API call failed (prompt_version={prompt_version}, model={self._model}): {exc}"
            ) from exc

        latency_ms = (time.monotonic() - started) * 1000
        text = _extract_text(response)
        if not text:
            raise LLMUnavailableError(
                f"Mistral returned no usable content for prompt_version={prompt_version} "
                f"(finish_reason={_finish_reason(response)})"
            )

        usage = getattr(response, "usage", None)
        return LLMResponse(
            content=text,
            model=self._model,
            input_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            output_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            latency_ms=latency_ms,
        )


def _extract_text(response: Any) -> str | None:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return None
    content = getattr(choices[0].message, "content", None)
    if isinstance(content, str):
        return content or None
    # Defensive: some SDK response shapes can carry a list of content chunks
    # even for a text/JSON-only completion — join any text parts rather than
    # fail outright on a shape difference that doesn't actually mean "no
    # content" (§21 — fail visibly only when there's genuinely nothing usable).
    if isinstance(content, list):
        joined = "".join(getattr(part, "text", "") or "" for part in content)
        return joined or None
    return None


def _finish_reason(response: Any) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return "unknown"
    return str(getattr(choices[0], "finish_reason", "unknown"))
