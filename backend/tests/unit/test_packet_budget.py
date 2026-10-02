"""Unit tests for app.services.analysis.packet_budget -- the hard size limit
on the evidence packet (2026-10-02, after Equinor and Aker BP outgrew every
local context). The property that matters: more data must never mean a bigger
prompt than the caps and the budget allow."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.analysis.evidence_packet import EvidenceItem, EvidencePacket
from app.services.analysis.packet_budget import (
    OUTPUT_RESERVE_TOKENS,
    TRIM_MARKER,
    apply_token_budget,
    estimate_tokens,
    item_tokens,
    packet_token_budget,
    policy_for,
    truncate_text,
)

SENTENCE = "Revenue grew strongly in the quarter on higher realised prices. "


def _packet(items: list[tuple[str, str]]) -> EvidencePacket:
    packet = EvidencePacket(holding_id=uuid.uuid4(), ticker="TST.OL")
    for n, (category, content) in enumerate(items, start=1):
        packet.items.append(
            EvidenceItem(id=f"EV-{n:03d}", category=category, label=f"{category} {n}", content=content,
                         citation="Src — https://example.com")
        )
    return packet


def _total(packet: EvidencePacket) -> int:
    return sum(item_tokens(i) for i in packet.items)


def _by(packet: EvidencePacket, category: str) -> list[EvidenceItem]:
    return [i for i in packet.items if i.category == category]


def _settings(**kw):
    base = {
        "evidence_packet_token_budget": 18000, "analysis_prompt_overhead_tokens": 4000,
        "ollama_num_ctx": 24576, "ollama_fallback_num_ctx": 40960, "ollama_fallback_model_name": "qwen3:8b",
        "ollama_adaptive_fit": True,
    }
    return SimpleNamespace(**{**base, **kw})


# --- truncate_text -----------------------------------------------------------

def test_truncate_leaves_short_text_alone():
    assert truncate_text("short text.", 500) == "short text."


def test_truncate_fits_and_cuts_at_a_sentence_and_says_so():
    text = SENTENCE * 400
    out = truncate_text(text, 200)
    assert estimate_tokens(out) <= 200
    assert out.endswith(TRIM_MARKER)
    body = out[: -len(TRIM_MARKER)]
    assert body.endswith(".")  # a sentence end, not mid-word


def test_truncate_prefers_line_ends_for_lists():
    text = "\n".join(f"Holding {i}: 1.23% weight, NOK 1,234,567" for i in range(500))
    out = truncate_text(text, 300).removesuffix(TRIM_MARKER)
    assert estimate_tokens(out) <= 300
    assert out.splitlines()[-1].startswith("Holding ") and out.splitlines()[-1].endswith("567")


# --- always-on caps: growth is bounded --------------------------------------

@pytest.mark.parametrize("n", [10, 100, 1000])
def test_growth_in_research_and_announcements_cannot_grow_the_packet(n):
    items = [("financial_history", "ROE 2024: 12.1%; ROE 2023: 11.4%")]
    items += [("company_research", SENTENCE * 80) for _ in range(n)]
    items += [("sector_research", SENTENCE * 80) for _ in range(n)]
    items += [("macro_research", SENTENCE * 80) for _ in range(n)]
    items += [("regulatory_announcements", SENTENCE * 20) for _ in range(n)]
    packet = _packet(items)
    apply_token_budget(packet, total_budget=None)
    for category in ("company_research", "sector_research", "macro_research", "regulatory_announcements"):
        cap = policy_for(category).cap_tokens
        assert sum(item_tokens(i) for i in _by(packet, category)) <= cap
    # the same ceiling at 10 and at 1000 items
    assert _total(packet) <= 1_000 + sum(p.cap_tokens for p in (
        policy_for("company_research"), policy_for("sector_research"),
        policy_for("macro_research"), policy_for("regulatory_announcements")))


def test_one_oversized_item_is_cut_to_its_item_cap():
    packet = _packet([("company_research", SENTENCE * 2000)])
    apply_token_budget(packet, total_budget=None)
    assert item_tokens(packet.items[0]) <= policy_for("company_research").item_cap_tokens + 3
    assert packet.items[0].content.endswith(TRIM_MARKER)


def test_large_fund_holdings_list_keeps_the_top_lines():
    lines = "\n".join(f"{i}. Company {i} — {1000 - i} bps" for i in range(1, 2001))
    packet = _packet([("fund_holdings", lines)])
    apply_token_budget(packet, total_budget=None)
    kept = packet.items[0].content
    assert kept.startswith("1. Company 1 ")
    assert item_tokens(packet.items[0]) <= policy_for("fund_holdings").item_cap_tokens + 3


# --- the total budget -------------------------------------------------------

def _bloated() -> EvidencePacket:
    items = [("holding", "Equinor ASA (EQNR.OL)")]
    items += [("financial_history", "Metric history: " + "2024: 12.1%; " * 40) for _ in range(12)]  # protected
    items += [("valuation", "DCF base case NOK 310; bear 240; bull 400. " * 10) for _ in range(4)]  # protected
    items += [("regulatory_announcements", SENTENCE * 8) for _ in range(15)]
    items += [("macro_research", SENTENCE * 20) for _ in range(4)]
    items += [("sector_research", SENTENCE * 20) for _ in range(4)]
    items += [("company_research", SENTENCE * 30) for _ in range(5)]
    items += [("document_excerpt", SENTENCE * 25) for _ in range(8)]
    items += [("macro_indicator", "Policy rate 4.00%, 3m change -0.25. " * 6) for _ in range(10)]
    return _packet(items)


def test_total_budget_is_met_and_protected_evidence_is_untouched():
    packet = _bloated()
    protected_before = [i for i in packet.items if i.category in ("holding", "financial_history", "valuation")]
    uncapped = _total(packet)
    budget = 9000
    assert uncapped > budget
    report = apply_token_budget(packet, total_budget=budget)
    assert _total(packet) <= budget
    assert not report.over_budget
    protected_after = [i for i in packet.items if i.category in ("holding", "financial_history", "valuation")]
    assert protected_after == protected_before  # byte-identical: figures are never cut


def test_lowest_value_categories_are_cut_first():
    packet = _bloated()
    # Just enough pressure to need announcements only.
    capped = _packet([(i.category, i.content) for i in packet.items])
    apply_token_budget(capped, total_budget=None)
    slightly_under = _total(capped) - 400
    packet2 = _bloated()
    apply_token_budget(packet2, total_budget=slightly_under)
    ann = sum(item_tokens(i) for i in _by(packet2, "regulatory_announcements"))
    ann_capped = sum(item_tokens(i) for i in _by(capped, "regulatory_announcements"))
    assert ann < ann_capped
    # higher-rank categories are left whole at this pressure
    for category in ("company_research", "document_excerpt", "macro_indicator"):
        assert sum(item_tokens(i) for i in _by(packet2, category)) == sum(
            item_tokens(i) for i in _by(capped, category))


def test_evidence_ids_are_never_renumbered():
    packet = _bloated()
    original = {i.id: i for i in packet.items}
    apply_token_budget(packet, total_budget=6000)
    for item in packet.items:
        assert item.id in original
        assert item.category == original[item.id].category
        assert item.label == original[item.id].label


def test_protected_figures_larger_than_budget_are_reported_not_hidden():
    packet = _packet([("financial_history", "Metric: " + "1234567; " * 3000)] * 3)
    report = apply_token_budget(packet, total_budget=2000)
    assert report.over_budget
    assert any("STILL OVER" in r for r in packet.unavailable_reasons)


def test_trim_is_recorded_on_the_packet_and_in_the_notes():
    packet = _bloated()
    report = apply_token_budget(packet, total_budget=8000)
    assert report.trimmed
    assert packet.token_budget["tokens_after"] == report.tokens_after
    assert packet.token_budget["budget_tokens"] == 8000
    assert packet.as_dict()["token_budget"] == packet.token_budget
    notes = [r for r in packet.unavailable_reasons if r.startswith("evidence trimmed")]
    assert len(notes) == 1 and "regulatory_announcements" in notes[0]


def test_nothing_is_reported_when_nothing_was_cut():
    packet = _packet([("holding", "x"), ("financial_history", "ROE 12%")])
    report = apply_token_budget(packet, total_budget=18000)
    assert not report.trimmed
    assert packet.unavailable_reasons == []


def test_is_deterministic():
    a, b = _bloated(), _bloated()
    apply_token_budget(a, total_budget=7000)
    apply_token_budget(b, total_budget=7000)
    assert [i.content for i in a.items] == [i.content for i in b.items]


# --- the derived budget -----------------------------------------------------

def test_budget_default_is_the_configured_limit_when_it_fits():
    assert packet_token_budget(_settings(), provider_name="ollama") == 18000


def test_budget_is_derived_from_the_largest_local_context():
    s = _settings(evidence_packet_token_budget=0)
    assert packet_token_budget(s, provider_name="ollama") == 40960 - 2 * OUTPUT_RESERVE_TOKENS - 4000


def test_budget_shrinks_when_there_is_no_fallback_model():
    s = _settings(ollama_fallback_model_name="")
    assert packet_token_budget(s, provider_name="ollama") == 24576 - 2 * OUTPUT_RESERVE_TOKENS - 4000


def test_cloud_provider_uses_only_the_configured_limit():
    assert packet_token_budget(_settings(), provider_name="google_ai_studio") == 18000
    assert packet_token_budget(_settings(evidence_packet_token_budget=0), provider_name="google_ai_studio") is None


def test_both_passes_fit_the_largest_context_by_construction():
    """The guarantee the whole change rests on: with the budget met, the
    reconciliation prompt (packet + blind JSON + overhead) plus the answer
    reserve is within the context the fallback model can be given."""
    s = _settings(evidence_packet_token_budget=0)
    budget = packet_token_budget(s, provider_name="ollama")
    blind_json = OUTPUT_RESERVE_TOKENS
    assert budget + blind_json + s.analysis_prompt_overhead_tokens + OUTPUT_RESERVE_TOKENS <= s.ollama_fallback_num_ctx
