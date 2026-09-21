"""Unit tests for app.providers.budget.DailyBudgetGuard."""
from app.providers.budget import DailyBudgetGuard


def test_starts_with_full_budget():
    guard = DailyBudgetGuard(daily_limit=20)
    assert guard.remaining_today() == 20
    assert guard.would_exceed(1) is False


def test_record_usage_decrements_remaining():
    guard = DailyBudgetGuard(daily_limit=5)
    guard.record_usage(1)
    guard.record_usage(2)
    assert guard.remaining_today() == 2


def test_would_exceed_true_when_cost_exceeds_remaining():
    guard = DailyBudgetGuard(daily_limit=2)
    guard.record_usage(1)
    assert guard.would_exceed(2) is True  # only 1 left, costs 2
    assert guard.would_exceed(1) is False


def test_remaining_never_goes_negative():
    guard = DailyBudgetGuard(daily_limit=1)
    guard.record_usage(5)  # over-record (e.g. a 2-call holding on a 1-left budget)
    assert guard.remaining_today() == 0


def test_records_failed_calls_too():
    """A failed call still cost real quota — callers debit on failure too."""
    guard = DailyBudgetGuard(daily_limit=3)
    guard.record_usage(1)  # a failed call
    guard.record_usage(1)  # a second failed call
    assert guard.remaining_today() == 1


def test_rolls_over_on_a_new_day(monkeypatch):
    guard = DailyBudgetGuard(daily_limit=5)
    guard.record_usage(3)
    assert guard.remaining_today() == 2

    monkeypatch.setattr(DailyBudgetGuard, "_today", staticmethod(lambda: "2099-01-01"))
    assert guard.remaining_today() == 5  # new day, counter reset
