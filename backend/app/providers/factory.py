"""Wires configured settings to concrete LLMProvider instances.

Call sites ask this factory for a provider — never import
GoogleAIStudioProvider/MistralProvider directly — so a future third
provider (or a swap) is "a new file behind app.providers.factory, no
service-layer change" (claude/llm-provider-alternatives-2026-09-17.md).
"""
from __future__ import annotations

from functools import lru_cache

from app.config.settings import Settings, get_settings
from app.providers.base import (
    FundamentalsProvider,
    FundamentalsUnavailableError,
    LLMProvider,
    LLMUnavailableError,
    MarketDataProvider,
    MarketDataUnavailableError,
    ResearchProvider,
    ResearchUnavailableError,
    RiskFreeRateProvider,
    RiskFreeRateUnavailableError,
)
from app.providers.budget import DailyBudgetGuard
from app.providers.fred_risk_free_rate_provider import FredRiskFreeRateProvider
from app.providers.gemini_research_provider import GeminiResearchProvider
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider
from app.providers.mistral_provider import MistralProvider
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.providers.object_storage import (
    LocalObjectStorageProvider,
    ObjectStorageProvider,
)
from app.providers.object_storage_s3 import S3ObjectStorageProvider
from app.providers.sec_edgar_provider import SecEdgarFundamentalsProvider
from app.providers.yfinance_provider import YFinanceMarketDataProvider


def _build_provider(name: str, settings: Settings) -> LLMProvider:
    if name == "google_ai_studio":
        return GoogleAIStudioProvider(
            api_key=settings.google_ai_studio_api_key or "",
            model=settings.llm_model_name,
            temperature=settings.llm_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
            rpm=settings.llm_rate_limit_rpm,
            # Same account/quota as get_research_provider()'s
            # GeminiResearchProvider — get_primary_budget_guard() is
            # @lru_cache'd, so both share the exact same guard instance
            # (2026-09-22: previously built but never wired in anywhere —
            # see gemini_retry.py's module docstring).
            budget_guard=get_primary_budget_guard(),
        )
    if name == "mistral":
        return MistralProvider(
            api_key=settings.mistral_api_key or "",
            model=settings.mistral_model_name,
            temperature=settings.llm_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
            rpm=settings.mistral_rate_limit_rpm,
        )
    raise LLMUnavailableError(f"Unknown LLM provider: {name!r}")


@lru_cache
def get_llm_provider() -> LLMProvider:
    """The configured primary provider (LLM_PROVIDER, default google_ai_studio)."""
    settings = get_settings()
    return _build_provider(settings.llm_provider, settings)


@lru_cache
def get_llm_fallback_provider() -> LLMProvider | None:
    """The configured fallback provider, or None (default) if unset."""
    settings = get_settings()
    if settings.llm_fallback_provider == "none":
        return None
    return _build_provider(settings.llm_fallback_provider, settings)


@lru_cache
def get_primary_budget_guard() -> DailyBudgetGuard:
    """The primary provider's daily request-budget guard (see budget.py)."""
    settings = get_settings()
    return DailyBudgetGuard(daily_limit=settings.llm_rate_limit_rpd)


@lru_cache
def get_object_storage() -> ObjectStorageProvider:
    """The configured object storage backend (OBJECT_STORAGE_PROVIDER,
    default "local"). See app.providers.object_storage for what each
    implementation is for.

    "s3", "r2", and "supabase" are all accepted and all build the same
    S3ObjectStorageProvider — R2 and Supabase Storage both expose an
    S3-compatible API, so the vendor is a config choice (endpoint_url/
    region/keys), never a code branch. Accepting the vendor names directly
    avoids the exact misconfiguration that broke CSV import on 2026-09-21:
    OBJECT_STORAGE_PROVIDER=supabase (a reasonable reading of
    backend/.env.example's old wording) previously fell through to the
    NotImplementedError below instead of working.
    """
    settings = get_settings()
    provider = settings.object_storage_provider
    if provider == "local":
        return LocalObjectStorageProvider(settings.object_storage_local_path)
    if provider in ("s3", "r2", "supabase"):
        return S3ObjectStorageProvider(
            bucket=settings.object_storage_bucket,
            endpoint_url=settings.object_storage_endpoint_url,
            region=settings.object_storage_region,
            access_key_id=settings.object_storage_access_key_id,
            secret_access_key=settings.object_storage_secret_access_key,
        )
    raise NotImplementedError(
        f"Object storage provider '{provider}' not supported — use 'local', "
        "'s3', 'r2', or 'supabase'."
    )


