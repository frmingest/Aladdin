"""Mixin that writes one LLM usage ledger row per `generate_structured` call.

For providers without a request-budget guard of their own (Mistral, Ollama).
Gemini is deliberately NOT wrapped: its retry helper already records every
real attempt (retries included) through LedgerBudgetGuard, and recording here
too would double-count. A provider using this mixin implements
`_generate_structured` instead of `generate_structured`; the ledger session
factory is injected by the provider factory and is None in unit tests, which
turns recording into a no-op.
"""
from __future__ import annotations

import time
from typing import Any

from pydantic import BaseModel

from app.models.llm_usage import OUTCOME_ERROR, OUTCOME_SUCCESS
from app.providers.base import LLMResponse
from app.services.llm_ledger import SessionFactory, record_event


class LedgerRecordingMixin:
    name: str
    _model: str
    ledger_session_factory: SessionFactory | None = None

    def _generate_structured(self, **kwargs: Any) -> LLMResponse:  # pragma: no cover - overridden
        raise NotImplementedError

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        max_output_tokens: int | None = None,
    ) -> LLMResponse:
        started = time.monotonic()
        try:
            response = self._generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=response_schema,
                max_output_tokens=max_output_tokens,
            )
        except Exception as exc:
            record_event(
                self.ledger_session_factory, provider=self.name, model_name=self._model,
                call_type="structured", outcome=OUTCOME_ERROR,
                latency_ms=(time.monotonic() - started) * 1000,
                error_detail=f"{type(exc).__name__}: {exc}",
            )
            raise
        record_event(
            self.ledger_session_factory, provider=self.name, model_name=self._model,
            call_type="structured", outcome=OUTCOME_SUCCESS,
            latency_ms=(time.monotonic() - started) * 1000,
            input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens,
        )
        return response
