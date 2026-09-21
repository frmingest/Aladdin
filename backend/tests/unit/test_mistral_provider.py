"""Unit tests for MistralProvider, mocking the mistralai client (no real
network call — these must never spend real Mistral quota)."""
from unittest.mock import MagicMock, patch

import pytest
from mistralai.models.sdkerror import SDKError
from pydantic import BaseModel

from app.providers.base import LLMUnavailableError
from app.providers.mistral_provider import MistralProvider


class _EchoSchema(BaseModel):
    verdict: str


def _make_provider(**overrides) -> MistralProvider:
    kwargs = {"api_key": "test-key", "model": "mistral-small-latest", "rpm": 0}
    kwargs.update(overrides)
    return MistralProvider(**kwargs)


def test_missing_api_key_raises_immediately():
    with pytest.raises(LLMUnavailableError):
        MistralProvider(api_key="", model="mistral-small-latest")


def test_successful_call_returns_content_and_usage():
    provider = _make_provider()

    fake_usage = MagicMock(prompt_tokens=80, completion_tokens=40, total_tokens=120)
    fake_message = MagicMock(content='{"verdict": "Hold"}')
    fake_choice = MagicMock(message=fake_message)
    fake_response = MagicMock(choices=[fake_choice], usage=fake_usage)

    with patch.object(provider, "_client") as mock_client:
        mock_client.chat.complete.return_value = fake_response
        result = provider.generate_structured(
            system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
        )

    assert result.content == '{"verdict": "Hold"}'
    assert result.usage.provider == "mistral"
    assert result.usage.model == "mistral-small-latest"
    assert result.usage.input_tokens == 80
    assert result.usage.output_tokens == 40
    assert result.usage.total_tokens == 120

    # Structured output must actually be requested (Rule: evidence-first
    # output needs a real schema guarantee, not prompt-engineered JSON).
    _, call_kwargs = mock_client.chat.complete.call_args
    assert call_kwargs["response_format"].type == "json_schema"
    assert call_kwargs["response_format"].json_schema.strict is True
    assert call_kwargs["response_format"].json_schema.name == "_EchoSchema"


def test_empty_choices_raises_unavailable():
    provider = _make_provider()
    fake_response = MagicMock(choices=[], usage=None)

    with patch.object(provider, "_client") as mock_client:
        mock_client.chat.complete.return_value = fake_response
        with pytest.raises(LLMUnavailableError):
            provider.generate_structured(
                system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
            )


def test_retryable_error_exhausted_raises_llm_unavailable():
    provider = _make_provider()

    def always_429(*args, **kwargs):
        raise SDKError("rate limited", status_code=429, body="{}")

    with patch.object(provider, "_client") as mock_client, \
         patch("app.providers.mistral_retry.time.sleep"), \
         patch("app.providers.mistral_retry.random.random", return_value=0.0):
        mock_client.chat.complete.side_effect = always_429
        with pytest.raises(LLMUnavailableError):
            provider.generate_structured(
                system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
            )


def test_non_retryable_error_fails_without_retrying():
    provider = _make_provider()
    call_count = {"n": 0}

    def bad_auth(*args, **kwargs):
        call_count["n"] += 1
        raise SDKError("unauthorized", status_code=401, body="{}")

    with patch.object(provider, "_client") as mock_client:
        mock_client.chat.complete.side_effect = bad_auth
        with pytest.raises(LLMUnavailableError):
            provider.generate_structured(
                system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
            )
    assert call_count["n"] == 1
