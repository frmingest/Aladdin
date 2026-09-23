"""Unit tests for app.services.watchlist.price_status (feature F7)."""
from decimal import Decimal as D

from app.services.watchlist import (
    ABOVE,
    BUY_ZONE,
    CURRENCY_MISMATCH,
    NEAR,
    NO_PRICE,
    NO_TARGET,
    price_status,
)


def test_no_target():
    assert price_status(D(100), "NOK", None, None) == (NO_TARGET, None)


def test_no_price():
    assert price_status(None, None, D(100), "NOK") == (NO_PRICE, None)


def test_buy_zone_at_or_below_target():
    assert price_status(D(90), "NOK", D(100), "NOK") == (BUY_ZONE, D(-10))
    assert price_status(D(100), "NOK", D(100), "NOK")[0] == BUY_ZONE


def test_near_within_ten_percent():
    status, distance = price_status(D(108), "NOK", D(100), "NOK")
    assert status == NEAR
    assert distance == D(8)


def test_above():
    assert price_status(D(150), "NOK", D(100), "NOK") == (ABOVE, D(50))


def test_currency_mismatch_is_never_compared():
    assert price_status(D(10), "USD", D(100), "NOK") == (CURRENCY_MISMATCH, None)
