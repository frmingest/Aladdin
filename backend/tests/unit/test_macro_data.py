"""Numeric macro data (2026-09-24): provider parsers, refresh, indicator
arithmetic, evidence items, scheduler switches."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.domain.macro_series import get_derived_indicators, get_macro_series
from app.models import Base
from app.models.macro import MacroObservation, MacroSeriesStatus
from app.providers.macro_data_providers import (
    CompositeMacroDataProvider,
    MacroDataProvider,
    MacroDataUnavailableError,
    MacroPoint,
    parse_fred,
    parse_norges_bank,
    parse_ssb,
)
from app.services.macro.evidence import (
    add_macro_indicator_evidence,
    describe,
    ensure_macro_fresh,
)
from app.services.macro.indicators import (
    build_snapshot,
    get_macro_indicators,
    yoy_series,
)
from app.services.macro.refresh import refresh_macro_data, refresh_series, stored_points
from app.services.macro.scheduler import MacroRefreshScheduler

SPECS = {s.key: s for s in get_macro_series("v1")}
NOW = datetime(2026, 9, 24, 6, 0, tzinfo=timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


# --- catalogue -------------------------------------------------------------------


def test_catalogue_v1_has_the_agreed_core_set():
    keys = set(SPECS)
    assert keys == {
        "no_policy_rate", "no_nowa", "no_3m_bill", "no_10y", "usd_nok", "eur_nok", "no_cpi_yoy",
        "us_fed_funds_upper", "us_10y", "us_10y_2y", "us_cpi_yoy", "us_unemployment", "us_hy_spread",
    }
    for derived in get_derived_indicators("v1"):
        assert derived.left in keys and derived.right in keys
    assert SPECS["no_policy_rate"].source_url.startswith("https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R")
    assert SPECS["us_10y"].source_url == "https://fred.stlouisfed.org/series/DGS10"


def test_unknown_series_version_raises():
    with pytest.raises(ValueError):
        get_macro_series("v99")


# --- parsers (shapes captured from the live APIs 2026-09-24) ---------------------

NB_POLICY_RATE = {
    "data": {
        "dataSets": [{"series": {"0:0:0:0": {"attributes": [0, 0], "observations": {"0": ["4.25"], "1": ["4.25"]}}}}],
        "structure": {
            "dimensions": {
                "observation": [
                    {"id": "TIME_PERIOD", "values": [{"id": "2026-09-21"}, {"id": "2026-09-22"}]}
                ]
            },
            "attributes": {
                "series": [
                    {"id": "DECIMALS", "values": [{"id": "2"}]},
                    {"id": "COLLECTION", "values": [{"id": "E"}]},
                ]
            },
        },
    }
}


def test_parse_norges_bank_policy_rate():
    points = parse_norges_bank(NB_POLICY_RATE)
    assert points == [
        MacroPoint(date(2026, 9, 21), Decimal("4.25")),
        MacroPoint(date(2026, 9, 22), Decimal("4.25")),
    ]


def test_parse_norges_bank_applies_unit_mult():
    payload = {
        "data": {
            "dataSets": [{"series": {"0:0:0:0": {"attributes": [0, 1], "observations": {"0": ["7.10"]}}}}],
            "structure": {
                "dimensions": {"observation": [{"values": [{"id": "2026-09-15"}]}]},
                "attributes": {
                    "series": [
                        {"id": "DECIMALS", "values": [{"id": "4"}]},
                        {"id": "UNIT_MULT", "values": [{"id": "0"}, {"id": "2"}]},
                    ]
                },
            },
        }
    }
    assert parse_norges_bank(payload)[0].value == Decimal("0.071")


def test_parse_norges_bank_rejects_unexpected_shape():
    with pytest.raises(MacroDataUnavailableError):
        parse_norges_bank({"data": {}})
    two_series = {"data": {**NB_POLICY_RATE["data"], "dataSets": [{"series": {"a": {}, "b": {}}}]}}
    with pytest.raises(MacroDataUnavailableError):
        parse_norges_bank(two_series)


def test_parse_fred_skips_missing_sentinel():
    payload = {"observations": [
        {"date": "2026-09-19", "value": "4.10"},
        {"date": "2026-09-22", "value": "."},
        {"date": "2026-09-23", "value": "4.13"},
    ]}
    assert [(p.observed_on.isoformat(), str(p.value)) for p in parse_fred(payload)] == [
        ("2026-09-19", "4.10"), ("2026-09-23", "4.13"),
    ]
    with pytest.raises(MacroDataUnavailableError):
        parse_fred({"error_message": "Bad Request"})


def test_parse_ssb_monthly_index():
    payload = {
        "id": ["ContentsCode", "Tid"],
        "size": [1, 3],
        "dimension": {"Tid": {"category": {"index": {"2026M06": 0, "2026M07": 1, "2026M08": 2}}}},
        "value": [102.8, 103.8, None],
    }
    points = parse_ssb(payload)
    assert [(p.observed_on, p.value) for p in points] == [
        (date(2026, 6, 1), Decimal("102.8")), (date(2026, 7, 1), Decimal("103.8")),
    ]
    with pytest.raises(MacroDataUnavailableError):
        parse_ssb({**payload, "size": [2, 3]})


# --- refresh -----------------------------------------------------------------------


class FakeProvider(MacroDataProvider):
    name = "fake"

    def __init__(self, data: dict[str, list[MacroPoint]] | None = None, fail: set[str] | None = None) -> None:
        self.data = data or {}
        self.fail = fail or set()
        self.calls: list[tuple[str, date]] = []

    def fetch(self, spec, start):
        self.calls.append((spec.key, start))
        if spec.key in self.fail:
            raise MacroDataUnavailableError(f"{spec.key} down")
        return [p for p in self.data.get(spec.key, []) if p.observed_on >= start]


def _daily(values: list[str], end: date) -> list[MacroPoint]:
    return [MacroPoint(end - timedelta(days=len(values) - 1 - i), Decimal(v)) for i, v in enumerate(values)]


def test_refresh_inserts_then_skips_unchanged_and_stores_revisions():
    db = _session()
    spec = SPECS["no_policy_rate"]
    provider = FakeProvider({spec.key: _daily(["4.50", "4.25"], date(2026, 9, 22))})

    first = refresh_series(db, provider, spec, now=NOW)
    assert (first.status, first.inserted, first.latest_observed) == ("updated", 2, date(2026, 9, 22))
    row = db.scalars(select(MacroObservation)).first()
    assert row.source_series_id == "IR/B.KPRA.SD.R" and row.unit == "percent" and row.region == "NO"
    # First fetch reaches back macro_history_years (3) from the 1st of the month.
    assert provider.calls[0][1] == date(2023, 9, 1)

    second = refresh_series(db, provider, spec, now=NOW + timedelta(hours=1))
    assert (second.status, second.inserted) == ("unchanged", 0)
    # Incremental fetch re-reads a 70-day revision window.
    assert provider.calls[1][1] == date(2026, 9, 22) - timedelta(days=70)

    provider.data[spec.key] = _daily(["4.50", "4.00"], date(2026, 9, 22))  # a revision
    third = refresh_series(db, provider, spec, now=NOW + timedelta(hours=2))
    assert third.inserted == 1
    assert stored_points(db, spec.key)[-1] == (date(2026, 9, 22), Decimal("4.00"))
    assert db.get(MacroSeriesStatus, spec.key).last_error is None


def test_yoy_series_fetches_an_extra_year_first_time():
    db = _session()
    provider = FakeProvider()
    refresh_series(db, provider, SPECS["no_cpi_yoy"], now=NOW)
    assert provider.calls[0][1] == date(2022, 9, 1)


def test_one_failing_publisher_does_not_stop_the_others():
    db = _session()
    provider = FakeProvider(
        {k: _daily(["1.0"], date(2026, 9, 22)) for k in SPECS}, fail={"us_10y"}
    )
    results = {r.key: r for r in refresh_macro_data(db, provider, now=NOW)}
    assert results["us_10y"].status == "failed" and "down" in results["us_10y"].error
    assert results["no_10y"].status == "updated"
    status = db.get(MacroSeriesStatus, "us_10y")
    assert status.last_success_at is None and status.last_error == "us_10y down"


def test_empty_response_counts_as_failure():
    db = _session()
    result = refresh_series(db, FakeProvider(), SPECS["usd_nok"], now=NOW)
    assert result.status == "failed"
    assert "no observations" in db.get(MacroSeriesStatus, "usd_nok").last_error


def test_only_stale_skips_fresh_and_recently_failed_series():
    db = _session()
    data = {k: _daily(["1.0"], date(2026, 9, 22)) for k in SPECS}
    provider = FakeProvider(data, fail={"us_hy_spread"})
    refresh_macro_data(db, provider, now=NOW)
    provider.calls.clear()

    results = refresh_macro_data(db, provider, only_stale=True, now=NOW + timedelta(minutes=30))
    assert provider.calls == []  # all fresh, and the failure is under an hour old
    assert {r.status for r in results} == {"fresh", "failed"}

    refresh_macro_data(db, provider, only_stale=True, now=NOW + timedelta(hours=2))
    assert [key for key, _ in provider.calls] == ["us_hy_spread"]

    provider.calls.clear()
    refresh_macro_data(db, provider, only_stale=True, now=NOW + timedelta(hours=21))
    assert len(provider.calls) == len(SPECS)  # past MACRO_STALE_AFTER_HOURS (20)


def test_composite_routes_by_source():
    class Named(FakeProvider):
        def __init__(self, name):
            super().__init__()
            self.name = name

    nb, fred = Named("norges_bank"), Named("fred")
    composite = CompositeMacroDataProvider({"norges_bank": nb, "fred": fred})
    composite.fetch(SPECS["no_10y"], date(2026, 1, 1))
    composite.fetch(SPECS["us_10y"], date(2026, 1, 1))
    assert [c[0] for c in nb.calls] == ["no_10y"] and [c[0] for c in fred.calls] == ["us_10y"]
    assert composite.provider_name_for(SPECS["us_10y"]) == "fred"
    with pytest.raises(MacroDataUnavailableError):
        composite.fetch(SPECS["no_cpi_yoy"], date(2026, 1, 1))  # no ssb provider configured


def test_ensure_macro_fresh_never_raises():
    class Exploding(MacroDataProvider):
        name = "boom"

        def fetch(self, spec, start):
            raise RuntimeError("unexpected")

    db = _session()
    ensure_macro_fresh(db, Exploding())  # swallowed and logged
    ensure_macro_fresh(db, None)


# --- indicator arithmetic ---------------------------------------------------------------


def _monthly(values: list[str], last: date) -> list[tuple[date, Decimal]]:
    out = []
    for i, v in enumerate(values):
        back = len(values) - 1 - i
        idx = last.year * 12 + last.month - 1 - back
        out.append((date(idx // 12, idx % 12 + 1, 1), Decimal(v)))
    return out


def test_yoy_from_index_is_exact():
    # SSB 14710: Aug 2025 = 100.2, Aug 2026 = 103.5 -> 3.293...%
    points = _monthly(["100.2"] + ["101"] * 11 + ["103.5"], date(2026, 8, 1))
    yoy = yoy_series(points)
    assert len(yoy) == 1
    assert yoy[0][0] == date(2026, 8, 1)
    assert yoy[0][1].quantize(Decimal("0.0001")) == Decimal("3.2934")


def test_snapshot_changes_in_pp_and_pct_and_staleness():
    rate = build_snapshot(
        SPECS["no_policy_rate"],
        [(date(2025, 9, 22), Decimal("4.25")), (date(2026, 6, 22), Decimal("4.50")), (date(2026, 9, 22), Decimal("4.00"))],
        today=date(2026, 9, 24),
    )
    assert rate.value == Decimal("4.00")
    assert rate.change_3m == Decimal("-0.50") and rate.value_3m_ago == Decimal("4.50")
    assert rate.change_12m == Decimal("-0.25")
    assert not rate.stale and rate.age_days == 2

    fx = build_snapshot(
        SPECS["usd_nok"], [(date(2025, 9, 1), Decimal("10.0000")), (date(2026, 9, 1), Decimal("9.3466"))],
        today=date(2026, 9, 24),
    )
    assert fx.change_12m == Decimal("-6.53")  # percent, not points
    assert fx.stale  # 23 days old > 7

    cpi = build_snapshot(SPECS["us_cpi_yoy"], [(date(2026, 8, 1), Decimal("2.94"))], today=date(2026, 9, 24))
    assert cpi.value == Decimal("2.9") and not cpi.stale  # monthly: 75-day window


def test_indicators_from_db_with_derived_real_rate():
    db = _session()
    for d, v in [(date(2026, 9, 22), "4.25")]:
        db.add(MacroObservation(series_key="no_policy_rate", provider="norges_bank", region="NO", value=Decimal(v),
                                unit="percent", observed_at=datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
                                retrieved_at=NOW))
    for d, v in _monthly(["100.2"] + ["101"] * 11 + ["103.5"], date(2026, 8, 1)):
        db.add(MacroObservation(series_key="no_cpi_yoy", provider="ssb", region="NO", value=v, unit="index",
                                observed_at=datetime(d.year, d.month, 1, tzinfo=timezone.utc), retrieved_at=NOW))
    db.commit()

    result = get_macro_indicators(db, today=date(2026, 9, 24))
    by_key = {i.key: i for i in result.indicators}
    assert by_key["no_cpi_yoy"].value == Decimal("3.3")
    assert by_key["us_10y"].value is None
    real = {d.key: d for d in result.derived}["no_real_policy_rate"]
    assert real.value == Decimal("0.95")  # 4.25 - 3.3
    assert real.observed_on == date(2026, 8, 1)
    assert "minus Norway CPI inflation" in real.formula
    assert {d.key: d for d in result.derived}["no_us_10y_spread"].value is None


# --- evidence ---------------------------------------------------------------------------


def _collector():
    items = []

    def add(category, label, content, citation=None):
        items.append((category, label, content, citation))

    return items, add


def test_evidence_when_nothing_captured():
    db = _session()
    items, add = _collector()
    reasons: list[str] = []
    add_macro_indicator_evidence(db, add, reasons)
    assert len(items) == 1 and items[0][0] == "macro_indicator"
    assert reasons == ["macro indicators: none captured yet (Macro page -> Refresh data)"]


def test_evidence_items_cite_the_publisher_series():
    db = _session()
    provider = FakeProvider({"no_policy_rate": _daily(["4.25"], date(2026, 9, 22))})
    refresh_series(db, provider, SPECS["no_policy_rate"], now=NOW)
    items, add = _collector()
    reasons: list[str] = []
    add_macro_indicator_evidence(db, add, reasons)
    assert items[0][1] == "Norges Bank policy rate (NO)"
    assert "4.25%" in items[0][2]
    assert items[0][3].startswith("Norges Bank — series IR/B.KPRA.SD.R — https://data.norges-bank.no/")
    assert any(r.startswith("macro indicators missing:") for r in reasons)


def test_describe_flags_stale_values():
    snap = build_snapshot(SPECS["no_10y"], [(date(2026, 8, 1), Decimal("4.4"))], today=date(2026, 9, 24))
    assert "STALE: latest observation is 54 days old." in describe(snap)


# --- scheduler switches ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "enabled"),
    [
        ({}, True),
        ({"macro_refresh_interval_hours": 0}, False),
        ({"macro_data_provider": "none"}, False),
        ({"database_url": None}, False),
    ],
)
def test_scheduler_enabled_switches(overrides, enabled):
    settings = Settings(_env_file=None, **{"database_url": "postgresql://x/y", **overrides})
    assert MacroRefreshScheduler(settings).enabled is enabled
