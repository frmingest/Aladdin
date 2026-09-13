"""
Stub providers — deliberately unimplemented, so the application fails loudly
(§21: "fail visibly rather than silently invent") rather than silently
returning fabricated data. Used only when the corresponding settings flag is
set to "stub" (e.g. to run the app/tests with no external dependency at
all) — every §29 open question this file used to leave open (market data,
LLM, research) now has a real implementation selected by default; see
app.providers.factory.
"""

from datetime import datetime

from pydantic import BaseModel

from app.providers.base import (
    DividendObservation,
    FxRate,
    LLMProvider,
    LLMResponse,
    MacroDataProvider,
    MacroSeriesPoint,
    MarketDataProvider,
    MarketMetadata,
    ObjectStorageProvider,
    PriceObservation,
    ResearchItem,
    ResearchProvider,
)


class StubMarketDataProvider(MarketDataProvider):
    """Deliberately unimplemented — used only when MARKET_DATA_PROVIDER=stub,
    e.g. to run the app/tests with no market-data dependency at all."""

    def get_latest_price(self, ticker: str) -> PriceObservation:
        raise NotImplementedError(f"No market data provider configured for '{ticker}' — see §29.")

    def get_historical_prices(self, ticker: str, start: datetime, end: datetime) -> list[PriceObservation]:
        raise NotImplementedError("No market data provider configured — see §29.")

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        raise NotImplementedError("No market data provider configured — see §29.")

    def get_dividends(self, ticker: str) -> list[DividendObservation]:
        raise NotImplementedError("No market data provider configured — see §29.")

    def get_market_metadata(self, ticker: str) -> MarketMetadata:
        raise NotImplementedError("No market data provider configured — see §29.")


class StubResearchProvider(ResearchProvider):
    def get_macro_snapshot(self) -> list[ResearchItem]:
        raise NotImplementedError("No research provider configured — see §29.")

    def get_sector_research(self, sector: str) -> list[ResearchItem]:
        raise NotImplementedError("No research provider configured — see §29.")


class StubMacroDataProvider(MacroDataProvider):
    """Deliberately unimplemented — used only when MACRO_DATA_PROVIDER=stub,
    e.g. to run the app/tests with no macro-data dependency at all."""

    def get_latest(self, series_key: str) -> MacroSeriesPoint:
        raise NotImplementedError(f"No macro data provider configured for '{series_key}' — see §29.")

    def get_series(self, series_key: str, start: datetime, end: datetime) -> list[MacroSeriesPoint]:
        raise NotImplementedError("No macro data provider configured — see §29.")


class LocalObjectStorageProvider(ObjectStorageProvider):
    """Minimal filesystem-backed storage for local development only."""

    def __init__(self, base_path: str):
        import os

        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)

    def store(self, key: str, content: bytes) -> str:
        import os

        path = os.path.join(self.base_path, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(content)
        return path

    def retrieve(self, key: str) -> bytes:
        import os

        path = os.path.join(self.base_path, key)
        with open(path, "rb") as f:
            return f.read()


class StubLLMProvider(LLMProvider):
    """Deliberately unimplemented — used only when LLM_PROVIDER=stub, e.g. to
    run the app/tests with no LLM dependency at all. The real implementation
    is GoogleAIStudioProvider (see docs/decisions/0005 for why Google AI
    Studio rather than the architecture's original Anthropic recommendation);
    this stub replaced an earlier unimplemented `AnthropicLLMProvider` here."""

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        prompt_version: str,
    ) -> LLMResponse:
        raise NotImplementedError("No LLM provider configured — see §29 and decision 0005.")
