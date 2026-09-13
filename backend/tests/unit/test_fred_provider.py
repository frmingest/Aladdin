"""
Unit tests for FredMacroDataProvider (§26 Phase 4). Monkeypatches
`requests.get` with canned responses shaped like FRED's documented
`fred/series/observations` JSON — no real network call (this sandbox has no
verified live path to FRED anyway, see docs/decisions/0007).
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

import app.providers.fred_provider as fred_module
from app.domain.macro_series import FredSeriesDefinition, MacroSeriesRegistry
from app.providers.base import MacroDataUnavailableError


class _FakeResponse:
    def __init__(self, payload, status_ok=True):
        self._payload = payload
        self._status_ok = status_ok

    def raise_for_status(self):
        if not self._status_ok:
            import requests

            raise requests.HTTPError("boom")

    def json(self):
        return self._payload


@pytest.fixture()
def registry():
    return MacroSeriesRegistry(
        version="test",
        series={
            "us_policy_rate": FredSeriesDefinition(
                series_key="us_policy_rate",
                provider_series_id="DFF",
                fred_units="lin",
                description="test",
                unit="percent",
                region="US",
            )
        },
    )


def test_missing_api_key_raises_immediately(registry):
    with pytest.raises(MacroDataUnavailableError, match="FRED_API_KEY"):
        fred_module.FredMacroDataProvider(api_key="", registry=registry)


def test_get_latest_maps_first_observation(monkeypatch, registry):
    provider = fred_module.FredMacroDataProvider(api_key="k", registry=registry)
    monkeypatch.setattr(
        fred_module.requests,
        "get",
        lambda *a, **k: _FakeResponse({"observations": [{"date": "2026-09-01", "value": "5.33"}]}),
    )

    point = provider.get_latest("us_policy_rate")

    assert point.series_key == "us_policy_rate"
    assert point.value == Decimal("5.33")
    assert point.provider == "fred"
    assert point.region == "US"
    assert point.observed_at == datetime(2026, 9, 1, tzinfo=timezone.utc)


def test_missing_value_sentinel_is_dropped_not_zeroed(monkeypatch, registry):
    provider = fred_module.FredMacroDataProvider(api_key="k", registry=registry)
    monkeypatch.setattr(
        fred_module.requests,
        "get",
        lambda *a, **k: _FakeResponse(
            {"observations": [{"date": "2026-09-01", "value": "."}, {"date": "2026-09-02", "value": "5.5"}]}
        ),
    )

    points = provider.get_series(
        "us_policy_rate", datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 9, 2, tzinfo=timezone.utc)
    )

    assert len(points) == 1
    assert points[0].value == Decimal("5.5")


def test_no_observations_raises_unavailable(monkeypatch, registry):
    provider = fred_module.FredMacroDataProvider(api_key="k", registry=registry)
    monkeypatch.setattr(fred_module.requests, "get", lambda *a, **k: _FakeResponse({"observations": []}))

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("us_policy_rate")


def test_unregistered_series_key_raises_before_any_request(monkeypatch, registry):
    provider = fred_module.FredMacroDataProvider(api_key="k", registry=registry)

    def _boom(*a, **k):
        raise AssertionError("should not call FRED for an unregistered series")

    monkeypatch.setattr(fred_module.requests, "get", _boom)

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("not_registered")


def test_request_exception_wraps_into_macro_data_unavailable(monkeypatch, registry):
    provider = fred_module.FredMacroDataProvider(api_key="k", registry=registry)

    def _boom(*a, **k):
        import requests

        raise requests.ConnectionError("no network")

    monkeypatch.setattr(fred_module.requests, "get", _boom)

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("us_policy_rate")


def test_http_error_status_wraps_into_macro_data_unavailable(monkeypatch, registry):
    provider = fred_module.FredMacroDataProvider(api_key="k", registry=registry)
    monkeypatch.setattr(
        fred_module.requests, "get", lambda *a, **k: _FakeResponse({}, status_ok=False)
    )

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("us_policy_rate")
