"""
Unit tests for GeminiResearchProvider (§26 Phase 4). Monkeypatches
`genai.Client` with a fake shaped like the real google-genai==2.23.0 SDK's
response objects (GroundingMetadata/GroundingChunk/GroundingSupport/Segment
field names verified directly against the installed SDK — see that module's
docstring). No real network/API call.
"""

from types import SimpleNamespace

import pytest

import app.providers.gemini_research_provider as gemini_module
from app.providers.base import ResearchUnavailableError


def _segment(text):
    return SimpleNamespace(text=text)


def _support(text, chunk_indices):
    return SimpleNamespace(segment=_segment(text), grounding_chunk_indices=chunk_indices)


def _web_chunk(uri, domain=None, title=None):
    return SimpleNamespace(web=SimpleNamespace(uri=uri, domain=domain, title=title))


def _response(chunks=None, supports=None, grounding_metadata=SimpleNamespace()):
    if chunks is not None or supports is not None:
        grounding_metadata = SimpleNamespace(grounding_chunks=chunks or [], grounding_supports=supports or [])
    candidate = SimpleNamespace(grounding_metadata=grounding_metadata)
    return SimpleNamespace(candidates=[candidate])


class _FakeModels:
    def __init__(self, response):
        self._response = response
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


class _FakeClient:
    def __init__(self, response):
        self.models = _FakeModels(response)


@pytest.fixture()
def prompts_dir(tmp_path, monkeypatch):
    research_dir = tmp_path / "research"
    research_dir.mkdir()
    (research_dir / "macro_v1.md").write_text("What is happening in macro markets?")
    (research_dir / "sector_v1.md").write_text("What is happening in the {sector} sector?")
    monkeypatch.setattr(gemini_module, "PROMPTS_DIR", tmp_path)
    return tmp_path


def test_missing_api_key_raises_immediately():
    with pytest.raises(ResearchUnavailableError, match="GOOGLE_AI_STUDIO_API_KEY"):
        gemini_module.GeminiResearchProvider(
            api_key="", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
        )


def test_get_macro_snapshot_builds_one_item_per_grounded_chunk(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )
    response = _response(
        chunks=[_web_chunk("https://example.com/a", domain="example.com", title="A headline")],
        supports=[_support("Inflation is cooling.", [0])],
    )
    monkeypatch.setattr(provider, "_client", _FakeClient(response))

    items = provider.get_macro_snapshot()

    assert len(items) == 1
    assert items[0].source_url == "https://example.com/a"
    assert items[0].summary == "Inflation is cooling."
    assert items[0].source_type == "macro_news"


def test_multiple_segments_for_same_chunk_are_merged(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )
    response = _response(
        chunks=[_web_chunk("https://example.com/a", title="A")],
        supports=[_support("First point.", [0]), _support("Second point.", [0])],
    )
    monkeypatch.setattr(provider, "_client", _FakeClient(response))

    items = provider.get_macro_snapshot()

    assert len(items) == 1
    assert items[0].summary == "First point. Second point."


def test_sector_research_formats_prompt_with_sector_name(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )
    fake_client = _FakeClient(_response(chunks=[], supports=[]))
    monkeypatch.setattr(provider, "_client", fake_client)

    provider.get_sector_research("Energy")

    assert "Energy" in fake_client.models.calls[0]["contents"]


def test_non_web_chunks_are_skipped(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )
    non_web_chunk = SimpleNamespace(web=None)
    response = _response(chunks=[non_web_chunk], supports=[_support("text", [0])])
    monkeypatch.setattr(provider, "_client", _FakeClient(response))

    items = provider.get_macro_snapshot()

    assert items == []


def test_out_of_range_chunk_index_is_skipped_defensively(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )
    response = _response(chunks=[], supports=[_support("text", [5])])
    monkeypatch.setattr(provider, "_client", _FakeClient(response))

    items = provider.get_macro_snapshot()

    assert items == []


def test_no_grounding_metadata_at_all_raises_unavailable(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )
    response = _response(grounding_metadata=None)
    monkeypatch.setattr(provider, "_client", _FakeClient(response))

    with pytest.raises(ResearchUnavailableError):
        provider.get_macro_snapshot()


def test_no_candidates_raises_unavailable(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )
    monkeypatch.setattr(provider, "_client", _FakeClient(SimpleNamespace(candidates=[])))

    with pytest.raises(ResearchUnavailableError):
        provider.get_macro_snapshot()


def test_sdk_exception_wraps_into_research_unavailable(monkeypatch, prompts_dir):
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )

    class _BoomModels:
        def generate_content(self, **kwargs):
            raise RuntimeError("vendor SDK exploded")

    monkeypatch.setattr(provider, "_client", SimpleNamespace(models=_BoomModels()))

    with pytest.raises(ResearchUnavailableError):
        provider.get_macro_snapshot()


def test_missing_prompt_file_raises_unavailable(tmp_path, monkeypatch):
    monkeypatch.setattr(gemini_module, "PROMPTS_DIR", tmp_path)  # empty dir — no research/ subfolder
    provider = gemini_module.GeminiResearchProvider(
        api_key="k", model="gemini-2.5-flash", prompt_version="v1", max_output_tokens=100, temperature=0.2
    )

    with pytest.raises(ResearchUnavailableError, match="no 'macro' research prompt"):
        provider.get_macro_snapshot()
