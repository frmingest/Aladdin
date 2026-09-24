"""Numeric macro data API (2026-09-24) and its reach into analysis runs
and System status."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.domain.macro_series import get_macro_series
from app.main import app
from app.providers.factory import get_macro_data_provider_or_none
from app.providers.macro_data_providers import (
    MacroDataProvider,
    MacroDataUnavailableError,
    MacroPoint,
)


class _FakeMacro(MacroDataProvider):
    name = "fake"

    def __init__(self, fail: set[str] | None = None) -> None:
        self.fail = fail or set()

    def fetch(self, spec, start):
        if spec.key in self.fail:
            raise MacroDataUnavailableError("publisher down")
        today = datetime.now(timezone.utc).date()
        if spec.frequency == "monthly":
            points = []
            for back in range(14, 0, -1):
                idx = today.year * 12 + today.month - 1 - back
                value = 100 + (14 - back) * 0.25 if spec.transform == "yoy_pct" else 4.0
                points.append(MacroPoint(date(idx // 12, idx % 12 + 1, 1), Decimal(str(value))))
            return points
        return [MacroPoint(today - timedelta(days=1), Decimal("4.25"))]


def test_indicators_empty_then_refresh(client):
    body = client.get("/macro/indicators").json()
    assert body["series_version"] == "v1"
    assert body["fetching_enabled"] is False  # conftest switches fetching off
    assert len(body["indicators"]) == len(get_macro_series("v1"))
    assert all(i["value"] is None for i in body["indicators"])

    assert client.post("/macro/indicators/refresh").status_code == 503

    app.dependency_overrides[get_macro_data_provider_or_none] = lambda: _FakeMacro(fail={"us_hy_spread"})
    response = client.post("/macro/indicators/refresh")
    assert response.status_code == 200, response.text
    out = response.json()
    statuses = {r["key"]: r["status"] for r in out["results"]}
    assert statuses["us_hy_spread"] == "failed" and statuses["no_policy_rate"] == "updated"
    indicators = {i["key"]: i for i in out["indicators"]["indicators"]}
    assert indicators["no_policy_rate"]["value"] == "4.25"
    assert indicators["us_hy_spread"]["last_error"] == "publisher down"
    assert indicators["no_cpi_yoy"]["value"] is not None and indicators["no_cpi_yoy"]["history"]
    derived = {d["key"]: d for d in out["indicators"]["derived"]}
    assert derived["no_real_policy_rate"]["value"] is not None

    # Second refresh with only_stale: nothing re-fetched
    again = client.post("/macro/indicators/refresh?only_stale=true").json()
    assert {r["status"] for r in again["results"]} <= {"fresh", "failed"}


def test_system_status_reports_macro_rows(client):
    app.dependency_overrides[get_macro_data_provider_or_none] = lambda: _FakeMacro(fail={"us_10y"})
    client.post("/macro/indicators/refresh")
    body = client.get("/system/status").json()
    assert any(p["key"] == "macro_data" for p in body["providers"])
    fresh = {f["key"]: f for f in body["freshness"]}
    assert fresh["macro_data"]["status"] == "ok"
    assert "us_10y: publisher down" in fresh["macro_data_failures"]["detail"]
