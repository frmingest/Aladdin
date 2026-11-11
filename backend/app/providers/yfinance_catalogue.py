"""Every company quoted on Oslo, from Yahoo's screener through yfinance (Sal's shop, 2026-11-11).

yfinance has no "list the exchange" call, but its screener takes an `exchange` filter. One query per
Yahoo sector (exchange = OSL and sector = X) is used instead of one big query, because the sector
filter is what tells us each company's sector reliably: the screener's result rows do not always
carry one. A last query without the sector filter catches companies Yahoo has no sector for; they
arrive unclassified rather than guessed.

Yahoo is reachable from the PC worker's home IP, not from Railway, which is why this runs in the worker
(app/worker/runner.py, `maybe_refresh_ticker_catalogue`). No API key. A request is retried once, with a
pause between requests, because an unofficial endpoint answers politely or not at all.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from decimal import Decimal, InvalidOperation
from typing import Any

from app.domain.ticker_catalogue import (
    EXCHANGE_OSLO,
    OSLO_CURRENCY,
    YAHOO_SECTORS,
    is_oslo_symbol,
)
from app.providers.base import CatalogueFetch, CatalogueProvider, CatalogueRecord

log = logging.getLogger("aladdin.catalogue")

PAGE_SIZE = 250  # Yahoo's maximum
MAX_PAGES = 8  # 2,000 companies per query: far above Oslo, and a stop for a runaway loop
PAUSE_SECONDS = 0.7

ScreenFn = Callable[[str | None, int, int], dict[str, Any]]
"""(yahoo sector or None, offset, size) -> the screener's result dict (`quotes`, `total`)."""


def _yahoo_screen(sector: str | None, offset: int, size: int) -> dict[str, Any]:
    import yfinance as yf  # imported here so the rest of the app never needs it loaded
    from yfinance import EquityQuery

    on_oslo = EquityQuery("eq", ["exchange", EXCHANGE_OSLO])
    query = on_oslo if sector is None else EquityQuery("and", [on_oslo, EquityQuery("eq", ["sector", sector])])
    return yf.screen(query, offset=offset, size=size, sortField="intradaymarketcap", sortAsc=False)


def _market_cap(value: Any) -> Decimal | None:
    if isinstance(value, dict):  # Yahoo sometimes wraps numbers as {"raw": 123, "fmt": "123"}
        value = value.get("raw")
    if value is None or isinstance(value, bool):
        return None
    try:
        cap = Decimal(str(value))
    except InvalidOperation:
        return None
    return cap if cap.is_finite() and cap > 0 else None


def _record(quote: dict[str, Any], yahoo_sector: str | None) -> CatalogueRecord | None:
    symbol = str(quote.get("symbol") or "").strip().upper()
    if not is_oslo_symbol(symbol):
        return None
    quote_type = quote.get("quoteType")
    if quote_type and str(quote_type).upper() != "EQUITY":
        return None
    name = next(
        (str(v).strip() for v in (quote.get("longName"), quote.get("shortName"), quote.get("displayName")) if v and str(v).strip()),
        symbol.rsplit(".", 1)[0],
    )
    currency = str(quote.get("currency") or OSLO_CURRENCY).strip().upper()
    if len(currency) != 3:
        currency = OSLO_CURRENCY
    return CatalogueRecord(
        ticker=symbol,
        name=name[:255],
        exchange=EXCHANGE_OSLO,
        currency=currency,
        yahoo_sector=yahoo_sector,
        market_cap=_market_cap(quote.get("marketCap")),
    )


class YFinanceCatalogueProvider(CatalogueProvider):
    name = "yfinance"

    def __init__(
        self,
        *,
        screen: ScreenFn | None = None,
        sleep: Callable[[float], None] = time.sleep,
        pause_seconds: float = PAUSE_SECONDS,
    ) -> None:
        self._screen = screen or _yahoo_screen
        self._sleep = sleep
        self._pause_seconds = pause_seconds

    def _page(self, sector: str | None, offset: int) -> dict[str, Any]:
        try:
            return self._screen(sector, offset, PAGE_SIZE)
        except Exception:  # noqa: BLE001 - one retry, then the caller reports it
            self._sleep(self._pause_seconds * 4)
            return self._screen(sector, offset, PAGE_SIZE)

    def _all_quotes(self, sector: str | None) -> list[dict[str, Any]]:
        quotes: list[dict[str, Any]] = []
        offset = 0
        for _ in range(MAX_PAGES):
            page = self._page(sector, offset) or {}
            batch = [q for q in (page.get("quotes") or []) if isinstance(q, dict)]
            quotes.extend(batch)
            offset += len(batch)
            total = page.get("total")
            if len(batch) < PAGE_SIZE or (isinstance(total, int) and offset >= total):
                break
            self._sleep(self._pause_seconds)
        return quotes

    def fetch_oslo(self) -> CatalogueFetch:
        found: dict[str, CatalogueRecord] = {}
        problems: list[str] = []
        for sector in YAHOO_SECTORS:
            try:
                quotes = self._all_quotes(sector)
            except Exception as exc:  # noqa: BLE001 - reported, never raised
                log.warning("catalogue: sector %s failed: %s", sector, exc)
                problems.append(f"{sector}: {exc}")
            else:
                for quote in quotes:
                    record = _record(quote, sector)
                    if record is not None:
                        found[record.ticker] = record
            self._sleep(self._pause_seconds)
        # Companies Yahoo gives no sector for: they come in unclassified, never guessed.
        try:
            quotes = self._all_quotes(None)
        except Exception as exc:  # noqa: BLE001
            log.warning("catalogue: the unfiltered pass failed: %s", exc)
            problems.append(f"all companies: {exc}")
        else:
            for quote in quotes:
                record = _record(quote, None)
                if record is not None and record.ticker not in found:
                    found[record.ticker] = record
        records = sorted(found.values(), key=lambda r: r.ticker)
        return CatalogueFetch(records=records, complete=not problems, problems=problems)
