"""Google AI Studio (Gemini) provider — Aladdin's primary LLM.

`gemini-3.6-flash` is the default model: the exact replacement Google's own
API named when `gemini-2.5-flash` (the original ADR 0005 default) was
restricted to pre-existing accounts only — see
claude/gemini-model-retirement-fix.md. If a future model retirement repeats
this, update `LLM_MODEL_NAME`/`settings.llm_model_name`, not this file.
"""
from __future__ import annotations

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel

from app.providers.base import (
    LLMProvider,
    LLMResponse,
    LLMUnavailableError,
    LLMUsageMetrics,
)
from app.providers.gemini_retry import call_with_retry


class GoogleAIStudioProvider(LLMProvider):
    name = "google_ai_studio"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        temperature: float = 0.2,
        max_output_tokens: int = 8192,
        rpm: int = 0,
    ) -> None:
        if not api_key:
            raise LLMUnavailableError(
                "GOOGLE_AI_STUDIO_API_KEY is not set — cannot call Gemini."
            )
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._temperature = temperature
        self._max_output_tokens = max_output_tokens
        self._rpm = rpm

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
    ) -> LLMResponse:
        config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=self._temperature,
            max_output_tokens=self._max_output_tokens,
        )

        def _call() -> genai_types.GenerateContentResponse:
            return self._client.models.generate_content(
                model=self._model,
                contents=user_prompt,
                config=config,
            )

        try:
            response = call_with_retry(_call, rpm=self._rpm)
        except genai_errors.APIError as exc:
            raise LLMUnavailableError(
                f"Gemini API call failed (model={self._model}): {exc}"
            ) from exc

        if not response.text:
            raise LLMUnavailableError(
                f"Gemini returned an empty response (model={self._model})"
            )

        usage = response.usage_metadata
        return LLMResponse(
            content=response.text,
            usage=LLMUsageMetrics(
                provider=self.name,
                model=self._model,
                input_tokens=(usage.prompt_token_count or 0) if usage else 0,
                output_tokens=(usage.candidates_token_count or 0) if usage else 0,
                total_tokens=(usage.total_token_count or 0) if usage else 0,
            ),
        )