@lru_cache
def get_research_provider() -> ResearchProvider:
    """The configured live-research provider (RESEARCH_PROVIDER, default
    "gemini_search"). Reuses the same Google AI Studio key and RPM budget
    as get_llm_provider() — see app/providers/gemini_research_provider.py.
    """
    settings = get_settings()
    if settings.research_provider == "gemini_search":
        return GeminiResearchProvider(
            api_key=settings.google_ai_studio_api_key or "",
            model=settings.llm_model_name,
            prompt_version=settings.active_research_prompt_version,
            temperature=settings.llm_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
            rpm=settings.llm_rate_limit_rpm,
            budget_guard=get_primary_budget_guard(),
        )
    raise ResearchUnavailableError(
        f"Unknown research provider: {settings.research_provider!r}"
    )

@lru_cache
def get_market_data_provider() -> MarketDataProvider:
    """The configured live market-data provider (MARKET_DATA_PROVIDER,
    default "yfinance") — current/historical price, FX, beta for the
    valuation engine (Sprint 3, app/services/valuation/)."""
    settings = get_settings()
    if settings.market_data_provider == "yfinance":
        return YFinanceMarketDataProvider()
    raise MarketDataUnavailableError(
        f"Unknown market data provider: {settings.market_data_provider!r}"
    )


@lru_cache
def get_risk_free_rate_provider() -> RiskFreeRateProvider:
    """The configured risk-free-rate provider (RISK_FREE_RATE_PROVIDER,
    default "fred") — the DCF discount rate's risk-free-rate term."""
    settings = get_settings()
    if settings.risk_free_rate_provider == "fred":
        return FredRiskFreeRateProvider(
            api_key=settings.fred_api_key or "",
            series_version=settings.active_risk_free_rate_series_version,
        )
    raise RiskFreeRateUnavailableError(
        f"Unknown risk-free-rate provider: {settings.risk_free_rate_provider!r}"
    )


@lru_cache
def get_fundamentals_provider() -> FundamentalsProvider:
    """The configured filer-reported fundamentals provider
    (FUNDAMENTALS_PROVIDER, default "sec_edgar"). Cached so SEC's ticker->CIK
    map is fetched once per process per day, not once per request."""
    settings = get_settings()
    if settings.fundamentals_provider == "sec_edgar":
        return SecEdgarFundamentalsProvider(
            user_agent=settings.sec_edgar_user_agent,
            max_years=settings.sec_edgar_max_years,
        )
    raise FundamentalsUnavailableError(
        f"Unknown or disabled fundamentals provider: {settings.fundamentals_provider!r}"
    )


@lru_cache
def get_announcements_provider() -> NewswebAnnouncementsProvider:
    """The configured regulated-announcements provider
    (ANNOUNCEMENTS_PROVIDER, default "newsweb")."""
    settings = get_settings()
    if settings.announcements_provider == "newsweb":
        return NewswebAnnouncementsProvider(lookback_days=settings.announcements_lookback_days)
    raise ResearchUnavailableError(
        f"Unknown or disabled announcements provider: {settings.announcements_provider!r}"
    )


def get_announcements_provider_or_none() -> NewswebAnnouncementsProvider | None:
    """FastAPI-dependency-friendly variant: a disabled provider is None
    (callers report it as unavailable) instead of a 500."""
    try:
        return get_announcements_provider()
    except ResearchUnavailableError:
        return None


def get_fundamentals_provider_or_none() -> FundamentalsProvider | None:
    try:
        return get_fundamentals_provider()
    except FundamentalsUnavailableError:
        return None
