"""
Wires concrete provider implementations from settings (§4, §29 — provider
choice is configuration, not something service code branches on).
"""

from functools import lru_cache

from app.config.settings import get_settings
from app.providers.base import LLMProvider, MarketDataProvider, ObjectStorageProvider
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider
from app.providers.stubs import LocalObjectStorageProvider, StubLLMProvider, StubMarketDataProvider
from app.providers.yfinance_provider import YFinanceMarketDataProvider


@lru_cache
def get_object_storage() -> ObjectStorageProvider:
    settings = get_settings()
    if settings.object_storage_provider == "local":
        return LocalObjectStorageProvider(settings.object_storage_local_path)
    raise NotImplementedError(
        f"Object storage provider '{settings.object_storage_provider}' not yet wired — see §29."
    )


@lru_cache
def get_market_data_provider() -> MarketDataProvider:
    settings = get_settings()
    if settings.market_data_provider == "yfinance":
        return YFinanceMarketDataProvider()
    if settings.market_data_provider == "stub":
        return StubMarketDataProvider()
    raise NotImplementedError(
        f"Market data provider '{settings.market_data_provider}' not yet wired — see §29."
    )


@lru_cache
def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.llm_provider == "google_ai_studio":
        return GoogleAIStudioProvider(
            api_key=settings.google_ai_studio_api_key,
            model=settings.llm_model_name,
            max_output_tokens=settings.llm_max_output_tokens,
            temperature=settings.llm_temperature,
        )
    if settings.llm_provider == "stub":
        return StubLLMProvider()
    raise NotImplementedError(f"LLM provider '{settings.llm_provider}' not yet wired — see §29.")
