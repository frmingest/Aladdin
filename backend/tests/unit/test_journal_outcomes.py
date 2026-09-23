"""Unit tests for app.services.journal.compute_outcome (feature F6)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal as D
from types import SimpleNamespace

from app.services.journal import compute_outcome

TODAY = date(2026, 9, 23)


def _entry(action="buy", decided_on=date(2026, 1, 2), price="100", currency="NOK", r6=None, r12=None):
    return SimpleNamespace(id=uuid.uuid4(), action=action, decided_on=decided_on,
                           price=D(price) if price else None, currency=currency, review_6m=r6, review_12m=r12)


def _obs(day, price, currency="NOK"):
    return SimpleNamespace(observed_at=datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
                           price=D(price), currency=currency)


def test_buy_that_rose_is_in_favour():
    o = compute_outcome(_entry(), [_obs(date(2026, 9, 20), "125")], today=TODAY)
    assert o.return_pct == D(25)
    assert o.in_favour is True
    assert o.days_since == 264


def test_sell_that_rose_is_against():
    o = compute_outcome(_entry(action="sell"), [_obs(date(2026, 9, 20), "110")], today=TODAY)
    assert o.in_favour is False


def test_hold_has_no_direction():
    o = compute_outcome(_entry(action="hold"), [_obs(date(2026, 9, 20), "90")], today=TODAY)
    assert o.return_pct == D(-10)
    assert o.in_favour is None


def test_six_month_price_and_reviews_due():
    obs = [_obs(date(2026, 3, 1), "90"), _obs(date(2026, 7, 5), "120"), _obs(date(2026, 9, 20), "130")]
    o = compute_outcome(_entry(), obs, today=TODAY)
    assert o.price_6m == D(120)  # first price on/after 2026-07-03
    assert o.return_6m_pct == D(20)
    assert o.review_6m_due is True
    assert o.review_12m_due is False
    assert o.price_12m is None


def test_written_review_is_not_due():
    o = compute_outcome(_entry(r6="Thesis intact"), [], today=TODAY)
    assert o.review_6m_due is False


def test_other_currency_prices_are_ignored():
    o = compute_outcome(_entry(currency="NOK"), [_obs(date(2026, 9, 20), "12", "USD")], today=TODAY)
    assert o.return_pct is None
    assert "not in NOK" in o.note


def test_no_price_recorded_still_shows_latest():
    o = compute_outcome(_entry(price=None), [_obs(date(2026, 9, 20), "12")], today=TODAY)
    assert o.latest_price == D(12)
    assert o.return_pct is None
