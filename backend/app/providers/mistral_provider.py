"""Mistral provider — fallback LLM behind Gemini.

Reached only once the primary's daily free-tier budget is spent (see
claude/llm-provider-alternatives-2026-09-17.md for why Mistral over a full
swap or local Ollama, and claude/mistral-fallback-provider-2026-09-17.md for
the original build). Uses the mistralai SDK's native structured-output mode
(`response_format` with a strict JSON schema) — a genuine schema-constrained
guarantee on output shape, the same bar Gemini's `response_schema` meets,
not prompt-engineered JSON.
"""
from __future__ import annotations

from mistralai import Mistral
from mistralai.models.chatcompletionresponse import ChatCompletionResponse
from mistralai.models.jsonschema import JSONSchema
from mistralai.models.responseformat import ResponseFormat
from mistralai.models.sdkerror import SDKError
from mistralai.models.systemmessage import SystemMessage
from mistralai.models.usermessage import UserMessage
from pydantic import BaseModel

from app.providers.base import (
    LLMProvider,
    LLMResponse,
    LLMUnavailableError,
    LLMUsageMetrics,
)
from app.providers.mistral_retry import call_with_retry


class MistralProvider(LLMProvider):
    name = "mistral"

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
            raise LLMUnavailableError("MISTRAL_API_KEY is not set — cannot call Mistral.")
        self._client = Mistral(api_key=api_key)
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
        response_format = ResponseFormat(
            type="json_schema",
            json_schema=JSONSchema(
                name=response_schema.__name__,
                schema_definition=response_schema.model_json_schema(),
                strict=True,
            ),
        )

        def _call() -> ChatCompletionResponse:
            result = self._client.chat.complete(
                model=self._model,
                messages=[
                    SystemMessage(content=system_prompt),
                    UserMessage(content=user_prompt),
                ],
                temperature=self._temperature,
                max_tokens=self._max_output_tokens,
                response_format=response_format,
            )
            if result is None:
                raise LLMUnavailableError(
                    f"Mistral returned no response (model={self._model})"
                )
            return result

        try:
            response = call_with_retry(_call, rpm=self._rpm)
        except SDKError as exc:
            raise LLMUnavailableError(
                f"Mistral API call failed (model={self._model}): {exc}"
            ) from exc

        if not response.choices:
            raise LLMUnavailableError(f"Mistral returned no choices (model={self._model})")

        content = response.choices[0].message.content
        if not content or not isinstance(content, str):
            raise LLMUnavailableError(
                f"Mistral returned an empty response (model={self._model})"
            )

        usage = response.usage
        return LLMResponse(
            content=content,
            usage=LLMUsageMetrics(
                provider=self.name,
                model=self._model,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            ),
        )
