"""Primary-then-fallback ResearchProvider chain.

Mirrors app/services/analysis/pipeline.py's `_call_with_fallback` pattern
for LLMProvider, but lives as its own ResearchProvider implementation
instead of a per-call wrapper: app/services/research/{macro,sector,
company}.py already call `provider.get_*_research()` once per scope and
know nothing about fallback — wrapping the provider itself means that
call site needs no change.

On the primary's ResearchUnavailableError (includes the Gemini daily
budget guard tripping — see app/providers/gemini_research_provider.py and
app/providers/budget.py), the same request is retried against the
fallback. If the fallback also fails, its error is raised (not the
primary's) since it's the more recent, more relevant failure; the caller
(app/services/research/common.py's get_or_refresh) already serves stale
cached data on any ResearchUnavailableError, so this never turns a
temporary outage into a blank page — it only changes how long the app
holds out before falling back to that stale-data path.
"""
from __future__ import annotations

from app.providers.base import ResearchItem, ResearchProvider, ResearchUnavailableError


class CompositeResearchProvider(ResearchProvider):
    def __init__(self, *, primary: ResearchProvider, fallback: ResearchProvider | None) -> None:
        self._primary = primary
        self._fallback = fallback
        self.name = primary.name if fallback is None else f"{primary.name}+{fallback.name}"

    def get_macro_research(self) -> list[ResearchItem]:
        return self._with_fallback(lambda p: p.get_macro_research())

    def get_sector_research(self, sector: str) -> list[ResearchItem]:
        return self._with_fallback(lambda p: p.get_sector_research(sector))

    def get_company_research(
        self, *, company_name: str, ticker: str, sector: str | None
    ) -> list[ResearchItem]:
        return self._with_fallback(
            lambda p: p.get_company_research(company_name=company_name, ticker=ticker, sector=sector)
        )

    def _with_fallback(self, call):
        try:
            return call(self._primary)
        except ResearchUnavailableError:
            if self._fallback is None:
                raise
            return call(self._fallback)
