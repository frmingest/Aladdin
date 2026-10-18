"""Sprint 24 pure logic: Frame diff, Raven measures, Night Watch dispatch
(game mode G15 / G16, 2026-10-04)."""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.domain.game_mapping.time_and_filings_v1 import (
    TIME_AND_FILINGS_V1 as R,
)
from app.domain.game_mapping.time_and_filings_v1 import (
    RavenMeasure,
    get_time_and_filings,
)
from app.schemas.game import (
    FrameChangeOut,
    FrameOut,
    FrameTowerOut,
    NightWatchFiredOut,
)
from app.services.game.frame_diff import diff_frames
from app.services.game.night_watch import build_night_watch
from app.services.game.ravens import measure_line, summarise

D = Decimal
NOW = datetime(2026, 10, 4, 8, 0, tzinfo=timezone.utc)
BANNED = re.compile(r"\b(buy|sell|add|trim|invest|purchase|congratulations|great job|well done)\b", re.IGNORECASE)


def tower(name, weight, *, wall="granite", moat="wide", land="fog", thesis="intact", hid=None):
    return FrameTowerOut(
        holding_id=hid or uuid.uuid5(uuid.NAMESPACE_DNS, name), ticker=name[:4].upper(), name=name,
        structure="keep", size_class="medium", weight_pct=None if weight is None else D(weight),
        wall=wall, moat=moat, land=land, thesis=thesis,
    )


def frame(day, towers, *, weather="calm"):
    return FrameOut(
        day=day, at=datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc),
        total_value_nok=D(1000), weather=weather, towers=towers,
    )


# --- rules file --------------------------------------------------------------

def test_rules_version_lookup():
    assert get_time_and_filings("v1") is R
    with pytest.raises(ValueError):
        get_time_and_filings("v9")


# --- Frame diff ----------------------------------------------------------------

def test_towers_joining_leaving_and_resizing():
    a, b = tower("Alpha", 30), tower("Beta", 20)
    before = frame(date(2026, 9, 1), [a, b])
    after = frame(date(2026, 9, 2), [tower("Alpha", 36), tower("Gamma", 10)])
    kinds = {c.kind: c for c in diff_frames(before, after, R)}
    assert "Gamma joined the fortress (10.0% of the realm)" in kinds["tower_added"].text
    assert "Beta left the fortress" in kinds["tower_removed"].text
    assert "Alpha went from 30.0% to 36.0%" in kinds["tower_resized"].text


def test_small_weight_drift_is_not_news():
    before = frame(date(2026, 9, 1), [tower("Alpha", 30)])
    after = frame(date(2026, 9, 2), [tower("Alpha", "31.9")])
    assert diff_frames(before, after, R) == []
    after = frame(date(2026, 9, 2), [tower("Alpha", "32.0")])
    assert [c.kind for c in diff_frames(before, after, R)] == ["tower_resized"]


def test_wall_moat_thesis_and_weather_changes_between_stored_frames():
    before = frame(date(2026, 9, 1), [tower("Alpha", 30, wall="granite", moat="wide", thesis="intact")])
    after = frame(date(2026, 9, 2), [tower("Alpha", 30, wall="timber", moat="narrow", thesis="breached")], weather="gathering")
    texts = [c.text for c in diff_frames(before, after, R)]
    assert "The weather turned from calm to gathering." in texts
    assert "The walls of Alpha went from granite to timber." in texts
    assert "The moat of Alpha went from wide to narrow." in texts
    assert "A tripwire fired on Alpha." in texts


def test_surveyed_and_no_longer_surveyed_are_said_plainly():
    before = frame(date(2026, 9, 1), [tower("Alpha", 30, wall="unsurveyed", moat="wide")])
    after = frame(date(2026, 9, 2), [tower("Alpha", 30, wall="brick", moat="unsurveyed")])
    texts = [c.text for c in diff_frames(before, after, R)]
    assert "The walls of Alpha were surveyed: brick." in texts
    assert "The moat of Alpha is no longer surveyed." in texts


