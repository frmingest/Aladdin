"""Tavily Search API ResearchProvider — free-tier fallback for
GeminiResearchProvider (app/providers/gemini_research_provider.py).

Google AI Studio's free tier caps grounded-search calls at
`llm_rate_limit_rpd` (~20/day, see app/providers/budget.py) — a full
portfolio's first analysis run (one macro call + one call per distinct
sector + one call per holding) routinely exceeds that in a single sitting
(see claude/free-research-fallback-2026-09-28.md). Tavily is a
search-for-LLM-agents API with its own free tier (1,000 searches/month,
no card required — https://tavily.com), used here as the second link in a
Gemini -> Tavily fallback chain (app/providers/factory.py's
get_research_provider(), same primary-then-fallback shape as the
LLM provider chain in app/services/analysis/pipeline.py).

Unlike GeminiResearchProvider, this does not ask an LLM to write a
grounded narrative and then parse citations back out of it — Tavily's
`/search` endpoint *is* the search, and returns ranked results (url,
title, a relevance-ranked content snippet) directly. Each result becomes
one ResearchItem, with Tavily's own snippet as the summary — never
elaborated on or rewritten here, so nothing not actually in the retrieved
snippet is presented as a finding (CLAUDE.md Rule 2: evidence must be
real, not invented downstream of the fetch).

Verified against Tavily's documented request/response shape as of
2026-09 (POST https://api.tavily.com/search, Bearer auth, JSON body
{query, max_results, search_depth, ...} -> {results: [{url, title,
content, score, published_date}], ...}); this build environment has no
network path to the live API, so a first live call is the real check
(matches this codebase's existing practice for every other live-API
provider — see e.g. app/providers/world_bank.py's module docstring).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.providers.base import ResearchItem, ResearchProvider, ResearchUnavailableError

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

MACRO_SOURCE_TYPE = "macro_news"
SECTOR_SOURCE_TYPE = "sector_research"
COMPANY_SOURCE_TYPE = "company_research"

_MACRO_QUERY = (
    "current global macroeconomic and geopolitical news: central bank interest "
    "rate decisions, inflation, major currency moves, geopolitical conflicts "
    "affecting markets, regulatory shifts for public equity investors"
)


class TavilyResearchProvider(ResearchProvider):
    name = "tavily_search"

    def __init__(
        self,
        *,
        api_key: str,
        max_results: int = 6,
        search_depth: str = "advanced",
        timeout_seconds: float = 20.0,
    ) -> None:
        if not api_key:
            raise ResearchUnavailableError("TAVILY_API_KEY is not set — cannot call Tavily for research.")
        self._api_key = api_key
        self._max_results = max_results
        self._search_depth = search_depth
        self._timeout = timeout_seconds

    def get_macro_research(self) -> list[ResearchItem]:
        return self._search(_MACRO_QUERY, source_type=MACRO_SOURCE_TYPE)

    def get_sector_research(self, sector: str) -> list[ResearchItem]:
        query = (
            f"current news and trends for the {sector} sector: demand/supply shifts, "
            "regulatory changes, competitive landscape, relevant for equity investors"
        )
        return self._search(query, source_type=SECTOR_SOURCE_TYPE)

    def get_company_research(
        self, *, company_name: str, ticker: str, sector: str | None
    ) -> list[ResearchItem]:
        sector_clause = f" ({sector} sector)" if sector else ""
        query = (
            f"{company_name} ({ticker}){sector_clause} recent news: competitive position, "
            "geographic/geopolitical exposure, regulatory or legal developments, "
            "management changes, material company-specific news"
        )
        return self._search(query, source_type=COMPANY_SOURCE_TYPE)

    # --- internal ---

    def _search(self, query: str, *, source_type: str) -> list[ResearchItem]:
        try:
            response = httpx.post(
                TAVILY_SEARCH_URL,
                json={
                    "query": query,
                    "search_depth": self._search_depth,
                    "max_results": self._max_results,
                    "include_answer": False,
                },
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                timeout=self._timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise ResearchUnavailableError(
                f"Tavily search failed: HTTP {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ResearchUnavailableError(
                f"Tavily search request failed ({exc.__class__.__name__})"
            ) from exc
        except ValueError as exc:
            raise ResearchUnavailableError("Tavily search response was not JSON") from exc

        return _items_from_results(payload, source_type=source_type)


def _items_from_results(payload: Any, *, source_type: str) -> list[ResearchItem]:
    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        raise ResearchUnavailableError("Tavily response carried no 'results' list")

    retrieved_at = datetime.now(timezone.utc)
    items: list[ResearchItem] = []
    for result in results:
        if not isinstance(result, dict):
            continue
        url = result.get("url")
        content = result.get("content")
        if not url or not content:
            continue  # a result with no source or no snippet has nothing citable

        published_at = _parse_published_date(result.get("published_date"))
        items.append(
            ResearchItem(
                source_url=url,
                source_name=_domain_from_url(url),
                title=result.get("title") or _domain_from_url(url),
                summary=content,
                source_type=source_type,
                published_at=published_at,
                retrieved_at=retrieved_at,
            )
        )
    return items


def _domain_from_url(url: str) -> str:
    from urllib.parse import urlparse

    try:
        netloc = urlparse(url).netloc
        return netloc or url
    except ValueError:
        return url


def _parse_published_date(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
        return parsed
    except ValueError:
        pass
    try:
        # No offset in the source string ("%Y-%m-%d") — explicitly tag it
        # UTC via .replace rather than %z (which would require one).
        parsed = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None
