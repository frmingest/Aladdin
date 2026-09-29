"""yfinance constituent P/E provider with yfinance.Ticker mocked (the build
sandbox cannot reach Yahoo): a positive P/E is returned; loss-making,
missing, NaN and lookup errors become 'unavailable' with a reason."""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.providers.constituent_multiples import (
    ConstituentUnavailableError,
    YFinanceConstituentMultiplesProvider,
)


class _Ticker:
    def __init__(self, info=None, boom=False):
        self._info, self._boom = info, boom

    @property
    def info(self):
        if self._boom:
            raise RuntimeError("yahoo down")
        return self._info


def _patch(monkeypatch, ticker):
    import yfinance

    monkeypatch.setattr(yfinance, "Ticker", lambda symbol: ticker)


def test_positive_pe_is_returned_with_resolved_symbol(monkeypatch):
    _patch(monkeypatch, _Ticker({"trailingPE": 23.5, "symbol": "RR.L"}))
    got = YFinanceConstituentMultiplesProvider().get_trailing_pe("GB00B63H8491")
    assert got.trailing_pe == Decimal("23.5") and got.resolved_ticker == "RR.L" and got.isin == "GB00B63H8491"


@pytest.mark.parametrize(
    "info,match",
    [
        ({"trailingPE": -3.0}, "loss-making"),
        ({}, "no trailing P/E"),
        ({"trailingPE": float("nan")}, "no trailing P/E"),
        ({"trailingPE": "Infinity"}, "no trailing P/E"),
    ],
)
def test_unusable_pe_is_unavailable(monkeypatch, info, match):
    _patch(monkeypatch, _Ticker(info))
    with pytest.raises(ConstituentUnavailableError, match=match):
        YFinanceConstituentMultiplesProvider().get_trailing_pe("X")


def test_lookup_error_is_unavailable_not_a_crash(monkeypatch):
    _patch(monkeypatch, _Ticker(boom=True))
    with pytest.raises(ConstituentUnavailableError, match="Yahoo lookup failed"):
        YFinanceConstituentMultiplesProvider().get_trailing_pe("X")
