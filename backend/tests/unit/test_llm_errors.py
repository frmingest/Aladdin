"""Plain-language LLM failure messages (hardening sprint, 2026-10-13)."""

import pytest

from app.providers.base import LLMUnavailableError
from app.services.llm_errors import DETAIL_CHARS, explain_llm_failure

GEMINI_QUOTA = (
    "Gemini API call failed (model=gemini-3.6-flash): 429 RESOURCE_EXHAUSTED. "
    "{'error': {'code': 429, 'message': 'You exceeded your current quota', 'status': 'RESOURCE_EXHAUSTED'}}"
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Gemini daily request budget exhausted (model=g): 1500 of 1500 used", "daily request budget"),
        (GEMINI_QUOTA, "quota or rate limit"),
        ("Mistral API call failed (model=m): Status 429. Too many requests", "quota or rate limit"),
        ("GOOGLE_AI_STUDIO_API_KEY is not set — cannot call Gemini.", "No API key is set"),
        ("MISTRAL_API_KEY is not set — cannot call Mistral.", "No API key is set"),
        ("Gemini API call failed (model=g): 403 PERMISSION_DENIED. API key not valid", "refused the API key"),
        ("Ollama request failed (model=qwen): All connection attempts failed", "Ollama is not running"),
        ("Ollama doesn't have model 'qwen3' -- run: ollama pull qwen3", "does not have the model installed"),
        ("Gemini API call failed (model=gemini-2.5-flash): 404 NOT_FOUND. model is no longer available", "does not know this model"),
        ("Ollama request timed out after 600 s (model=qwen)", "took too long"),
        ("Ollama stalled with no tokens for 120 s", "took too long"),
        ("Ollama hit num_ctx 8192: the evidence is too long", "context window"),
        ("Gemini API call failed (model=g): 503 UNAVAILABLE. The model is overloaded", "overloaded"),
        ("Gemini returned an empty response (model=g)", "answered with nothing"),
        ("blind pass response failed schema validation: 3 validation errors", "did not match the required format"),
    ],
)
def test_known_causes_get_a_plain_sentence(raw: str, expected: str):
    message = explain_llm_failure(raw)
    assert expected in message
    assert "(Technical detail:" in message


def test_budget_wins_over_the_generic_quota_rule():
    assert "daily request budget" in explain_llm_failure("Gemini daily request budget exhausted: quota 429")


def test_missing_key_wins_over_refused_key():
    assert "No API key is set" in explain_llm_failure("API_KEY is not set — cannot call Gemini.")


def test_unknown_text_gets_the_generic_sentence_and_keeps_its_detail():
    message = explain_llm_failure("something nobody has seen before")
    assert message.startswith("The AI provider could not produce an answer.")
    assert "something nobody has seen before" in message


def test_empty_or_none_is_generic_without_detail():
    for empty in (None, "", "   \n "):
        assert explain_llm_failure(empty) == "The AI provider could not produce an answer."


def test_long_dumps_are_cut_and_whitespace_is_squashed():
    raw = "Gemini API call failed: 429 RESOURCE_EXHAUSTED\n\n    " + "x" * 5000
    message = explain_llm_failure(raw)
    detail = message.split("(Technical detail: ", 1)[1]
    assert len(detail) <= DETAIL_CHARS + 2
    assert "\n" not in message
    assert detail.endswith("…)")


def test_accepts_an_exception_and_is_deterministic():
    exc = LLMUnavailableError(GEMINI_QUOTA)
    assert explain_llm_failure(exc) == explain_llm_failure(GEMINI_QUOTA)


def test_the_503_body_is_the_plain_sentence_not_the_vendor_text():
    import asyncio
    import json

    from app.main import llm_unavailable

    response = asyncio.run(llm_unavailable(None, LLMUnavailableError(GEMINI_QUOTA)))  # type: ignore[arg-type]
    assert response.status_code == 503
    detail = json.loads(response.body)["detail"]
    assert detail.startswith("The AI provider's quota or rate limit was hit.")


def test_other_providers_keep_their_own_503_text():
    import asyncio
    import json

    from app.main import provider_unavailable
    from app.providers.base import ResearchUnavailableError

    response = asyncio.run(provider_unavailable(None, ResearchUnavailableError("TAVILY_API_KEY is not set")))  # type: ignore[arg-type]
    assert json.loads(response.body)["detail"] == "TAVILY_API_KEY is not set"
