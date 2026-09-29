"""Trailing P/E of a fund constituent, looked up by ISIN — the market input
of the fund look-through valuation (app/services/valuation/fund_look_through.py).

yfinance resolves an ISIN to a Yahoo ticker itself (`yf.Ticker(isin)`, since
0.2.x; installed 1.7.0 confirmed in code), then `info["trailingPE"]` is the
price over trailing-twelve-month earnings. Best effort by design: a constituent
Yahoo cannot resolve, or that has no positive earnings, comes back as
"unavailable" with a reason and simply is not covered — the look-through
reports its coverage instead of guessing.

NOT verified live: the build sandbox has no route to Yahoo (or DWS), so the
unit tests mock `yfinance.Ticker`. First real use is "Refresh look-through"
on a fund page on a machine that can reach Yahoo.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Protocol


class ConstituentUnavailableError(RuntimeError):
    """No usable P/E for this constituent; the message is the reason shown."""


@dataclass(frozen=True)
class ConstituentMultiple:
    isin: str
    trailing_pe: Decimal
    resolved_ticker: str | None
    provider: str
    observed_at: datetime


class ConstituentMultiplesProvider(Protocol):
    name: str

    def get_trailing_pe(self, isin: str) -> ConstituentMultiple: ...


class YFinanceConstituentMultiplesProvider:
    name = "yfinance"

    def get_trailing_pe(self, isin: str) -> ConstituentMultiple:
        import yfinance as yf

        try:
            ticker = yf.Ticker(isin)
            info = ticker.info or {}
        except Exception as exc:
            raise ConstituentUnavailableError(f"Yahoo lookup failed: {type(exc).__name__}") from exc
        raw = info.get("trailingPE")
        try:
            pe = Decimal(str(raw)) if raw is not None else None
        except InvalidOperation:
            pe = None
        if pe is None or not math.isfinite(float(pe)):
            raise ConstituentUnavailableError("no trailing P/E on Yahoo (unresolved ISIN or no reported earnings)")
        if pe <= 0:
            raise ConstituentUnavailableError("loss-making: no positive trailing earnings")
        symbol = info.get("symbol")
        return ConstituentMultiple(
            isin=isin,
            trailing_pe=pe,
            resolved_ticker=str(symbol)[:64] if symbol else None,
            provider=self.name,
            observed_at=datetime.now(timezone.utc),
        )
