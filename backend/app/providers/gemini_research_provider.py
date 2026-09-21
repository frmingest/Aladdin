"""Gemini + Google Search grounding ResearchProvider (Sprint 2 — live,
evidence-first macro/sector/company research).

Reuses the Google AI Studio key/infra GoogleAIStudioProvider already uses
for analysis (app/providers/google_ai_studio_provider.py) rather than a
second vendor account, and shares the same retry/pacing clock via
app.providers.gemini_retry (both providers hit the same Google AI Studio
account/RPM budget).

Deliberately does NOT combine `tools=[google_search]` with a
`response_schema`-constrained call the way GoogleAIStudioProvider does:
Google's Gemini API does not support grounding and structured JSON output
in the same call. Instead this asks for plain grounded text and derives
ResearchItems from `response.candidates[0].grounding_metadata` — verified
directly against the installed `google-genai` SDK's own types
(GroundingMetadata.grounding_chunks/grounding_supports, GroundingSupport.
segment/grounding_chunk_indices, Segment.text, GroundingChunkWeb.uri/
title).

One ResearchItem is built per (grounding_support, grounding_chunk) pair:
each grounding_support names a segment of the model's own text together
with the indices of the grounding_chunks (real search results) that
segment is grounded in. Segments backed by the same chunk are merged into
one item, so every item's summary is text the model actually grounded in
that specific source — CLAUDE.md Rule 2: research must be auditable per
item, not just per run, and per Rule 5 the model is never handed this
provider's own prior output framed as instructions.

A response with no grounding_metadata at all (the search tool never
triggered, or the call was malformed) is a real failure
(ResearchUnavailableError). A response *with* grounding metadata but zero
supports is a legitimate empty result — the model found nothing to ground
its answer in — and returns an empty list; app/services/research relies on
this distinction to still record a COMPLETED run with zero items rather
than a spurious failure.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.config.paths import PROMPTS_DIR
from app.providers.base import ResearchItem, ResearchProvider, ResearchUnavailableError
from app.providers.gemini_retry import call_with_retry

MACRO_SOURCE_TYPE = "macro_news"
SECTOR_SOURCE_TYPE = "sector_research"
COMPANY_SOURCE_TYPE = "company_research"


class GeminiResearchProvider(ResearchProvider):
    name = "gemini_search"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        prompt_version: str,
        temperature: float = 0.2,
        max_output_tokens: int = 8192,
        rpm: int = 0,
    ) -> None:
        if not api_key:
            raise ResearchUnavailableError(
                "GOOGLE_AI_STUDIO_API_KEY is not set — cannot call Gemini for research."
            )
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._prompt_version = prompt_version
        self._temperature = temperature
        self._max_output_tokens = max_output_tokens
        self._rpm = rpm

    def get_macro_research(self) -> list[ResearchItem]:
        prompt = _load_prompt("macro", self._prompt_version)
        return self._grounded_items(prompt, source_type=MACRO_SOURCE_TYPE)

    def get_sector_research(self, sector: str) -> list[ResearchItem]:
        prompt = _load_prompt("sector", self._prompt_version).format(sector=sector)
        return self._grounded_items(prompt, source_type=SECTOR_SOURCE_TYPE)

    def get_company_research(
        self, *, company_name: str, ticker: str, sector: str | None
    ) -> list[ResearchItem]:
        prompt = _load_prompt("company", self._prompt_version).format(
            company_name=company_name,
            ticker=ticker,
            sector=sector or "unspecified",
        )
        return self._grounded_items(prompt, source_type=COMPANY_SOURCE_TYPE)

    # --- internal ---

    def _grounded_items(self, prompt: str, *, source_type: str) -> list[ResearchItem]:
        config = genai_types.GenerateContentConfig(
            tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
            max_output_tokens=self._max_output_tokens,
            temperature=self._temperature,
        )

        def _call() -> genai_types.GenerateContentResponse:
            return self._client.models.generate_content(
                model=self._model,
                contents=prompt,
                config=config,
            )

        try:
            response = call_with_retry(_call, rpm=self._rpm)
        except genai_errors.APIError as exc:
            raise ResearchUnavailableError(
                f"Gemini grounded search call failed (model={self._model}): {exc}"
            ) from exc

        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            raise ResearchUnavailableError("Gemini returned no candidates for a grounded research call")

        grounding_metadata = getattr(candidates[0], "grounding_metadata", None)
        if grounding_metadata is None:
            raise ResearchUnavailableError(
                "Gemini response carried no grounding_metadata — the search tool may not have "
                "triggered, or this model/config doesn't support it"
            )

        return _items_from_grounding(grounding_metadata, source_type=source_type)


def _items_from_grounding(grounding_metadata: Any, *, source_type: str) -> list[ResearchItem]:
    chunks = getattr(grounding_metadata, "grounding_chunks", None) or []
    supports = getattr(grounding_metadata, "grounding_supports", None) or []
    retrieved_at = datetime.now(timezone.utc)

    # Merge every segment attributed to the same source (grounding_chunk)
    # into one item, rather than one near-duplicate row per segment.
    text_by_chunk_index: dict[int, list[str]] = {}
    for support in supports:
        segment = getattr(support, "segment", None)
        segment_text = getattr(segment, "text", None) if segment is not None else None
        if not segment_text:
            continue
        for chunk_index in getattr(support, "grounding_chunk_indices", None) or []:
            text_by_chunk_index.setdefault(chunk_index, []).append(segment_text)

    items: list[ResearchItem] = []
    for chunk_index, texts in text_by_chunk_index.items():
        if chunk_index >= len(chunks):
            continue  # defensive — an out-of-range index would be a vendor-side inconsistency
        web = getattr(chunks[chunk_index], "web", None)
        if web is None or not getattr(web, "uri", None):
            continue  # only web (google_search) chunks carry a real source_url
        items.append(
            ResearchItem(
                source_url=web.uri,
                source_name=getattr(web, "domain", None) or getattr(web, "title", None) or web.uri,
                title=getattr(web, "title", None) or getattr(web, "domain", None) or web.uri,
                summary=" ".join(texts),
                source_type=source_type,
                published_at=None,  # Gemini's grounding metadata carries no publish date
                retrieved_at=retrieved_at,
            )
        )
    return items


def _load_prompt(kind: str, version: str) -> str:
    path = PROMPTS_DIR / "research" / f"{kind}_{version}.md"
    if not path.exists():
        raise ResearchUnavailableError(
            f"no '{kind}' research prompt found for version '{version}' under prompts/research/"
        )
    return path.read_text(encoding="utf-8")
