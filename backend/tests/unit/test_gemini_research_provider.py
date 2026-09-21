"""Unit tests for GeminiResearchProvider, mocking the google-genai client
(no real network call — these must never spend real Gemini quota) and its
grounding_metadata response shape."""
from unittest.mock import MagicMock, patch

import pytest
from google.genai import errors as genai_errors

from app.providers.base import ResearchUnavailableError
from app.providers.gemini_research_provider import GeminiResearchProvider


def _make_provider(**overrides) -> GeminiResearchProvider:
    kwargs = {"api_key": "test-key", "model": "gemini-3.6-flash", "prompt_version": "v1", "rpm": 0}
    kwargs.update(overrides)
    return GeminiResearchProvider(**kwargs)


def _fake_chunk(uri: str, domain: str | None = None, title: str | None = None) -> MagicMock:
    web = MagicMock(uri=uri, domain=domain, title=title)
    return MagicMock(web=web)


def _fake_support(text: str, chunk_indices: list[int]) -> MagicMock:
    segment = MagicMock(text=text)
    return MagicMock(segment=segment, grounding_chunk_indices=chunk_indices)


def test_missing_api_key_raises_immediately():
    with pytest.raises(ResearchUnavailableError):
        GeminiResearchProvider(api_key="", model="gemini-3.6-flash", prompt_version="v1")


def test_unknown_prompt_version_raises_before_any_call():
    provider = _make_provider(prompt_version="v999-does-not-exist")
    with patch.object(provider, "_client") as mock_client:
        with pytest.raises(ResearchUnavailableError, match="no 'macro' research prompt"):
            provider.get_macro_research()
        mock_client.models.generate_content.assert_not_called()


def test_grounded_items_built_from_grounding_metadata():
    provider = _make_provider()

    chunks = [
        _fake_chunk("https://example.com/a", domain="example.com", title="Example A"),
        _fake_chunk("https://reuters.com/b", domain="reuters.com", title="Reuters B"),
    ]
    supports = [
        _fake_support("Rates are rising.", [0]),
        _fake_support("Energy prices spiked.", [1]),
        # A second segment grounded in the SAME chunk 0 -- must merge into one item.
        _fake_support("Inflation cooled slightly.", [0]),
    ]
    grounding_metadata = MagicMock(grounding_chunks=chunks, grounding_supports=supports)
    candidate = MagicMock(grounding_metadata=grounding_metadata)
    fake_response = MagicMock(candidates=[candidate])

    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        items = provider.get_macro_research()

    assert len(items) == 2  # merged by chunk index, not by support
    by_source = {item.source_url: item for item in items}
    assert by_source["https://example.com/a"].summary == "Rates are rising. Inflation cooled slightly."
    assert by_source["https://example.com/a"].source_name == "example.com"
    assert by_source["https://reuters.com/b"].summary == "Energy prices spiked."
    assert all(item.source_type == "macro_news" for item in items)


def test_no_candidates_raises_unavailable():
    provider = _make_provider()
    fake_response = MagicMock(candidates=[])
    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        with pytest.raises(ResearchUnavailableError, match="no candidates"):
            provider.get_macro_research()


def test_no_grounding_metadata_at_all_raises_unavailable():
    provider = _make_provider()
    candidate = MagicMock(grounding_metadata=None)
    fake_response = MagicMock(candidates=[candidate])
    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        with pytest.raises(ResearchUnavailableError, match="no grounding_metadata"):
            provider.get_macro_research()


def test_grounding_metadata_present_but_zero_supports_returns_empty_list():
    """A legitimate empty result -- the model found nothing to ground its
    answer in -- must NOT raise, so a caller can still record a COMPLETED
    run with zero items rather than a spurious FAILED one."""
    provider = _make_provider()
    grounding_metadata = MagicMock(grounding_chunks=[], grounding_supports=[])
    candidate = MagicMock(grounding_metadata=grounding_metadata)
    fake_response = MagicMock(candidates=[candidate])
    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        items = provider.get_macro_research()
    assert items == []


def test_chunk_with_no_web_uri_is_skipped():
    provider = _make_provider()
    chunks = [MagicMock(web=None)]
    supports = [_fake_support("some text", [0])]
    grounding_metadata = MagicMock(grounding_chunks=chunks, grounding_supports=supports)
    candidate = MagicMock(grounding_metadata=grounding_metadata)
    fake_response = MagicMock(candidates=[candidate])
    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        items = provider.get_macro_research()
    assert items == []


def test_sector_and_company_prompts_are_formatted_with_arguments():
    provider = _make_provider()
    grounding_metadata = MagicMock(grounding_chunks=[], grounding_supports=[])
    candidate = MagicMock(grounding_metadata=grounding_metadata)
    fake_response = MagicMock(candidates=[candidate])

    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.return_value = fake_response
        provider.get_sector_research("Energy")
        sector_contents = mock_client.models.generate_content.call_args.kwargs["contents"]
        assert "Energy" in sector_contents

        provider.get_company_research(company_name="Equinor ASA", ticker="EQNR.OL", sector="Energy")
        company_contents = mock_client.models.generate_content.call_args.kwargs["contents"]
        assert "Equinor ASA" in company_contents
        assert "EQNR.OL" in company_contents
        assert "Energy" in company_contents


def test_retryable_error_exhausted_raises_research_unavailable():
    provider = _make_provider()

    def always_503(*args, **kwargs):
        raise genai_errors.ServerError(code=503, response_json={"error": {"message": "busy"}})

    with patch.object(provider, "_client") as mock_client, \
         patch("app.providers.gemini_retry.time.sleep"), \
         patch("app.providers.gemini_retry.random.random", return_value=0.0):
        mock_client.models.generate_content.side_effect = always_503
        with pytest.raises(ResearchUnavailableError):
            provider.get_macro_research()


def test_non_retryable_error_fails_without_retrying():
    provider = _make_provider()
    call_count = {"n": 0}

    def not_found(*args, **kwargs):
        call_count["n"] += 1
        raise genai_errors.ClientError(code=404, response_json={"error": {"message": "gone"}})

    with patch.object(provider, "_client") as mock_client:
        mock_client.models.generate_content.side_effect = not_found
        with pytest.raises(ResearchUnavailableError):
            provider.get_macro_research()
    assert call_count["n"] == 1
