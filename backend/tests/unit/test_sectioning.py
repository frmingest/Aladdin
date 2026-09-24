"""Sprint 6: section-aware chunking (app/services/documents/sectioning.py)."""
from __future__ import annotations

import pytest

from app.services.documents.sectioning import (
    SECTION_CHUNK_CHARS,
    TAGGED_FACTS_SECTION,
    UNTITLED_SECTION,
    detect_heading,
    split_into_section_chunks,
)


@pytest.mark.parametrize(
    "line,expected",
    [
        ("Risk factors", "Risk factors"),
        ("RISK FACTORS", "RISK FACTORS"),
        ("3.2 Capital allocation", "Capital allocation"),
        ("Outlook for 2026", "Outlook for 2026"),
        ("Letter from the CEO", "Letter from the CEO"),
        ("Styrets beretning", "Styrets beretning"),
        ("OUR PEOPLE", "Our People"),
        ("4 Market Overview", "Market Overview"),
    ],
)
def test_detects_headings(line, expected):
    assert detect_heading(line) == expected


@pytest.mark.parametrize(
    "line",
    [
        "The company increased production by 12% compared to last year.",
        "Revenue | 1,234 | 1,100",
        "2025 2024 2023",
        "Net income",  # plain title-case table label is not a heading
        "12.5",
        "",
    ],
)
def test_ignores_non_headings(line):
    assert detect_heading(line) is None


def test_heading_carries_across_pages_and_sets_page_range():
    body = "We hold the lowest unit cost position in the basin. " * 5
    chunks = split_into_section_chunks([(1, f"Strategy\n{body}"), (2, body)])
    assert len(chunks) == 1
    assert chunks[0].section == "Strategy"
    assert (chunks[0].page_start, chunks[0].page_end) == (1, 2)


def test_new_heading_starts_new_chunk():
    chunks = split_into_section_chunks(
        [(1, "Outlook\nWe expect production growth next year.\nRisk factors\nOil price volatility.")]
    )
    assert [c.section for c in chunks] == ["Outlook", "Risk factors"]
    assert "Oil price" in chunks[1].content and "Oil price" not in chunks[0].content


def test_chunks_respect_the_size_limit_and_split_long_esef_paragraphs():
    paragraph = "This is one long sentence about the business. " * 120  # ~5,500 chars on one line
    chunks = split_into_section_chunks([(1, paragraph)])
    assert len(chunks) >= 3
    assert all(len(c.content) <= SECTION_CHUNK_CHARS for c in chunks)
    assert all(c.section == UNTITLED_SECTION for c in chunks)


def test_every_chunk_has_a_section_label():
    chunks = split_into_section_chunks([(1, "Some text without a heading."), (2, "More text.")])
    assert chunks and all(c.section for c in chunks)


def test_tagged_facts_page_gets_its_own_section():
    chunks = split_into_section_chunks(
        [(1, "Strategy\nGrow margins."), (2, "Tagged XBRL facts (machine-readable)\nifrs:Revenue | 2025 | 100")]
    )
    assert chunks[-1].section == TAGGED_FACTS_SECTION


def test_empty_pages_give_no_chunks():
    assert split_into_section_chunks([(1, ""), (2, "   \n  ")]) == []
