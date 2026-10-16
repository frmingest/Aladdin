"""The Hearth composer (game mode E3, 2026-10-16). Pure: no database."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from app.domain.game_mapping.hearth_v1 import HEARTH_V1 as RULES
from app.domain.game_mapping.winter_v1 import WINTER_V1
from app.schemas.game import (
    ChronicleChangeOut,
    ChronicleFrameOut,
    ChronicleOut,
    ChronicleTowerOut,
    WinterOrderOut,
)
from app.services.game.hearth import compose_hearth
from app.services.game.winter_view import empty

D = Decimal
DAY = date(2026, 10, 15)
AT = datetime(2026, 10, 15, tzinfo=timezone.utc)
A, B, C = uuid4(), uuid4(), uuid4()


def _tower(hid, name):
    return ChronicleTowerOut(
        holding_id=hid, ticker=name[:3], name=name, structure="keep", size_class="medium", weight_pct=D("10"),
        wall="granite", moat="wide", land="full_price", thesis="intact",
    )


def _frame(day, weather, source="stored"):
    return ChronicleFrameOut(
        day=day, at=AT, source=source, total_value_nok=D(1000), weather=weather,
        towers=[_tower(A, "Alpha"), _tower(B, "Beta"), _tower(C, "Gamma")],
    )


def _chron(weather, changes=(), frames=None):
    return ChronicleOut(
        rules_version="v1", frames=frames or [_frame(DAY - timedelta(days=1), "calm"), _frame(DAY, weather)],
        changes=list(changes), stored_frames=2, positions_only_frames=0, first_stored_day=DAY - timedelta(days=1), notes=[],
    )


def _compose(chron):
    return compose_hearth(chron, [], WinterOrderOut(), empty(WINTER_V1, "no_history", "x"), RULES)


def test_calm_weather_keeps_the_door_shut():
    out = _compose(_chron("calm"))
    assert out.state == "shut" and "calm" in out.state_reason
    assert out.moved == out.held == out.changed == []


def test_no_stored_frame_keeps_the_door_shut_and_says_why():
    out = _compose(_chron("besieged", frames=[_frame(DAY, "besieged", source="positions_only")]))
    assert out.state == "shut" and "No nightly frame" in out.state_reason


def test_storm_sorts_changes_into_moved_held_changed():
    changes = [
        ChronicleChangeOut(day=DAY, kind="weather_changed", text="The weather turned from calm to besieged."),
        ChronicleChangeOut(day=DAY, kind="wall_changed", holding_id=A, holding_name="Alpha", text="Alpha walls weaker."),
        ChronicleChangeOut(day=DAY, kind="tower_resized", holding_id=B, holding_name="Beta", text="Beta 10% to 14%."),
    ]
    out = _compose(_chron("besieged", changes))
    assert out.state == "open" and out.weather == "besieged" and out.as_of == DAY
    assert [c.text for c in out.changed] == ["The weather turned from calm to besieged.", "Alpha walls weaker."]
    assert [m.name for m in out.moved] == ["Beta"]
    assert [h.name for h in out.held] == ["Gamma"]


def test_changes_older_than_the_look_back_are_left_out():
    old = ChronicleChangeOut(day=DAY - timedelta(days=31), kind="wall_changed", holding_id=A, holding_name="Alpha", text="old")
    out = _compose(_chron("gathering", [old]))
    assert out.changed == [] and {h.name for h in out.held} == {"Alpha", "Beta", "Gamma"}


def test_one_stored_frame_cannot_prove_anything_held():
    out = _compose(_chron("besieged", frames=[_frame(DAY, "besieged")]))
    assert out.state == "open" and out.held == [] and any("Only one nightly frame" in n for n in out.notes)
