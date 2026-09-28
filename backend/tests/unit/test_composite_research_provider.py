"""Unit tests for CompositeResearchProvider's primary-then-fallback chain."""
from unittest.mock import MagicMock

import pytest

from app.providers.base import ResearchItem, ResearchUnavailableError
from app.providers.composite_research_provider import CompositeResearchProvider


def _item(source_type: str) -> ResearchItem:
    return ResearchItem(
        source_url="https://x.com",
        source_name="x.com",
        title="t",
        summary="s",
        source_type=source_type,
        retrieved_at=None,  # not exercised by these tests
    )


def test_no_fallback_configured_reraises_primary_error():
    primary = MagicMock()
    primary.get_macro_research.side_effect = ResearchUnavailableError("budget exhausted")
    provider = CompositeResearchProvider(primary=primary, fallback=None)

    with pytest.raises(ResearchUnavailableError, match="budget exhausted"):
        provider.get_macro_research()


def test_falls_back_when_primary_raises():
    primary = MagicMock(name="gemini")
    primary.get_macro_research.side_effect = ResearchUnavailableError("budget exhausted")
    fallback = MagicMock(name="tavily")
    fallback.get_macro_research.return_value = [_item("macro_news")]

    provider = CompositeResearchProvider(primary=primary, fallback=fallback)
    items = provider.get_macro_research()

    assert items == [_item("macro_news")]
    fallback.get_macro_research.assert_called_once()


def test_primary_success_never_touches_fallback():
    primary = MagicMock()
    primary.get_sector_research.return_value = [_item("sector_research")]
    fallback = MagicMock()

    provider = CompositeResearchProvider(primary=primary, fallback=fallback)
    items = provider.get_sector_research("Energy")

    assert items == [_item("sector_research")]
    fallback.get_sector_research.assert_not_called()


def test_fallback_failure_propagates_fallbacks_own_error():
    primary = MagicMock()
    primary.get_company_research.side_effect = ResearchUnavailableError("gemini down")
    fallback = MagicMock()
    fallback.get_company_research.side_effect = ResearchUnavailableError("tavily down")

    provider = CompositeResearchProvider(primary=primary, fallback=fallback)
    with pytest.raises(ResearchUnavailableError, match="tavily down"):
        provider.get_company_research(company_name="X", ticker="X", sector=None)


def test_name_reflects_configured_chain():
    primary = MagicMock(name="gemini")
    primary.name = "gemini_search"
    fallback = MagicMock(name="tavily")
    fallback.name = "tavily_search"

    assert CompositeResearchProvider(primary=primary, fallback=None).name == "gemini_search"
    assert (
        CompositeResearchProvider(primary=primary, fallback=fallback).name
        == "gemini_search+tavily_search"
    )
