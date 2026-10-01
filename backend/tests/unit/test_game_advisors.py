"""Boundary tests for the game-mode advisors (app/services/game/advisors.py, G7b).

The advisors speak to Faiz about his real money, so each rule is pinned on both
sides of its edge, and the voice rules are tested explicitly: no trade
instructions, no flattery, no confident line over unknown data.
"""
from __future__ import annotations

import re
import uuid
from decimal import Decimal

import pytest

from app.domain.game_mapping.advisor_lines_v1 import ADVISOR_LINES_VERSION, TEMPLATES
from app.schemas.game import (
    DiworsificationOut,
    SharedWallOut,
    SiegeOut,
    TemperamentOut,
    TowerOut,
    VaultOut,
)
from app.services.game import advisors as adv

D = Decimal


def tower(name="Alpha", **kw) -> TowerOut:
    base = {
        "holding_id": uuid.uuid4(), "ticker": f"{name[:3].upper()}.OL", "name": name, "instrument_type": "stock",
        "sector": "Industrials", "structure": "keep", "value_nok": D(1000), "weight_pct": D(20),
        "size_class": "great", "moat": "wide", "wall": "granite", "wall_reason": "net debt / EBITDA 0.8x",
        "freshness": "fresh", "analysis_age_days": 10, "verdict_rating": "Hold",
    }
    base.update(kw)
    return TowerOut(**base)


def diw(shantytown="none", shacks=0, count=5) -> DiworsificationOut:
    return DiworsificationOut(
        position_count=count, shack_count=shacks, shantytown=shantytown, hhi=None,
        effective_holdings=None, top1_pct=None, top5_pct=None,
    )


def vault(level="stocked", stale=False) -> VaultOut:
    return VaultOut(
        level=level, cash_nok=None, cash_share_pct=None, accounts_total=1, accounts_with_cash=1,
        cash_oldest_as_of=None, gold_oz=D(0), silver_oz=D(0), cash_stale=stale,
    )


def siege(level="calm", walls=None, reasons=None) -> SiegeOut:
    return SiegeOut(
        level=level, reasons=reasons or [], regime=None, regime_explanation=None, portfolio_shock_pct=None,
        portfolio_drawdown_nok=None, risk_snapshot_at=None, risk_snapshot_age_days=None,
        risk_snapshot_stale=False, land_snapshot_at=None, land_snapshot_age_days=None,
        land_snapshot_stale=False, shared_walls=walls or [], breached_count=0,
    )


def temper(level="steady", *, low=False, drains=1, restores=3, decisions=8) -> TemperamentOut:
    return TemperamentOut(
        level=level, needle_pct=D(50), low_confidence=low, decisions_logged=decisions, snapshot_comparisons=0,
        drains=drains, restores=restores, window_days=365, summary="based on logged decisions",
        events=[], turnover=[],
    )


def lines(towers, *, d=None, v=None, s=None, t=None):
    return adv.candidate_lines(towers, d or diw(), v or vault(), s, t)


def rules_of(found):
    return [line.rule for line in found]


# --- structure of the line set ---------------------------------------------


def test_no_towers_means_no_advisors_speak():
    assert lines([]) == []
    out = adv.advisors([], diw(), vault(), None, None)
    assert out.lines == [] and out.hidden_count == 0 and out.lines_version == ADVISOR_LINES_VERSION


def test_every_rule_has_a_template_and_a_priority_and_no_extras():
    assert set(adv.RULE_ORDER) == set(TEMPLATES)
    assert len(adv.RULE_ORDER) == len(set(adv.RULE_ORDER))


def test_templates_never_give_trade_instructions_or_cheer():
    banned = re.compile(r"\b(buy|sell|add|trim|invest|purchase|congratulations|great job|well done)\b", re.IGNORECASE)
    for rule, tpl in TEMPLATES.items():
        assert not banned.search(tpl.text), f"{rule} reads like a trade instruction or flattery"