# --- Ravens --------------------------------------------------------------------

ROIC = next(m for m in R.raven_measures if m.metric == "roic")
LEV = next(m for m in R.raven_measures if m.metric == "net_debt_to_ebitda")
OE = next(m for m in R.raven_measures if m.metric == "owner_earnings")
COVER = next(m for m in R.raven_measures if m.metric == "interest_coverage")


def _line(measure, prev, cur, **kw):
    kw.setdefault("currency", "NOK")
    kw.setdefault("currency_changed", False)
    return measure_line(measure, None if prev is None else D(prev), None if cur is None else D(cur),
                        previous_period_label="FY2024", current_period_label="FY2025", **kw)


def test_points_measure_better_worse_steady_at_the_step():
    assert _line(ROIC, "0.10", "0.13").direction == "better"
    assert _line(ROIC, "0.13", "0.10").direction == "worse"
    assert _line(ROIC, "0.10", "0.1199").direction == "steady"     # just under 2 points
    assert _line(ROIC, "0.10", "0.12").direction == "better"       # exactly 2 points counts
    assert "rose from 10.0% to 13.0%" in _line(ROIC, "0.10", "0.13").text


def test_leverage_is_lower_better():
    assert _line(LEV, "1.0", "2.0").direction == "worse"
    assert _line(LEV, "2.0", "1.0").direction == "better"
    assert _line(LEV, "1.0", "1.4").direction == "steady"
    assert "fell from 2.0x to 1.0x" in _line(LEV, "2.0", "1.0").text


def test_interest_cover_higher_is_better():
    assert _line(COVER, "5", "3").direction == "worse"


def test_relative_measure_and_currency_guard():
    assert _line(OE, "100000000", "120000000").direction == "better"
    assert _line(OE, "100000000", "110000000").direction == "steady"
    assert "NOK" in _line(OE, "100000000", "120000000").text
    guarded = _line(OE, "100", "300", currency_changed=True)
    assert guarded.direction == "unknown" and "different currencies" in guarded.text
    zero = _line(OE, "0", "5")
    assert zero.direction == "unknown"


def test_missing_period_is_unknown_never_a_default_and_absent_both_is_dropped():
    assert _line(ROIC, None, None) is None
    line = _line(ROIC, "0.1", None)
    assert line.direction == "unknown" and "FY2025" in line.text
    assert _line(ROIC, None, "0.1").text.endswith("no comparison.") and "FY2024" in _line(ROIC, None, "0.1").text


def test_summary_counts_and_empty_case():
    lines = [_line(ROIC, "0.1", "0.2"), _line(LEV, "1", "3"), _line(COVER, "5", "5.2"), _line(OE, None, "5")]
    text, better, worse = summarise(lines, "FY2024")
    assert (better, worse) == (1, 1)
    assert text == "Against FY2024: 1 better, 1 worse, 1 steady, 1 not comparable."
    assert summarise([], "FY2024")[0].startswith("Nothing could be compared with FY2024")


def test_raven_wording_never_gives_advice():
    for measure in R.raven_measures:
        for prev, cur in (("0.1", "0.5"), ("0.5", "0.1"), ("2", "9"), ("9", "2")):
            assert not BANNED.search(_line(measure, prev, cur).text)


def test_measure_kinds_are_what_the_text_assumes():
    assert isinstance(R.raven_measures[0], RavenMeasure)
    assert {m.kind for m in R.raven_measures} == {"points", "multiple", "relative"}


# --- Night Watch --------------------------------------------------------------


def fired(name, hours_ago, label="Net debt / EBITDA above 2.5x"):
    return NightWatchFiredOut(holding_id=uuid.uuid5(uuid.NAMESPACE_DNS, name), ticker=name[:3], name=name,
                              label=label, metric="net_debt_to_ebitda", fired_at=NOW - timedelta(hours=hours_ago))


