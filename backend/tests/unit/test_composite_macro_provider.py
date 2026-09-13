"""
Unit tests for CompositeMacroDataProvider — routes a series_key to whichever
child provider the registry says owns it (§26 Phase 4). Uses simple fakes
for both children so this only tests routing, not vendor mechanics (those are
covered by test_fred_provider.py / test_norges_bank_provider.py).
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.domain.macro_series import FredSeriesDefinition, MacroSeriesRegistry, NorgesBankSeriesDefinition
from app.providers.base import MacroDataProvider, MacroSeriesPoint
from app.providers.composite_macro_provider import CompositeMacroDataProvider


class _FakeProvider(MacroDataProvider):
    def __init__(self, name):
        self.name = name
        self.calls = []

    def get_latest(self, series_key):
        self.calls.append(("get_latest", series_key))
        return MacroSeriesPoint(
            series_key=series_key,
            value=Decimal("1"),
            unit="percent",
            observed_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
            provider=self.name,
            region="US",
        )

    def get_series(self, series_key, start, end):
        self.calls.append(("get_series", series_key, start, end))
        return [
            MacroSeriesPoint(
                series_key=series_key,
                value=Decimal("1"),
                unit="percent",
                observed_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
                provider=self.name,
                region="US",
            )
        ]


@pytest.fixture()
def registry():
    return MacroSeriesRegistry(
        version="test",
        series={
            "us_series": FredSeriesDefinition(
                series_key="us_series",
                provider_series_id="X",
                fred_units="lin",
                description="",
                unit="percent",
                region="US",
            ),
            "no_series": NorgesBankSeriesDefinition(
                series_key="no_series", dataset="D", key="K", description="", unit="percent", region="NO"
            ),
        },
    )


def test_routes_fred_series_to_fred_provider(registry):
    fred = _FakeProvider("fred")
    norges = _FakeProvider("norges_bank")
    composite = CompositeMacroDataProvider(registry=registry, fred=fred, norges_bank=norges)

    point = composite.get_latest("us_series")

    assert point.provider == "fred"
    assert fred.calls == [("get_latest", "us_series")]
    assert norges.calls == []


def test_routes_norges_bank_series_to_norges_bank_provider(registry):
    fred = _FakeProvider("fred")
    norges = _FakeProvider("norges_bank")
    composite = CompositeMacroDataProvider(registry=registry, fred=fred, norges_bank=norges)

    point = composite.get_latest("no_series")

    assert point.provider == "norges_bank"
    assert norges.calls == [("get_latest", "no_series")]
    assert fred.calls == []


def test_get_series_also_routes_correctly(registry):
    fred = _FakeProvider("fred")
    norges = _FakeProvider("norges_bank")
    composite = CompositeMacroDataProvider(registry=registry, fred=fred, norges_bank=norges)
    start, end = datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 9, 1, tzinfo=timezone.utc)

    composite.get_series("no_series", start, end)

    assert norges.calls == [("get_series", "no_series", start, end)]