def test_templates_are_never_attributed_to_buffett_or_munger_as_quotes():
    for tpl in TEMPLATES.values():
        assert "buffett" not in tpl.text.lower() and "munger" not in tpl.text.lower()
    assert "not quotations" in adv.DISCLAIMER


# --- holding rules ---------------------------------------------------------


def test_a_fired_tripwire_is_a_partner_warning_with_the_count():
    (line,) = [x for x in lines([tower(thesis="breached", tripwires_fired=2)]) if x.rule == "tripwire_fired"]
    assert (line.advisor, line.tone) == ("partner", "warning")
    assert "2 of the conditions" in line.text and "Alpha" in line.text
    assert line.facts == ["2 tripwire(s) fired on the thesis monitor"]


def test_review_flag_is_an_oracle_note_and_is_not_also_a_breach():
    found = lines([tower(thesis="review")])
    assert "thesis_review" in rules_of(found) and "tripwire_fired" not in rules_of(found)


def test_intact_and_unanalysed_theses_say_nothing():
    for state in ("intact", "not_analyzed", "not_applicable"):
        found = rules_of(lines([tower(thesis=state)]))
        assert "tripwire_fired" not in found and "thesis_review" not in found


@pytest.mark.parametrize("size,fires", [("great", True), ("medium", True), ("small", False), ("tiny", False), ("unknown", False)])
def test_weak_walls_only_matter_on_big_towers(size, fires):
    found = rules_of(lines([tower(size_class=size, wall="timber")]))
    assert ("weak_walls_big_tower" in found) is fires


@pytest.mark.parametrize("wall,fires", [("rotted", True), ("timber", True), ("brick", False), ("granite", False), ("unsurveyed", False)])
def test_weak_walls_edge_is_timber(wall, fires):
    assert ("weak_walls_big_tower" in rules_of(lines([tower(wall=wall)]))) is fires


def test_weak_walls_line_names_weight_and_wall_and_carries_the_reason():
    (line,) = [x for x in lines([tower(wall="rotted", weight_pct=D("23.46"), wall_reason="debt but no EBITDA")])
               if x.rule == "weak_walls_big_tower"]
    assert "23.5%" in line.text and "rotted" in line.text
    assert "debt but no EBITDA" in line.facts


@pytest.mark.parametrize("moat,fires", [("none", True), ("narrow", False), ("wide", False), ("unsurveyed", False), ("not_applicable", False)])
def test_no_moat_fires_only_on_a_surveyed_none(moat, fires):
    assert ("no_moat_big_tower" in rules_of(lines([tower(moat=moat)]))) is fires


def test_a_small_tower_with_no_moat_is_not_scolded():
    assert "no_moat_big_tower" not in rules_of(lines([tower(size_class="small", moat="none")]))


@pytest.mark.parametrize("fresh,age,fires", [("overgrown", 200, True), ("weathered", 120, False), ("fresh", 5, False), ("unsurveyed", None, False)])
def test_stale_analysis_matters_on_big_towers(fresh, age, fires):
    found = lines([tower(freshness=fresh, analysis_age_days=age)])
    assert ("stale_big_tower" in rules_of(found)) is fires


def test_stale_line_says_the_age():
    (line,) = [x for x in lines([tower(freshness="overgrown", analysis_age_days=211)]) if x.rule == "stale_big_tower"]
    assert "211 days" in line.text


@pytest.mark.parametrize(
    "land,wall,moat,fires",
    [
        ("bargain", "basalt", "wide", True),
        ("discount", "granite", "narrow", True),
        ("discount", "brick", "wide", False),      # walls not strong enough
        ("discount", "granite", "none", False),    # no moat
        ("full_price", "granite", "wide", False),
        ("fog", "granite", "wide", False),         # unknown stays unknown
    ],
)
def test_cheap_on_strong_walls_needs_cheap_land_strong_walls_and_a_moat(land, wall, moat, fires):
    found = lines([tower(land=land, wall=wall, moat=moat, land_reason="stored zone")])
    assert ("cheap_on_strong_walls" in rules_of(found)) is fires


