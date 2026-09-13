"""
Google AI Studio (Gemini) LLM provider (architecture §11, decision 0005).

Chosen over the architecture's original recommendation of the Anthropic
Claude API (docs/architecture.md §4) for its free tier — see
docs/decisions/0005-phase3-google-ai-studio-llm-provider.md for the full
reasoning. Because app/services/analysis depends only on the LLMProvider
interface (app.providers.base), swapping back to Anthropic later, or adding
it as a second provider, is a new file behind app.providers.factory — no
service-layer change (§28 rule 8).

Uses the `google-genai` SDK's structured-output feature: passing a pydantic
model class as `response_schema` alongside `response_mime_type="application/
json"` makes the API constrain generation to that shape, and the SDK
converts the pydantic schema on our behalf — we never hand-write a
vendor-specific schema format here.
"""

import time
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError


class GoogleAIStudioProvider(LLMProvider):
    def __init__(self, api_key: str, model: str, max_output_tokens: int, temperature: float):
        if not api_key:
            raise LLMUnavailableError(
                "GOOGLE_AI_STUDIO_API_KEY is not configured — set it in backend/.env"
            )
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._max_output_tokens = max_output_tokens
        self._temperature = temperature

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        prompt_version: str,
    ) -> LLMResponse:
        started = time.monotonic()
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=user_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    max_output_tokens=self._max_output_tokens,
                    temperature=self._temperature,
                ),
            )
        except Exception as exc:  # noqa: BLE001 — any vendor-SDK failure becomes
            # LLMUnavailableError (§28 rule 8: provider-specific details, including
            # the google-genai exception hierarchy, never leak past this boundary).
            # This session's sandbox has no network path to the Gemini API to
            # verify the exact exception types live against; see decision 0005's
            # Consequences for the same caveat Phase 2's yfinance provider carries.
            raise LLMUnavailableError(
                f"Gemini API call failed (prompt_version={prompt_version}, model={self._model}): {exc}"
            ) from exc

        latency_ms = (time.monotonic() - started) * 1000
        text = getattr(response, "text", None)
        if not text:
            raise LLMUnavailableError(
                f"Gemini returned no usable content for prompt_version={prompt_version} "
                f"(finish_reason={_finish_reason(response)})"
            )

        usage = getattr(response, "usage_metadata", None)
        return LLMResponse(
            content=text,
            model=self._model,
            input_tokens=getattr(usage, "prompt_token_count", None) if usage else None,
            output_tokens=getattr(usage, "candidates_token_count", None) if usage else None,
            latency_ms=latency_ms,
        )


def _finish_reason(response: Any) -> str:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return "unknown"
    return str(getattr(candidates[0], "finish_reason", "unknown"))
