from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.dalio import gold_demand
from app.services.dalio.macro import net_liquidity_series, ratio_series

D = Decimal


def test_net_liquidity_converts_walcl_millions_to_billions():
    walcl = [(date(2026, 9, 16), D(6_600_000))]  # USD mn
    tga = [(date(2026, 9, 15), D(800))]  # USD bn
    rrp = [(date(2026, 9, 16), D(50))]  # USD bn
    assert net_liquidity_series(walcl, tga, rrp) == [(date(2026, 9, 16), D(5750))]


def test_net_liquidity_skips_dates_without_all_inputs():
    walcl = [(date(2026, 1, 7), D(1000)), (date(2026, 1, 14), D(1000))]
    tga = [(date(2026, 1, 10), D(1))]
    rrp = [(date(2026, 1, 1), D(0))]
    assert [d for d, _v in net_liquidity_series(walcl, tga, rrp)] == [date(2026, 1, 14)]


def test_interest_to_receipts_ratio_same_quarter_only():
    interest = [(date(2026, 1, 1), D(1000)), (date(2026, 4, 1), D(1100))]
    receipts = [(date(2026, 1, 1), D(5000))]
    assert ratio_series(interest, receipts) == [(date(2026, 1, 1), D(20))]


def test_gold_dataset_reports_how_stale_it_is():
    summary = gold_demand.summarize(date(2026, 9, 27))
    assert summary.as_of == "Q1 2025"
    assert summary.quarters_behind == 5  # Q2 2026 is the newest WGC would have published
    assert "STALE" in gold_demand.describe(summary)


def test_latest_publishable_quarter_respects_publication_lag():
    assert gold_demand.latest_publishable_quarter(date(2026, 8, 1)) == (2026, 1)
    assert gold_demand.latest_publishable_quarter(date(2026, 8, 20)) == (2026, 2)
    assert gold_demand.latest_publishable_quarter(date(2026, 1, 10)) == (2025, 3)