def test_cheap_line_names_the_zone_and_is_not_a_signal():
    (bear,) = [x for x in lines([tower(land="bargain")]) if x.rule == "cheap_on_strong_walls"]
    (base,) = [x for x in lines([tower(land="discount")]) if x.rule == "cheap_on_strong_walls"]
    assert "bear case" in bear.text and "base case" in base.text
    assert "not a signal" in bear.text


@pytest.mark.parametrize("land,size,fires", [("overpriced", "great", True), ("overpriced", "medium", True),
                                             ("overpriced", "small", False), ("full_price", "great", False), ("fog", "great", False)])
def test_dear_big_tower(land, size, fires):
    assert ("dear_big_tower" in rules_of(lines([tower(land=land, size_class=size)]))) is fires


# --- realm rules -----------------------------------------------------------


@pytest.mark.parametrize("weather,vlevel,expected", [
    ("gathering", "thin", "storm_vault_thin"), ("besieged", "empty", "storm_vault_thin"),
    ("gathering", "stocked", "storm_vault_ready"), ("besieged", "deep", "storm_vault_ready"),
])
def test_vault_lines_only_when_the_weather_turns(weather, vlevel, expected):
    found = rules_of(lines([tower()], v=vault(vlevel), s=siege(weather, reasons=["regime stagflation"])))
    assert expected in found
    other = {"storm_vault_thin", "storm_vault_ready"} - {expected}
    assert not other & set(found)


@pytest.mark.parametrize("weather", ["calm", "unsurveyed", None])
def test_no_storm_vault_line_in_calm_or_unknown_weather(weather):
    s = None if weather is None else siege(weather)
    found = rules_of(lines([tower()], v=vault("thin"), s=s))
    assert "storm_vault_thin" not in found and "storm_vault_ready" not in found


def test_storm_vault_ready_never_tells_him_to_spend_it():
    (line,) = [x for x in lines([tower()], v=vault("deep"), s=siege("besieged")) if x.rule == "storm_vault_ready"]
    assert line.tone == "calm" and "must spend" in line.text


@pytest.mark.parametrize("level,stale,reason", [("unsurveyed", False, "no cash"), ("stocked", True, "old"), ("thin", True, "old")])
def test_vault_unknown_when_nothing_entered_or_figure_is_old(level, stale, reason):
    (line,) = [x for x in lines([tower()], v=vault(level, stale=stale)) if x.rule == "vault_unknown"]
    assert reason in line.text


def test_vault_known_and_fresh_says_nothing_about_missing_cash():
    assert "vault_unknown" not in rules_of(lines([tower()], v=vault("stocked")))


@pytest.mark.parametrize("level,fires", [("none", False), ("light", True), ("heavy", True)])
def test_shantytown(level, fires):
    assert ("shantytown" in rules_of(lines([tower()], d=diw(level, shacks=4)))) is fires


def test_shared_walls_name_both_holdings_and_are_capped():
    walls = [SharedWallOut(names=[f"A{i}", f"B{i}"], tickers=[], correlation=D("0.8123"), combined_weight_pct=D("24.04"))
             for i in range(5)]
    found = [x for x in lines([tower()], s=siege("calm", walls=walls)) if x.rule == "shared_wall"]
    assert len(found) == adv.MAX_PER_RULE
    assert "A0 and B0" in found[0].text and "0.81" in found[0].text and "24.0%" in found[0].text


def test_temperament_lines_need_a_confident_reading():
    assert "temperament_strained" not in rules_of(lines([tower()], t=temper("rash", low=True)))
    assert "temperament_composed" not in rules_of(lines([tower()], t=temper("composed", low=True)))
    assert "temperament_strained" not in rules_of(lines([tower()], t=temper("steady")))


@pytest.mark.parametrize("level", ["restless", "rash"])
def test_strained_temperament_is_a_partner_warning(level):
    (line,) = [x for x in lines([tower()], t=temper(level, drains=4, decisions=9)) if x.rule == "temperament_strained"]
    assert (line.advisor, line.tone) == ("partner", "warning")
    assert level in line.text and "4 recent decisions" in line.text and "9 logged" in line.text


