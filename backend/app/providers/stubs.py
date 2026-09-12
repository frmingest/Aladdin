"""
Stub providers — deliberately unimplemented, so the application fails loudly
(§21: "fail visibly rather than silently invent") rather than silently
returning fabricated data. Replace with real implementations as the §29 open
questions (market-data provider, research provider) are resolved.
"""

from datetime import datetime

from app.providers.base import (
    FxRate,
    LLMProvider,
    LLMResponse,
    MarketDataProvider,
    ObjectStorageProvider,
    PriceObservation,
    ResearchItem,
    ResearchProvider,
)


class StubMarketDataProvider(MarketDataProvider):
    def get_latest_price(self, ticker: str) -> PriceObservation:
        raise NotImplementedError(f"No market data provider configured for '{ticker}' — see §29.")

    def get_historical_prices(self, ticker: str, start: datetime, end: datetime) -> list[PriceObservation]:
        raise NotImplementedError("No market data provider configured — see §29.")

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        raise NotImplementedError("No market data provider configured — see §29.")


class StubResearchProvider(ResearchProvider):
    def get_macro_snapshot(self) -> list[ResearchItem]:
        raise NotImplementedError("No research provider configured — see §29.")

    def get_sector_research(self, sector: str) -> list[ResearchItem]:
        raise NotImplementedError("No research provider configured — see §29.")


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


class AnthropicLLMProvider(LLMProvider):
    """Thin wrapper — actual client wiring added in Phase 3 (AI analysis)."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def analyze(self, prompt: str, prompt_version: str) -> LLMResponse:
        raise NotImplementedError("LLM analysis service not yet implemented — Phase 3.")
