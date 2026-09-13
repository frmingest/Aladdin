"""
Wires concrete provider implementations from settings (§4, §29 — provider
choice is configuration, not something service code branches on).
"""

from functools import lru_cache

from app.config.settings import get_settings
from app.providers.base import MarketDataProvider, ObjectStorageProvider
from app.providers.stubs import LocalObjectStorageProvider, StubMarketDataProvider
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
