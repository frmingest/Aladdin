"""
Unit tests for NorgesBankMacroDataProvider (§26 Phase 4). Exercises the
provider's mechanics (HTTP call, SDMX-CSV parsing, delimiter fallback, error
handling) against canned text shaped like Norges Bank's documented CSV
export — see that module's docstring for why the exact dataset/key remain an
unverified, explicitly flagged assumption.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

import app.providers.norges_bank_provider as nb_module
from app.domain.macro_series import NorgesBankSeriesDefinition
from app.providers.base import MacroDataUnavailableError


class _FakeResponse:
    def __init__(self, text, status_ok=True):
        self.text = text
        self._status_ok = status_ok

    def raise_for_status(self):
        if not self._status_ok:
            import requests

            raise requests.HTTPError("boom")


@pytest.fixture()
def registry():
    from app.domain.macro_series import MacroSeriesRegistry

    return MacroSeriesRegistry(
        version="test",
        series={
            "no_policy_rate": NorgesBankSeriesDefinition(
                series_key="no_policy_rate",
                dataset="IR",
                key="B.KPRA.SD.",
                description="test",
                unit="percent",
                region="NO",
            )
        },
    )


def test_get_latest_parses_semicolon_sdmx_csv(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)
    csv_text = "TIME_PERIOD;OBS_VALUE\n2026-09-01;4.5\n"
    monkeypatch.setattr(nb_module.requests, "get", lambda *a, **k: _FakeResponse(csv_text))

    point = provider.get_latest("no_policy_rate")

    assert point.series_key == "no_policy_rate"
    assert point.value == Decimal("4.5")
    assert point.provider == "norges_bank"
    assert point.region == "NO"
    assert point.observed_at == datetime(2026, 9, 1, tzinfo=timezone.utc)


def test_falls_back_to_comma_delimiter_when_semicolon_does_not_split(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)
    csv_text = "TIME_PERIOD,OBS_VALUE\n2026-08-01,4.25\n2026-09-01,4.5\n"
    monkeypatch.setattr(nb_module.requests, "get", lambda *a, **k: _FakeResponse(csv_text))

    points = provider.get_series(
        "no_policy_rate", datetime(2026, 8, 1, tzinfo=timezone.utc), datetime(2026, 9, 1, tzinfo=timezone.utc)
    )

    assert [p.value for p in points] == [Decimal("4.25"), Decimal("4.5")]


def test_get_latest_returns_last_point_of_multiple(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)
    csv_text = "TIME_PERIOD;OBS_VALUE\n2026-08-01;4.25\n2026-09-01;4.5\n"
    monkeypatch.setattr(nb_module.requests, "get", lambda *a, **k: _FakeResponse(csv_text))

    point = provider.get_latest("no_policy_rate")

    assert point.value == Decimal("4.5")


def test_unrecognized_csv_shape_raises_unavailable(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)
    csv_text = "SOME_OTHER_COLUMN;ANOTHER\nfoo;bar\n"
    monkeypatch.setattr(nb_module.requests, "get", lambda *a, **k: _FakeResponse(csv_text))

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("no_policy_rate")


def test_empty_observation_rows_are_dropped(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)
    csv_text = "TIME_PERIOD;OBS_VALUE\n;\n2026-09-01;4.5\n"
    monkeypatch.setattr(nb_module.requests, "get", lambda *a, **k: _FakeResponse(csv_text))

    point = provider.get_latest("no_policy_rate")

    assert point.value == Decimal("4.5")


def test_no_usable_observations_raises_unavailable(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)
    csv_text = "TIME_PERIOD;OBS_VALUE\n"
    monkeypatch.setattr(nb_module.requests, "get", lambda *a, **k: _FakeResponse(csv_text))

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("no_policy_rate")


def test_unregistered_series_key_raises_before_any_request(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)

    def _boom(*a, **k):
        raise AssertionError("should not call Norges Bank for an unregistered series")

    monkeypatch.setattr(nb_module.requests, "get", _boom)

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("not_registered")


def test_request_exception_wraps_into_macro_data_unavailable(monkeypatch, registry):
    provider = nb_module.NorgesBankMacroDataProvider(registry=registry)

    def _boom(*a, **k):
        import requests

        raise requests.ConnectionError("no network")

    monkeypatch.setattr(nb_module.requests, "get", _boom)

    with pytest.raises(MacroDataUnavailableError):
        provider.get_latest("no_policy_rate")
