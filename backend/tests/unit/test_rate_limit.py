"""Unit tests for app.providers.rate_limit.RateLimiter."""
from app.providers.rate_limit import RateLimiter


def test_rpm_zero_never_sleeps():
    limiter = RateLimiter()
    sleeps = []
    limiter.wait(0, _sleep=sleeps.append)
    limiter.wait(0, _sleep=sleeps.append)
    assert sleeps == []


def test_first_call_never_sleeps():
    limiter = RateLimiter()
    sleeps = []
    limiter.wait(5, _sleep=sleeps.append)
    assert sleeps == []


def test_second_call_sleeps_for_remaining_interval(monkeypatch):
    limiter = RateLimiter()
    times = iter([100.0, 100.0, 100.1])  # first .wait: now; second .wait: now, then post-sleep now
    monkeypatch.setattr("app.providers.rate_limit.time.monotonic", lambda: next(times))

    sleeps = []
    limiter.wait(60, _sleep=sleeps.append)  # rpm=60 -> min_interval=1s, first call, no sleep
    limiter.wait(60, _sleep=sleeps.append)  # called immediately after -> should sleep ~1s

    assert len(sleeps) == 1
    assert sleeps[0] == 1.0


def test_independent_instances_pace_independently():
    a = RateLimiter()
    b = RateLimiter()
    sleeps_a: list[float] = []
    sleeps_b: list[float] = []
    a.wait(60, _sleep=sleeps_a.append)
    b.wait(60, _sleep=sleeps_b.append)
    assert sleeps_a == []
    assert sleeps_b == []