def watch(**kw):
    base = {
        "rules_v": R, "now": NOW, "watch_last_at": NOW - timedelta(hours=5), "watch_summary": "3 tripwire(s) on 2 holding(s)",
        "snapshots_last_at": NOW - timedelta(hours=4), "snapshots_summary": "rebuilt risk", "firing": [],
        "frame_days": [date(2026, 10, 3), date(2026, 10, 4)], "changes": [], "ravens_landed": [],
    }
    base.update(kw)
    return build_night_watch(**base)


def test_a_reporting_watch_with_nothing_firing_is_quiet():
    out = watch()
    assert out.status == "quiet" and out.watch_state == "ok" and out.watch_age_hours == 5
    assert [line.tone for line in out.lines][-1] == "calm"
    assert "Nothing fired" in out.lines[-1].text


def test_a_watch_that_never_ran_is_unknown_never_quiet():
    out = watch(watch_last_at=None, watch_summary=None)
    assert out.status == "unknown" and out.watch_state == "never"
    assert out.lines[0].tone == "warning" and "never walked the walls" in out.lines[0].text
    assert all("Nothing fired" not in line.text for line in out.lines)


def test_an_old_report_is_unknown_and_says_nothing_is_fresh():
    out = watch(watch_last_at=NOW - timedelta(hours=50))
    assert out.status == "unknown" and out.watch_state == "old"
    assert "nothing below is fresh" in out.lines[0].text


def test_the_overnight_edge_is_36_hours():
    out = watch(firing=[fired("Alpha", 35), fired("Beta", 37)])
    assert [f.name for f in out.fired_overnight] == ["Alpha"]
    assert out.status == "attention" and out.tripwires_firing == 2
    texts = [line.text for line in out.lines]
    assert "A tripwire fired on Alpha: Net debt / EBITDA above 2.5x." in texts
    assert "1 earlier tripwire(s) are still firing on 1 tower(s)." in texts


def test_many_fired_lines_are_capped_and_counted():
    out = watch(firing=[fired(f"Co{i}", 2) for i in range(8)])
    warnings = [line for line in out.lines if line.tone == "warning"]
    assert len(warnings) == 6                       # 5 shown + the "3 more" line
    assert any("3 more tripwires fired overnight" in line.text for line in warnings)


def test_changes_ravens_and_missing_frames_are_said():
    change = FrameChangeOut(day=date(2026, 10, 4), kind="weather_changed", text="The weather turned from calm to gathering.")
    out = watch(changes=[change], ravens_landed=["Alpha", "Beta"])
    texts = [line.text for line in out.lines]
    assert "The weather turned from calm to gathering." in texts
    assert "2 new report(s) landed overnight: Alpha, Beta." in texts
    assert out.status == "quiet" and out.ravens_landed == 2
    assert all("Nothing fired" not in t for t in texts)  # something changed, so no "nothing" line
    none = watch(frame_days=[])
    assert any("No fortress frame has been stored" in line.text for line in none.lines)
    one = watch(frame_days=[date(2026, 10, 4)])
    assert any("One fortress frame" in line.text for line in one.lines)


def test_lines_are_sorted_warnings_first_and_never_advise():
    out = watch(firing=[fired("Alpha", 2)], ravens_landed=["Beta"],
                changes=[FrameChangeOut(day=date(2026, 10, 4), kind="tower_added", text="Gamma joined the fortress (5.0% of the realm).")])
    tones = [line.tone for line in out.lines]
    assert tones == sorted(tones, key={"warning": 0, "note": 1, "calm": 2}.get)
    for line in out.lines:
        assert not BANNED.search(line.text), line.text
    assert out.headline == "1 tripwire(s) fired overnight."


def test_repeated_report_names_are_grouped_with_a_count():
    out = watch(ravens_landed=["Subsea 7 S.A"] * 80 + ["Orkla"] * 2 + ["Mowi"])
    texts = [line.text for line in out.lines]
    assert "83 new report(s) landed overnight: Subsea 7 S.A ×80, Orkla ×2, Mowi." in texts
