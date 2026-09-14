"""
Gemini + Google Search grounding ResearchProvider (architecture §9.2/§9.3,
§26 Phase 4) — resolves the §29 "research provider" open question for
qualitative macro/world-news and sector research (Faiz's explicit choice:
reuse the Google AI Studio key/infra from Phase 3 rather than a second
vendor account — see docs/decisions/0007).

Deliberately does NOT combine `tools=[google_search]` with
`response_schema`-constrained generation the way
app.providers.google_ai_studio_provider does for analysis: this session has
no live network path to the Gemini API to verify whether grounding and
structured output can be requested together on the configured model, and
public Gemini API documentation has at various points described them as
mutually exclusive. Rather than build on an unverified assumption, this
provider asks for plain grounded text and derives ResearchItems from
`response.candidates[0].grounding_metadata` instead — a shape this session
*did* verify directly against the installed `google-genai==2.23.0` SDK's
pydantic models (GroundingMetadata/GroundingChunk/GroundingSupport/Segment),
the same "introspect the real SDK, don't trust a docs fetch" discipline
decision 0005 used for the Phase 3 provider.

One ResearchItem is built per (grounding_support, grounding_chunk) pair: each
`grounding_support` names a `segment` of the model's text (with the segment's
own `text`, not just character offsets — no re-slicing needed) and the
indices of the `grounding_chunks` (real search results) that segment is
backed by. This means every item's `summary` is text the model actually
grounded in that specific source, not the whole response reused verbatim
per source (§9.4: research must be auditable per item, not just per run).

A response with no grounding_metadata at all (the search tool never
triggered, or the vendor call itself is malformed) is treated as
ResearchUnavailableError — a real failure. A response *with* grounding
metadata but zero supports is a legitimate empty result (the model found
nothing to ground its answer in) and returns an empty list, not an error —
see app.services.research, which relies on this distinction to decide
whether a "no new items" run should still update the cache's retrieved_at.

`self.last_usage` (§28 observability follow-up, docs/decisions/0013) is set
from the vendor's own `usage_metadata` right after a call returns — even
when the call later turns out to have no usable grounding, since the token
cost was still incurred — so app.services.research can persist a usage-
ledger row without this interface's return type needing to carry it.
"""

import time
from datetime import datetime, timezone
from typing import Any

from google import genai
from google.genai import types

from app.config.paths import PROMPTS_DIR
from app.providers.base import LLMUsageMetrics, ResearchItem, ResearchProvider, ResearchUnavailableError

_MACRO_SOURCE_TYPE = "macro_news"
_SECTOR_SOURCE_TYPE = "sector_research"


class GeminiResearchProvider(ResearchProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        prompt_version: str,
        max_output_tokens: int,
        temperature: float,
    ):
        if not api_key:
            raise ResearchUnavailableError(
                "GOOGLE_AI_STUDIO_API_KEY is not configured — set it in backend/.env"
            )
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._prompt_version = prompt_version
        self._max_output_tokens = max_output_tokens
        self._temperature = temperature

    def get_macro_snapshot(self) -> list[ResearchItem]:
        prompt = _load_research_prompt("macro", self._prompt_version)
        return self._grounded_items(prompt, source_type=_MACRO_SOURCE_TYPE)

    def get_sector_research(self, sector: str) -> list[ResearchItem]:
        prompt = _load_research_prompt("sector", self._prompt_version).format(sector=sector)
        return self._grounded_items(prompt, source_type=_SECTOR_SOURCE_TYPE)

    # --- internal helpers ---

    def _grounded_items(self, prompt: str, *, source_type: str) -> list[ResearchItem]:
        self.last_usage = None
        started = time.monotonic()
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    max_output_tokens=self._max_output_tokens,
                    temperature=self._temperature,
                ),
            )
        except Exception as exc:  # noqa: BLE001 — vendor-SDK failures never leak past this boundary (§28 rule 8)
            raise ResearchUnavailableError(f"Gemini grounded search call failed: {exc}") from exc

        latency_ms = (time.monotonic() - started) * 1000
        usage = getattr(response, "usage_metadata", None)
        self.last_usage = LLMUsageMetrics(
            input_tokens=getattr(usage, "prompt_token_count", None) if usage else None,
            output_tokens=getattr(usage, "candidates_token_count", None) if usage else None,
            latency_ms=latency_ms,
        )

        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            raise ResearchUnavailableError("Gemini returned no candidates for a grounded research call")

        grounding_metadata = getattr(candidates[0], "grounding_metadata", None)
        if grounding_metadata is None:
            raise ResearchUnavailableError(
                "Gemini response carried no grounding_metadata at all — the search tool may not have "
                "triggered, or this model/config doesn't support it"
            )

        return _items_from_grounding(grounding_metadata, source_type=source_type)


def _items_from_grounding(grounding_metadata: Any, *, source_type: str) -> list[ResearchItem]:
    chunks = getattr(grounding_metadata, "grounding_chunks", None) or []
    supports = getattr(grounding_metadata, "grounding_supports", None) or []
    retrieved_at = datetime.now(timezone.utc)

    # Merge every segment attributed to the same source (grounding_chunk) —
    # a chunk backing several segments becomes one item with concatenated
    # text, not several near-duplicate rows for the same URL.
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
            continue  # defensive — an out-of-range index would be a vendor-side inconsistency, not ours to invent
        web = getattr(chunks[chunk_index], "web", None)
        if web is None or not getattr(web, "uri", None):
            continue  # only web.web (google_search) chunks carry a real source_url; skip anything else
        items.append(
            ResearchItem(
                source_url=web.uri,
                source_name=getattr(web, "domain", None) or getattr(web, "title", None) or web.uri,
                title=getattr(web, "title", None) or getattr(web, "domain", None) or web.uri,
                summary=" ".join(texts),
                source_type=source_type,
                published_at=None,  # Gemini's grounding metadata doesn't carry a publish date
                retrieved_at=retrieved_at,
            )
        )
    return items


def _load_research_prompt(kind: str, version: str) -> str:
    path = PROMPTS_DIR / "research" / f"{kind}_{version}.md"
    if not path.exists():
        raise ResearchUnavailableError(f"no '{kind}' research prompt found for version '{version}' under prompts/research/")
    return path.read_text(encoding="utf-8")
