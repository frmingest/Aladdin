"""E1 Blindfold Years: eligibility, the masked puzzle and the reveal (2026-10-15).

Pure functions only. The puzzle must never carry the answer, the name, the
calendar years or the currency; any missing or flagged year takes the puzzle
out of the pool (unknown stays fog)."""
from __future__ import annotations

import json
import pathlib
import uuid
from dataclasses import asdict
from decimal import Decimal

import pytest

from app.domain.game_mapping.blindfold_v1 import BLINDFOLD_V1 as R
from app.services.game.blindfold import (
    HoldingInput,
    build_pool,
    build_puzzle,
    build_reveal,
    eligible_years,
    parse_puzzle_id,
    stake_domain,
    width_class,
)
from app.services.holding_facts import PeriodFacts

D = Decimal
ANSWER = D("987654321")  # distinctive: must never appear in the puzzle


def period(year, *, net_income="100", da="40", capex="30", currency="NOK", ebit="10000000000", **extra):
    facts = {
        "revenue": D("1000") + year,
        "net_income": D(net_income),
        "depreciation_and_amortization": D(da),
        "capital_expenditures": D(capex),
        "operating_income": D(ebit),
        **{k: D(v) for k, v in extra.items()},
    }
    return PeriodFacts(f"FY{year}", year, facts, {m: currency for m in facts})


def holding(years, *, sector="Industrials", name="Secret Co", ticker="SECR.OL", overrides=None):
    overrides = overrides or {}
    periods = {f"FY{y}": overrides.get(y, period(y)) for y in years}
    return HoldingInput(uuid.uuid4(), name, ticker, sector, periods)


YEARS = range(2018, 2025)  # seven years: puzzles for t = 2021, 2022, 2023


def test_seven_complete_years_give_three_puzzles():
    assert eligible_years(holding(YEARS), R) == [2021, 2022, 2023]


def test_a_missing_year_removes_every_puzzle_that_touches_it():
    assert eligible_years(holding([y for y in YEARS if y != 2021]), R) == []


def test_missing_da_is_fog_so_the_puzzle_is_not_offered():
    bad = PeriodFacts("FY2020", 2020, {"net_income": D(100), "capital_expenditures": D(30)}, {"net_income": "NOK"})
    h = holding(YEARS, overrides={2020: bad})
    # 2020 sits inside the windows of t=2021 (2018..2022), 2022 (2019..2023) and 2023 (2020..2024)
    assert eligible_years(h, R) == []


def test_a_quality_flagged_year_is_not_offered():
    # net income above operating profit: the data-quality check raises its non-operating-gains flag
    flagged = period(2024, net_income="400", ebit="160")
    assert eligible_years(holding(YEARS, overrides={2024: flagged}), R) == [2021, 2022]


def test_banks_and_insurers_never_appear():
    assert eligible_years(holding(YEARS, sector="Financials"), R) == []


def test_a_currency_change_inside_the_window_is_not_offered():
    h = holding(YEARS, overrides={2022: period(2022, currency="USD")})
    assert eligible_years(h, R) == []


def test_pool_order_is_fixed_and_covers_every_puzzle():
    hs = [holding(YEARS), holding(YEARS, name="Other", ticker="OTH.OL")]
    first, second = build_pool(hs, R), build_pool(list(reversed(hs)), R)
    assert first == second and len(first) == 6


def test_puzzle_shows_four_relative_years_and_hides_the_answer_name_and_currency():
    over = {2022: period(2022, net_income=str(ANSWER))}  # year t+1 for t=2021
    h = holding(YEARS, overrides=over)
    puzzle = build_puzzle(h, 2021, R)
    assert puzzle is not None
    assert [y.label for y in puzzle.years] == ["Year -3", "Year -2", "Year -1", "Year 0"]
    # the id itself carries holding and year (it is a lookup key the page never shows)
    blob = json.dumps({k: v for k, v in asdict(puzzle).items() if k != "puzzle_id"}, default=str)
    for secret in (str(ANSWER), "Secret Co", "SECR", "NOK", "2018", "2021", "2022", "FY20"):
        assert secret not in blob


def test_stake_domain_depends_only_on_the_years_shown():
    base = build_puzzle(holding(YEARS), 2021, R)
    changed = build_puzzle(holding(YEARS, overrides={2022: period(2022, net_income="99999")}), 2021, R)
    assert base is not None and changed is not None
    assert base.stake_domain == changed.stake_domain


def test_stake_domain_is_wider_than_the_shown_series_and_never_flat():
    dom = stake_domain([D(50), D(50)], R)
    assert dom.min < 50 < dom.max
    zero = stake_domain([D(0), D(0)], R)
    assert zero.min < zero.max


def test_a_ratio_that_cannot_be_computed_is_fog_not_a_number():
    puzzle = build_puzzle(holding(YEARS), 2021, R)
    assert puzzle is not None
    net_debt = puzzle.years[-1].cells["net_debt"]
    assert net_debt.value is None and net_debt.fog


def _reveal(low, high, actual_net_income="100"):
    h = holding(YEARS, overrides={2022: period(2022, net_income=actual_net_income)})
    return build_reveal(h, 2021, D(low), D(high), R)


def test_reveal_counts_a_bound_as_inside():
    # owner earnings = net income + D&A - capex = ni + 10
    assert _reveal("110", "200").inside and _reveal("0", "110").inside
    assert _reveal("111", "200").position == "below"
    assert _reveal("0", "109").position == "above"


def test_reveal_rejects_a_reversed_range():
    with pytest.raises(ValueError):
        _reveal("200", "100")


def test_reveal_of_a_puzzle_that_is_not_offered_is_none():
    assert build_reveal(holding(YEARS), 2015, D(0), D(1), R) is None


def test_width_class_buckets_and_zero_last_year():
    assert width_class(D(90), D(100), D(100), R) == "narrow"      # 10%
    assert width_class(D(70), D(130), D(100), R) == "medium"      # 60% is not above 60
    assert width_class(D(0), D(200), D(100), R) == "wide"
    assert width_class(D(0), D(1), D(0), R) is None


def test_puzzle_id_round_trip_and_garbage():
    hid = uuid.uuid4()
    assert parse_puzzle_id(f"{hid}:2021") == (hid, 2021)
    with pytest.raises(ValueError):
        parse_puzzle_id("nonsense")


def test_blindfold_never_feeds_the_analysis_or_the_journal():
    """Architecture rule 4: nothing here reaches the blind pass. The feature
    is read-only and imported by nothing but the game API."""
    app = pathlib.Path(__file__).resolve().parents[2] / "app"
    importers = [
        p.relative_to(app).as_posix()
        for p in app.rglob("*.py")
        if "blindfold" in p.read_text(encoding="utf-8").lower() and "blindfold" not in p.name
    ]
    assert sorted(importers) == ["api/game.py", "config/settings.py", "schemas/game.py"]
