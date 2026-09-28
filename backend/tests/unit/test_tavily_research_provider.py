"""Unit tests for TavilyResearchProvider, mocking httpx (no real network
call — these must never spend real Tavily quota)."""
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.providers.base import ResearchUnavailableError
from app.providers.tavily_research_provider import (
    COMPANY_SOURCE_TYPE,
    MACRO_SOURCE_TYPE,
    SECTOR_SOURCE_TYPE,
    TavilyResearchProvider,
)


def _make_provider(**overrides) -> TavilyResearchProvider:
    kwargs = {"api_key": "test-key"}
    kwargs.update(overrides)
    return TavilyResearchProvider(**kwargs)


def _fake_response(payload: dict, status_code: int = 200) -> MagicMock:
    response = MagicMock(status_code=status_code)
    response.json.return_value = payload
    if status_code >= 400:
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=response
        )
    else:
        response.raise_for_status.return_value = None
    return response


def test_missing_api_key_raises_immediately():
    with pytest.raises(ResearchUnavailableError):
        TavilyResearchProvider(api_key="")


def test_macro_research_builds_items_from_results():
    provider = _make_provider()
    payload = {
        "results": [
            {
                "url": "https://reuters.com/markets/fed-rate",
                "title": "Fed holds rates steady",
                "content": "The Federal Reserve kept rates unchanged today.",
                "published_date": "2026-09-27",
            },
            {
                "url": "https://ft.com/inflation",
                "title": "Inflation cools",
                "content": "Headline inflation eased to 2.4%.",
            },
        ]
    }
    with patch("app.providers.tavily_research_provider.httpx.post") as mock_post:
        mock_post.return_value = _fake_response(payload)
        items = provider.get_macro_research()

    assert len(items) == 2
    assert items[0].source_url == "https://reuters.com/markets/fed-rate"
    assert items[0].source_type == MACRO_SOURCE_TYPE
    assert items[0].summary == "The Federal Reserve kept rates unchanged today."
    assert items[0].published_at is not None
    assert items[1].published_at is None  # no published_date on the second result
    # Bearer auth actually sent
    _, kwargs = mock_post.call_args
    assert kwargs["headers"]["Authorization"] == "Bearer test-key"


def test_sector_and_company_queries_are_scoped():
    provider = _make_provider()
    with patch("app.providers.tavily_research_provider.httpx.post") as mock_post:
        mock_post.return_value = _fake_response({"results": []})
        provider.get_sector_research("Energy")
        provider.get_company_research(company_name="Var Energi", ticker="VAR.OL", sector="Energy")

    sector_query = mock_post.call_args_list[0].kwargs["json"]["query"]
    company_query = mock_post.call_args_list[1].kwargs["json"]["query"]
    assert "Energy" in sector_query
    assert "Var Energi" in company_query and "VAR.OL" in company_query


def test_results_missing_url_or_content_are_skipped():
    provider = _make_provider()
    payload = {"results": [{"url": "", "content": "no url"}, {"url": "https://x.com", "content": ""}]}
    with patch("app.providers.tavily_research_provider.httpx.post") as mock_post:
        mock_post.return_value = _fake_response(payload)
        items = provider.get_company_research(company_name="X", ticker="X", sector=None)

    assert items == []


def test_http_error_raises_research_unavailable():
    provider = _make_provider()
    with patch("app.providers.tavily_research_provider.httpx.post") as mock_post:
        mock_post.return_value = _fake_response({}, status_code=500)
        with pytest.raises(ResearchUnavailableError, match="HTTP 500"):
            provider.get_macro_research()


def test_malformed_response_raises_research_unavailable():
    provider = _make_provider()
    with patch("app.providers.tavily_research_provider.httpx.post") as mock_post:
        mock_post.return_value = _fake_response({"no_results_key": True})
        with pytest.raises(ResearchUnavailableError, match="no 'results'"):
            provider.get_macro_research()


def test_source_type_is_scope_specific():
    provider = _make_provider()
    payload = {"results": [{"url": "https://x.com", "content": "c"}]}
    with patch("app.providers.tavily_research_provider.httpx.post") as mock_post:
        mock_post.return_value = _fake_response(payload)
        assert provider.get_sector_research("Energy")[0].source_type == SECTOR_SOURCE_TYPE
        assert (
            provider.get_company_research(company_name="X", ticker="X", sector=None)[0].source_type
            == COMPANY_SOURCE_TYPE
        )
