"""Sprint 8: deterministic fund metrics (no DB needed for these parts)."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from app.models.fund import FundExposure, FundProfile, FundReturnPeriod
from app.services.funds.facts import normalize_company_name
from app.services.funds.metrics import (
    annualise_pct,
    compute_concentration,
    compute_track_record,
    fee_drag_pct,
)

D = Decimal


def test_fee_drag_compounds():
    # Heimdal Utbytte A (1.25 %) vs L&G Gold Mining (0.55 %), 20 years.
    assert fee_drag_pct(D("1.25"), 20) == D("22.24")
    assert fee_drag_pct(D("0.55"), 20) == D("10.44")
    assert fee_drag_pct(D("0"), 10) == D("0.00")


def test_annualise_matches_the_fund_s_own_figure():
    # Heimdal: +117.1 % since 5 Dec 2022 (3.74 years) — the fund reports 23.0 % a year.
    assert annualise_pct(D("117.1"), D("3.74")) == D("23.03")
    assert annualise_pct(D("-100"), D("2")) is None
    assert annualise_pct(D("10"), D("0")) is None


def _period(kind, label, fund, bench=None, years=None, annualised=False):
    return FundReturnPeriod(
        id=uuid.uuid4(), period_kind=kind, period_label=label, fund_return_pct=D(fund),
        benchmark_return_pct=D(bench) if bench is not None else None, years=D(years) if years else None,
        annualised=annualised, benchmark_name=None,
    )


def test_track_record_active_fund():
    profile = FundProfile(management_style="active")
    rows = [
        _period("rolling_12m", "12m to 2026-08-31", "19.7", "28.7"),
        _period("calendar_year", "2025", "26.3", "20.0"),
        _period("since_inception", "since 2022-12-05", "117.1", "74.7", years="3.74"),
    ]
    track = compute_track_record(profile, rows)
    assert track.gap_label == "excess return"
    assert track.one_year_periods_compared == 2
    assert track.one_year_periods_beaten == 1
    assert track.rows[0].difference_pp == D("-9.00")
    assert track.average_one_year_difference_pp == D("-1.35")
    assert track.longest_period_label == "since 2022-12-05"
    # 23.03 % vs 16.09 % a year
    assert track.longest_period_annualised_difference_pp == D("6.94")


def test_track_record_index_fund_is_tracking_difference():
    track = compute_track_record(
        FundProfile(management_style="index"), [_period("rolling_12m", "2026", "49.02", "49.57")]
    )
    assert track.gap_label == "tracking difference"
    assert track.rows[0].difference_pp == D("-0.55")


def _exposure(label, weight):
    return FundExposure(id=uuid.uuid4(), label=label, weight_pct=D(weight), dimension="holding")


def test_concentration_on_partial_list_is_flagged_incomplete():
    rows = [_exposure("Newmont", "15.5"), _exposure("Agnico", "11.0"), _exposure("AngloGold", "10.2")]
    c = compute_concentration(date(2026, 8, 31), rows, 44)
    assert c.coverage_pct == D("36.70")
    assert not c.complete
    assert c.top10_pct == D("36.70")
    assert c.largest.label == "Newmont"
    assert c.hhi == D("465")  # 240.25 + 121 + 104.04 — a lower bound
    assert c.effective_holdings is None  # no useful bound from a partial list
    assert c.stated_holdings_count == 44


def test_concentration_complete_list():
    rows = [_exposure(str(i), "10") for i in range(10)]
    c = compute_concentration(date(2026, 1, 1), rows, None)
    assert c.complete
    assert c.hhi == D("1000")
    assert c.effective_holdings == D("10.0")


def test_normalize_company_name():
    assert normalize_company_name("Equinor ASA") == normalize_company_name("EQUINOR")
    assert normalize_company_name("Agnico-Eagle Mines Ltd") == "agnico eagle mines"
    assert normalize_company_name("Sparebank 1 SMN") == "sparebank 1 smn"
