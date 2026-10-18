"""Council questions (app/services/game/council_ask.py, council_questions_v1): the answers speak about
real money, so each case is pinned and the voice rules are tested: no trade words, no free text, no
confident answer over unknown data, silence never reads as all clear."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.domain.game_mapping.council_questions_v1 import QUESTIONS, TEMPLATES
from app.schemas.game import GameStateOut, MarginOut
from app.services.game import council_ask as ask
from tests.unit.test_game_advisors import diw, siege, tower, vault

D = Decimal
NOW = datetime(2026, 10, 18, 9, tzinfo=timezone.utc)
FORBIDDEN = re.compile(r"\b(buy|sell|add|trim|invest|purchase)\b", re.IGNORECASE)


def state(*towers, level="calm") -> GameStateOut:
    return GameStateOut(
        mapping_version="v1", as_of=NOW, total_value_nok=D(1000), towers=list(towers),
        diworsification=diw(), vault=vault(), siege=siege(level), notes=[],
    )


def margin(direction="stronger", *, near=False, to_tier="granite", text="Net debt / EBITDA is 2.0x; granite needs 1.5x or less (0.5x away).", metric="net_debt_to_ebitda"):
    return MarginOut(metric=metric, label="Net debt / EBITDA", value=D("2.0"), boundary=D("1.5"), direction=direction,
                     to_tier=to_tier, distance=D("0.5"), near=near, text=text)


def ask_all(st, t):
    return [ask.answer(st, t.holding_id, q, a) for q in QUESTIONS for a in ("oracle", "partner")]


def test_every_template_names_both_advisors_and_no_trade_words():
    for case, by_advisor in TEMPLATES.items():
        assert set(by_advisor) == {"oracle", "partner"}, case
        for who, a in by_advisor.items():
            assert not FORBIDDEN.search(a.text), (case, who)


def test_unknown_holding_is_none_and_unknown_question_raises():
    st = state(tower("Alpha"))
    assert ask.answer(st, uuid.uuid4(), "edge", "oracle") is None
    with pytest.raises(ValueError):
        ask.answer(st, st.towers[0].holding_id, "should_i_buy", "oracle")


def test_all_answers_are_free_of_trade_words_and_carry_the_disclaimer():
    t = tower("Alpha", wall_margins=[margin(), margin("weaker", to_tier="brick", near=True, text="Net debt / EBITDA is 2.0x; brick begins above 2.2x (0.2x of room).")],
              siege_exposure="exposed", siege_shock_pct=D("-0.25"), siege_method="dcf_bear", shared_wall_with=["Beta"])
    st = state(t, tower("Beta", weight_pct=D(15)))
    for out in ask_all(st, t):
        assert out is not None and not FORBIDDEN.search(out.text), out.text
        assert "not quotations" in out.disclaimer


# --- why_here ---------------------------------------------------------------


def test_why_here_uses_that_advisors_own_lines_and_facts():
    t = tower("Alpha", thesis="breached", tripwires_fired=2)  # a Partner rule
    st = state(t)
    partner = ask.answer(st, t.holding_id, "why_here", "partner")
    assert partner.read == "read" and partner.tone == "warning" and "tripwire_fired" in partner.rules
    assert any("tripwire" in f for f in partner.facts)
    oracle = ask.answer(st, t.holding_id, "why_here", "oracle")
    assert oracle.read == "silent" and oracle.rules == []
    assert "not a clean bill" in oracle.text or "not read that as safe" in oracle.text.lower() or "Do not read" in oracle.text


def test_silence_is_never_all_clear():
    t = tower("Quiet", weight_pct=D(2), size_class="tiny")
    out = ask.answer(state(t), t.holding_id, "why_here", "partner")
    assert out.read == "silent" and out.tone == "calm"
    for bad in ("all clear", "nothing to worry"):
        assert bad not in out.text.lower()


# --- edge -------------------------------------------------------------------


def test_edge_fund_and_unsurveyed_are_no_reading():
    fund = tower("Fund", structure="outpost", wall="not_applicable", wall_reason="fund")
    fog = tower("Fog", wall="unsurveyed", wall_reason="no balance sheet stored")
    st = state(fund, fog)
    for t in (fund, fog):
        out = ask.answer(st, t.holding_id, "edge", "oracle")
        assert out.read == "none" and out.tone == "note"


def test_edge_climbing_quotes_the_stored_distance():
    t = tower("Alpha", wall="brick", wall_margins=[margin(), margin("weaker", to_tier="timber", text="x")])
    out = ask.answer(state(t), t.holding_id, "edge", "oracle")
    assert out.read == "read" and "granite needs 1.5x or less" in out.text and out.tone == "calm"
    assert t.wall_reason in out.facts


def test_edge_near_the_weaker_line_warns_and_weak_walls_name_the_weak_end():
    near = tower("Nearly", wall="brick", wall_margins=[margin(), margin("weaker", near=True, to_tier="timber", text="timber begins above 2.2x (0.2x of room).")])
    out = ask.answer(state(near), near.holding_id, "edge", "partner")
    assert out.tone == "warning" and "timber begins above 2.2x" in out.text
    weak = tower("Weakly", wall="timber", wall_margins=[margin(to_tier="brick", text="brick needs 3.0x or less.")])
    out = ask.answer(state(weak), weak.holding_id, "edge", "partner")
    assert out.tone == "warning" and "weak end" in out.text


def test_edge_top_and_basalt_and_missing_ratio():
    top = tower("Rock", wall="basalt", wall_margins=[])
    assert "as high as this ladder goes" in ask.answer(state(top), top.holding_id, "edge", "oracle").text
    unmeasured = tower("NoRatio", wall="brick", wall_margins=[])
    out = ask.answer(state(unmeasured), unmeasured.holding_id, "edge", "oracle")
    assert "not known" in out.text


# --- storm ------------------------------------------------------------------


@pytest.mark.parametrize("exposure,shock,tone", [("sheltered", D("-0.04"), "calm"), ("exposed", D("-0.22"), "note"), ("breach_risk", D("-0.45"), "warning")])
def test_storm_tone_follows_the_stored_exposure(exposure, shock, tone):
    t = tower("Alpha", siege_exposure=exposure, siege_shock_pct=shock, siege_method="volatility")
    out = ask.answer(state(t, level="gathering"), t.holding_id, "storm", "partner")
    assert out.read == "read" and out.tone == tone
    assert f"{(shock * 100):.1f}%" in out.text
    assert any("gathering" in f for f in out.facts)


def test_storm_without_a_stored_result_is_no_reading_not_a_guess():
    t = tower("Alpha")  # siege_exposure defaults to unsurveyed
    out = ask.answer(state(t), t.holding_id, "storm", "oracle")
    assert out.read == "none" and "%" not in out.text


# --- beside -----------------------------------------------------------------


def test_beside_alone_says_the_check_found_none_not_that_none_exist():
    t = tower("Alone", weight_pct=D(8), sector=None)
    out = ask.answer(state(t), t.holding_id, "beside", "partner")
    assert out.tone == "calm" and "not stored" in out.text and "none exists" in out.text


def test_beside_together_adds_the_weights_in_app_code():
    a = tower("Alpha", weight_pct=D(10), shared_wall_with=["Beta"])
    b = tower("Beta", weight_pct=D(8), shared_wall_with=["Alpha"])
    out = ask.answer(state(a, b), a.holding_id, "beside", "oracle")
    assert out.tone == "note" and "18.0%" in out.text


def test_beside_heavy_warns_and_unknown_weight_is_not_summed():
    a = tower("Alpha", weight_pct=D(18), shared_wall_with=["Beta"])
    b = tower("Beta", weight_pct=D(15), shared_wall_with=["Alpha"])
    assert ask.answer(state(a, b), a.holding_id, "beside", "partner").tone == "warning"
    c = tower("Gamma", weight_pct=D(18), shared_wall_with=["Delta"])
    d = tower("Delta", weight_pct=None, size_class="unknown", shared_wall_with=["Gamma"])
    out = ask.answer(state(c, d), c.holding_id, "beside", "oracle")
    assert "unknown share" in out.text and out.tone == "note"
