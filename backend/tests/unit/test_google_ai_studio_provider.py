"""Unit tests for GoogleAIStudioProvider, mocking the google-genai client
(no real network call — these must never spend real Gemini quota)."""
from unittest.mock import MagicMock, patch

import pytest
from google.genai import errors as genai_errors
from pydantic import BaseModel

from app.providers.base import LLMUnavailableError
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider


class _EchoSchema(BaseModel):
    verdict: str


def _make_provider(**overrides) -> GoogleAIStudioProvider:
    kwargs = {"api_key": "test-key", "model": "gemini-3.6-flash", "rpm": 0}
    kwargs.update(overrides)
    return GoogleAIStudioProvider(**kwargs)


def test_missing_api_key_raises_immediately():
    with pytest.raises(LLMUnavailableError):
        GoogleAIStudioProvider(api_key="", model="gemini-3.6-flash")


def test_successful_call_returns_content_and_usage():
    provider = _make_provider()

    fake_usage = MagicMock(
        prompt_token_count=100, candidates_token_count=50, total_token_count=150
    )
    fake_response = MagicMock(text='{"verdict": "Buy"}', usage_metadata=fake_usage)

    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        result = provider.generate_structured(
            system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
        )

    assert result.content == '{"verdict": "Buy"}'
    assert result.usage.provider == "google_ai_studio"
    assert result.usage.model == "gemini-3.6-flash"
    assert result.usage.input_tokens == 100
    assert result.usage.output_tokens == 50
    assert result.usage.total_tokens == 150


def test_empty_response_text_raises_unavailable():
    provider = _make_provider()
    fake_response = MagicMock(text="", usage_metadata=None)

    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        with pytest.raises(LLMUnavailableError):
            provider.generate_structured(
                system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
            )


def test_retryable_error_exhausted_raises_llm_unavailable():
    provider = _make_provider()

    def always_503(*args, **kwargs):
        raise genai_errors.ServerError(code=503, response_json={"error": {"message": "busy"}})

    with patch.object(provider, "_client") as mock_client, \
         patch("app.providers.gemini_retry.time.sleep"), \
         patch("app.providers.gemini_retry.random.random", return_value=0.0):
        mock_client.models.generate_content.side_effect = always_503
        with pytest.raises(LLMUnavailableError):
            provider.generate_structured(
                system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
            )


def test_non_retryable_error_fails_without_retrying():
    provider = _make_provider()
    call_count = {"n": 0}

    def not_found(*args, **kwargs):
        call_count["n"] += 1
        raise genai_errors.ClientError(code=404, response_json={"error": {"message": "gone"}})

    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.side_effect = not_found
        with pytest.raises(LLMUnavailableError):
            provider.generate_structured(
                system_prompt="sys", user_prompt="user", response_schema=_EchoSchema
            )
    assert call_count["n"] == 1


def test_rpm_is_passed_through_to_pacing():
    provider = _make_provider(rpm=5)
    assert provider._rpm == 5