def test_composed_temperament_is_calm_and_not_praise():
    (line,) = [x for x in lines([tower()], t=temper("composed")) if x.rule == "temperament_composed"]
    assert (line.advisor, line.tone) == ("oracle", "calm")
    assert "keep writing down" in line.text.lower()


# --- all quiet -------------------------------------------------------------


def test_all_quiet_only_when_nothing_asks_for_attention_and_the_weather_is_calm():
    quiet = lines([tower()], s=siege("calm"))
    assert "all_quiet" in rules_of(quiet)
    assert "all_quiet" in rules_of(lines([tower()]))                       # no stored siege at all: still nothing wrong


def test_all_quiet_is_withheld_when_anything_is_flagged_or_weather_turns():
    assert "all_quiet" not in rules_of(lines([tower(thesis="review")]))
    assert "all_quiet" not in rules_of(lines([tower()], v=vault("unsurveyed")))
    assert "all_quiet" not in rules_of(lines([tower()], s=siege("gathering")))
    assert "all_quiet" not in rules_of(lines([tower()], s=siege("unsurveyed")))


def test_calm_lines_alone_do_not_suppress_all_quiet():
    # A composed journal is a calm line, not a problem: the quiet line still stands.
    assert "all_quiet" in rules_of(lines([tower()], t=temper("composed")))


# --- ordering, caps, determinism ------------------------------------------


def test_warnings_come_before_notes_before_calm():
    towers = [tower("Alpha", thesis="breached", tripwires_fired=1), tower("Beta", thesis="review")]
    out = adv.advisors(towers, diw("light", 2), vault("deep"), siege("besieged"), temper("composed"))
    tones = [line.tone for line in out.lines]
    assert tones == sorted(tones, key=lambda t: {"warning": 0, "note": 1, "calm": 2}[t])
    assert out.lines[0].rule == "tripwire_fired"


def test_largest_holding_is_named_first_within_a_rule():
    small = tower("Small", weight_pct=D(8), size_class="medium", wall="rotted")
    big = tower("Big", weight_pct=D(30), size_class="great", wall="rotted")
    out = adv.advisors([small, big], diw(), vault(), None, None)
    names = [x.holding_name for x in out.lines if x.rule == "weak_walls_big_tower"]
    assert names == ["Big", "Small"]


def test_a_rule_is_capped_and_the_overflow_is_counted_not_dropped_silently():
    towers = [tower(f"T{i}", weight_pct=D(30 - i), thesis="breached", tripwires_fired=1) for i in range(5)]
    out = adv.advisors(towers, diw(), vault(), None, None)
    assert [x.rule for x in out.lines].count("tripwire_fired") == adv.MAX_PER_RULE
    assert out.hidden_count == 3


def test_total_lines_are_capped_and_hidden_count_is_the_remainder():
    towers = [tower(f"T{i}", weight_pct=D(30 - i), thesis="breached", tripwires_fired=1, wall="rotted", moat="none",
                    freshness="overgrown", analysis_age_days=300) for i in range(4)]
    args = (towers, diw("heavy", 6), vault("unsurveyed"), siege("besieged"), temper("rash"))
    out = adv.advisors(*args)
    found = adv.candidate_lines(*args)
    assert len(out.lines) == adv.MAX_LINES
    assert out.hidden_count == len(found) - len(out.lines) > 0
    assert out.lines[0].tone == "warning"


def test_same_input_gives_the_same_lines():
    towers = [tower("A", thesis="breached", tripwires_fired=1), tower("B", wall="timber")]
    a = adv.advisors(towers, diw(), vault(), siege("gathering"), temper("rash"))
    b = adv.advisors(towers, diw(), vault(), siege("gathering"), temper("rash"))
    assert a == b


def test_every_line_carries_facts_it_was_chosen_from():
    towers = [tower("A", thesis="breached", tripwires_fired=1, wall="timber", moat="none")]
    out = adv.advisors(towers, diw("heavy", 5), vault("unsurveyed"), siege("besieged"), temper("rash"))
    assert out.lines and all(line.facts for line in out.lines)
