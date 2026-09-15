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

Every call is paced and retried through app.providers.gemini_retry (added
2026-09-15 — see that module's docstring for why): a transient 503
("high demand, try again later") or 429 no longer permanently fails the
holding on the first bad response, and a multi-holding analysis run no
longer bursts past the free tier's requests-per-minute cap.
"""

import time
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.providers.gemini_retry import call_with_retry


class GoogleAIStudioProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        max_output_tokens: int,
        temperature: float,
        rpm: int = 0,
    ):
        if not api_key:
            raise LLMUnavailableError(
                "GOOGLE_AI_STUDIO_API_KEY is not configured — set it in backend/.env"
            )
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._max_output_tokens = max_output_tokens
        self._temperature = temperature
        # 0 (default) disables pacing — app.providers.factory always passes
        # the real settings.llm_rate_limit_rpm for production wiring; tests
        # construct this provider directly and get no pacing unless a test
        # explicitly asks for it (see gemini_retry.pace_call).
        self._rpm = rpm

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        prompt_version: str,
    ) -> LLMResponse:
        # started is measured around the whole paced/retried call, not just
        # the final attempt — on a run that needed a retry, latency_ms below
        # honestly reflects the real wall-clock cost of getting a usable
        # response, pacing and backoff included, rather than hiding it.
        started = time.monotonic()
        try:
            response = call_with_retry(
                lambda: self._client.models.generate_content(
                    model=self._model,
                    contents=user_content,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        max_output_tokens=self._max_output_tokens,
                        temperature=self._temperature,
                    ),
                ),
                rpm=self._rpm,
            )
        except Exception as exc:  # noqa: BLE001 — any vendor-SDK failure becomes
            # LLMUnavailableError (§28 rule 8: provider-specific details, including
            # the google-genai exception hierarchy, never leak past this boundary).
            # call_with_retry already retried the transient cases (503/429) —
            # anything still raising here is either a permanent error or a
            # transient one that didn't clear within the retry budget.
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
