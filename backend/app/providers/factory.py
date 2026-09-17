"""
Wires concrete provider implementations from settings (§4, §29 — provider
choice is configuration, not something service code branches on).
"""

from functools import lru_cache

from app.config.settings import get_settings
from app.domain.macro_series import load_macro_series_registry
from app.providers.base import (
    LLMProvider,
    MacroDataProvider,
    MarketDataProvider,
    ObjectStorageProvider,
    ResearchProvider,
)
from app.providers.composite_macro_provider import CompositeMacroDataProvider
from app.providers.composite_market_provider import CompositeMarketDataProvider
from app.providers.fred_provider import FredMacroDataProvider
from app.providers.gemini_research_provider import GeminiResearchProvider
from app.providers.gold_metal_provider import (
    SUPPORTED_TICKERS as GOLD_API_SUPPORTED_TICKERS,
)
from app.providers.gold_metal_provider import GoldApiMarketDataProvider
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider
from app.providers.mistral_provider import MistralProvider
from app.providers.norges_bank_provider import NorgesBankMacroDataProvider
from app.providers.s3_storage_provider import S3ObjectStorageProvider
from app.providers.stubs import (
    LocalObjectStorageProvider,
    StubLLMProvider,
    StubMacroDataProvider,
    StubMarketDataProvider,
    StubResearchProvider,
)
from app.providers.yfinance_provider import YFinanceMarketDataProvider


@lru_cache
def get_object_storage() -> ObjectStorageProvider:
    settings = get_settings()
    if settings.object_storage_provider == "local":
        return LocalObjectStorageProvider(settings.object_storage_local_path)
    if settings.object_storage_provider in ("r2", "supabase"):
        # Both are S3-compatible — see docs/decisions/0010 and
        # S3ObjectStorageProvider's docstring.
        return S3ObjectStorageProvider(
            bucket=settings.object_storage_bucket,
            endpoint_url=settings.object_storage_endpoint_url,
            region=settings.object_storage_region,
            access_key_id=settings.object_storage_access_key_id,
            secret_access_key=settings.object_storage_secret_access_key,
        )
    raise NotImplementedError(
        f"Object storage provider '{settings.object_storage_provider}' not yet wired — see §29."
    )


@lru_cache
def get_market_data_provider() -> MarketDataProvider:
    settings = get_settings()
    if settings.market_data_provider == "yfinance":
        base: MarketDataProvider = YFinanceMarketDataProvider()
        # Phase 8 (ADR 0011) — composes in gold-api.com for XAU/XAG spot
        # pricing so a physical gold/silver holding's market_ticker resolves
        # without touching yfinance or any calling code. Additive: every
        # ticker other than XAU/XAG still routes to `base`, unchanged.
        if settings.commodity_price_provider == "gold_api":
            return CompositeMarketDataProvider(
                default=base,
                commodity=GoldApiMarketDataProvider(base_url=settings.gold_api_base_url),
                commodity_tickers=GOLD_API_SUPPORTED_TICKERS,
            )
        return base
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
            # Paces + retries every call against the free tier's RPM cap
            # (app.providers.gemini_retry, 2026-09-15) — see settings.
            rpm=settings.llm_rate_limit_rpm,
        )
    if settings.llm_provider == "stub":
        return StubLLMProvider()
    raise NotImplementedError(f"LLM provider '{settings.llm_provider}' not yet wired — see §29.")


@lru_cache
def get_llm_fallback_provider() -> LLMProvider | None:
    """Only ever used by app.services.analysis.runner when the primary
    provider's daily budget is exhausted mid-run (§29, 2026-09-17 — see
    claude/llm-provider-alternatives-2026-09-17.md). None (the default,
    settings.llm_fallback_provider == "none") preserves the original
    skip-on-exhaustion behavior — the primary provider above is untouched
    either way."""
    settings = get_settings()
    if settings.llm_fallback_provider == "none":
        return None
    if settings.llm_fallback_provider == "mistral":
        return MistralProvider(
            api_key=settings.mistral_api_key,
            model=settings.mistral_model_name,
            max_output_tokens=settings.llm_max_output_tokens,
            temperature=settings.llm_temperature,
            rpm=settings.mistral_rate_limit_rpm,
        )
    raise NotImplementedError(
        f"LLM fallback provider '{settings.llm_fallback_provider}' not yet wired — see §29."
    )


@lru_cache
def get_macro_data_provider() -> MacroDataProvider:
    settings = get_settings()
    if settings.macro_data_provider == "fred_norges_bank":
        registry = load_macro_series_registry(settings.active_macro_series_version)
        return CompositeMacroDataProvider(
            registry=registry,
            fred=FredMacroDataProvider(api_key=settings.fred_api_key, registry=registry),
            norges_bank=NorgesBankMacroDataProvider(registry=registry),
        )
    if settings.macro_data_provider == "stub":
        return StubMacroDataProvider()
    raise NotImplementedError(f"Macro data provider '{settings.macro_data_provider}' not yet wired — see §29.")


@lru_cache
def get_research_provider() -> ResearchProvider:
    settings = get_settings()
    if settings.research_provider == "gemini_search":
        return GeminiResearchProvider(
            api_key=settings.google_ai_studio_api_key,
            model=settings.llm_model_name,
            prompt_version=settings.active_research_prompt_version,
            max_output_tokens=settings.llm_max_output_tokens,
            temperature=settings.llm_temperature,
            # Shares the analysis provider's account/budget — same pacing
            # clock, same rpm setting (app.providers.gemini_retry).
            rpm=settings.llm_rate_limit_rpm,
        )
    if settings.research_provider == "stub":
        return StubResearchProvider()
    raise NotImplementedError(f"Research provider '{settings.research_provider}' not yet wired — see §29.")
