"""
Routes a MarketDataProvider call to whichever vendor provider owns that
ticker (§26 Phase 8, ADR 0011) — the same composite pattern
app.providers.composite_macro_provider already established for macro data
(FRED vs. Norges Bank, routed by series_key). Here, a holding whose
`market_ticker` is "XAU"/"XAG" (app.providers.gold_metal_provider's
SUPPORTED_TICKERS) routes to the metals provider instead of the default
(yfinance); every other ticker is unaffected. Application/service code still
depends only on MarketDataProvider (§3, §28 rule 8) — it never knows two
vendors are involved.

FX conversion always goes to the default provider: a spot-metals API quotes
in one currency (USD) and has no cross-rate table of its own, so
get_fx_rate is never routed to the commodity provider even for a
commodity-currency-shaped pair.
"""

from datetime import datetime

from app.providers.base import (
    DividendObservation,
    FxRate,
    MarketDataProvider,
    MarketMetadata,
    PriceObservation,
)


class CompositeMarketDataProvider(MarketDataProvider):
    def __init__(
        self,
        default: MarketDataProvider,
        commodity: MarketDataProvider,
        commodity_tickers: frozenset[str],
    ):
        self._default = default
        self._commodity = commodity
        self._commodity_tickers = commodity_tickers

    def _route(self, ticker: str) -> MarketDataProvider:
        return self._commodity if ticker.strip().upper() in self._commodity_tickers else self._default

    def get_latest_price(self, ticker: str) -> PriceObservation:
        return self._route(ticker).get_latest_price(ticker)

    def get_historical_prices(self, ticker: str, start: datetime, end: datetime) -> list[PriceObservation]:
        return self._route(ticker).get_historical_prices(ticker, start, end)

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        # See module docstring — FX always goes through the default
        # provider regardless of which ticker triggered this refresh.
        return self._default.get_fx_rate(from_currency, to_currency)

    def get_dividends(self, ticker: str) -> list[DividendObservation]:
        return self._route(ticker).get_dividends(ticker)

    def get_market_metadata(self, ticker: str) -> MarketMetadata:
        return self._route(ticker).get_market_metadata(ticker)
