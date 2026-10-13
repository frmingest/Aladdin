"""Google AI Studio (Gemini) provider — Aladdin's primary LLM.

`gemini-3.6-flash` is the default model: the exact replacement Google's own
API named when `gemini-2.5-flash` (the original ADR 0005 default) was
restricted to pre-existing accounts only — see
claude/gemini-model-retirement-fix.md. If a future model retirement repeats
this, update `LLM_MODEL_NAME`/`settings.llm_model_name`, not this file.
"""
from __future__ import annotations

import time

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
from app.providers.budget import DailyBudgetGuard
from app.providers.gemini_retry import DailyBudgetExceededError, call_with_retry
from app.services.llm_ledger import SessionFactory
from app.services.llm_prompt_log import record_prompt


def _usage_tokens(response: genai_types.GenerateContentResponse) -> tuple[int | None, int | None]:
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        return None, None
    return usage.prompt_token_count, usage.candidates_token_count


class GoogleAIStudioProvider(LLMProvider):
    name = "google_ai_studio"
    # Injected by the provider factory; None (unit tests) makes the prompt log a no-op.
    prompt_log_session_factory: SessionFactory | None = None

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        temperature: float = 0.2,
        max_output_tokens: int = 8192,
        rpm: int = 0,
        budget_guard: DailyBudgetGuard | None = None,
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
        self._budget_guard = budget_guard

    def _generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        max_output_tokens: int | None = None,
    ) -> LLMResponse:
        # Caller override (e.g. a fund/ETF blind pass needing more room for
        # the bigger fund_v1 schema, 2026-09-27) beats this provider's own
        # configured default.
        config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=self._temperature,
            max_output_tokens=max_output_tokens if max_output_tokens is not None else self._max_output_tokens,
        )

        def _call() -> genai_types.GenerateContentResponse:
            return self._client.models.generate_content(
                model=self._model,
                contents=user_prompt,
                config=config,
            )

        try:
            response = call_with_retry(
                _call,
                rpm=self._rpm,
                budget_guard=self._budget_guard,
                call_type="structured",
                model_name=self._model,
                usage_of=_usage_tokens,
            )
        except DailyBudgetExceededError as exc:
            raise LLMUnavailableError(
                f"Gemini daily request budget exhausted (model={self._model}): {exc}"
            ) from exc
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

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        max_output_tokens: int | None = None,
    ) -> LLMResponse:
        """Run the call and write one prompt-log row (one per logical call;
        the retry ladder and quota accounting stay in gemini_retry.py)."""
        started = time.monotonic()
        try:
            response = self._generate_structured(
                system_prompt=system_prompt, user_prompt=user_prompt,
                response_schema=response_schema, max_output_tokens=max_output_tokens,
            )
        except Exception as exc:
            record_prompt(
                self.prompt_log_session_factory, provider=self.name, model_name=self._model,
                call_type="structured", schema_name=response_schema.__name__,
                system_prompt=system_prompt, user_prompt=user_prompt, outcome="error",
                error_detail=f"{type(exc).__name__}: {exc}",
                latency_ms=(time.monotonic() - started) * 1000,
            )
            raise
        record_prompt(
            self.prompt_log_session_factory, provider=self.name, model_name=self._model,
            call_type="structured", schema_name=response_schema.__name__,
            system_prompt=system_prompt, user_prompt=user_prompt, response_text=response.content,
            outcome="success", latency_ms=(time.monotonic() - started) * 1000,
            input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens,
        )
        return response
