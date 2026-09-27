from __future__ import annotations

from decimal import Decimal

import pytest

from app.providers.world_bank import WorldBankUnavailableError, parse_world_bank


def test_parses_rows_oldest_first_and_skips_nulls():
    payload = [
        {"page": 1, "pages": 1, "total": 3},
        [
            {"date": "2024", "value": -8.51, "countryiso3code": "NOR"},
            {"date": "2023", "value": None},
            {"date": "2022", "value": 25.3},
        ],
    ]
    points = parse_world_bank(payload, "x")
    assert [(p.year, p.value) for p in points] == [(2022, Decimal("25.3")), (2024, Decimal("-8.51"))]


def test_no_data_is_empty_not_an_error():
    assert parse_world_bank([{"page": 0, "total": 0}, None]) == []


def test_error_message_raises():
    payload = [{"message": [{"id": "120", "key": "Invalid value", "value": "The provided parameter value is not valid"}]}]
    with pytest.raises(WorldBankUnavailableError, match="not valid"):
        parse_world_bank(payload, "x")


def test_unexpected_shape_raises():
    with pytest.raises(WorldBankUnavailableError):
        parse_world_bank({"oops": 1}, "x")
