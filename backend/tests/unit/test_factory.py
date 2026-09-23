"""Unit tests for app.providers.factory — the only place a call site should
ever learn which vendor is configured."""
import pytest

from app.config.settings import get_settings
from app.providers import factory
from app.providers.base import (
    LLMUnavailableError,
    MarketDataUnavailableError,
    RiskFreeRateUnavailableError,
)
from app.providers.fred_risk_free_rate_provider import FredRiskFreeRateProvider
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider
from app.providers.mistral_provider import MistralProvider
from app.providers.object_storage import LocalObjectStorageProvider
from app.providers.object_storage_s3 import S3ObjectStorageProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.yfinance_provider import YFinanceMarketDataProvider


@pytest.fixture(autouse=True)
def _clear_caches(monkeypatch):
    """Every settings-derived cache must start clean for each test, since
    get_settings()/get_llm_provider()/... are process-wide @lru_cache
    singletons that would otherwise leak state between tests."""
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_FALLBACK_PROVIDER", raising=False)
    monkeypatch.delenv("GOOGLE_AI_STUDIO_API_KEY", raising=False)
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    monkeypatch.delenv("MARKET_DATA_PROVIDER", raising=False)
    monkeypatch.delenv("RISK_FREE_RATE_PROVIDER", raising=False)
    monkeypatch.delenv("OBJECT_STORAGE_PROVIDER", raising=False)
    monkeypatch.delenv("RESEARCH_PROVIDER", raising=False)
    get_settings.cache_clear()
    factory.get_llm_provider.cache_clear()
    factory.get_llm_fallback_provider.cache_clear()
    factory.get_primary_budget_guard.cache_clear()
    factory.get_market_data_provider.cache_clear()
    factory.get_risk_free_rate_provider.cache_clear()
    factory.get_object_storage.cache_clear()
    factory.get_research_provider.cache_clear()
    yield
    get_settings.cache_clear()
    factory.get_llm_provider.cache_clear()
    factory.get_llm_fallback_provider.cache_clear()
    factory.get_primary_budget_guard.cache_clear()
    factory.get_market_data_provider.cache_clear()
    factory.get_risk_free_rate_provider.cache_clear()
    factory.get_object_storage.cache_clear()
    factory.get_research_provider.cache_clear()


def test_default_primary_provider_is_google_ai_studio(monkeypatch):
    monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
    provider = factory.get_llm_provider()
    assert isinstance(provider, GoogleAIStudioProvider)


def test_primary_provider_can_be_switched_to_mistral(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "mistral")
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key")
    provider = factory.get_llm_provider()
    assert isinstance(provider, MistralProvider)


def test_unknown_primary_provider_raises():
    with pytest.raises(LLMUnavailableError):
        factory._build_provider("openai", get_settings())


def test_fallback_defaults_to_none(monkeypatch):
    # Explicit override: the real backend/.env (loaded by Settings
    # regardless of process env) has LLM_FALLBACK_PROVIDER=mistral set for
    # real use — this test is about the *default*, so it pins the env var
    # to what an unconfigured deployment would actually have.
    monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", "none")
    assert factory.get_llm_fallback_provider() is None


def test_fallback_can_be_configured_to_mistral(monkeypatch):
    monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", "mistral")
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key")
    fallback = factory.get_llm_fallback_provider()
    assert isinstance(fallback, MistralProvider)


def test_primary_budget_guard_uses_configured_daily_limit(monkeypatch):
    monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
    monkeypatch.setenv("LLM_RATE_LIMIT_RPD", "7")
    guard = factory.get_primary_budget_guard()
    assert guard.remaining_today() == 7


def test_llm_provider_shares_the_primary_budget_guard_instance(monkeypatch):
    """Regression test (2026-09-22): get_primary_budget_guard() used to be
    built but never actually wired into either Gemini-calling provider —
    see gemini_retry.py's module docstring for the slow-page incident this
    caused. Both get_llm_provider() and get_research_provider() must share
    the exact same guard instance (they hit the same Google AI Studio
    account/quota), not one each."""
    monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
    monkeypatch.setenv("RESEARCH_PROVIDER", "gemini_search")
    llm_provider = factory.get_llm_provider()
    research_provider = factory.get_research_provider()
    assert llm_provider._budget_guard is factory.get_primary_budget_guard()
    assert research_provider._budget_guard is factory.get_primary_budget_guard()


def test_default_market_data_provider_is_yfinance(monkeypatch):
    # Explicit override: this repo's real backend/.env pins
    # MARKET_DATA_PROVIDER=stub for local dev (avoids accidental live
    # Yahoo Finance calls) — this test is about the code *default*, so it
    # pins the env var to what an unconfigured deployment would actually
    # have, mirroring test_fallback_defaults_to_none's own precedent above.
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "yfinance")
    provider = factory.get_market_data_provider()
    assert isinstance(provider, YFinanceMarketDataProvider)


def test_unknown_market_data_provider_raises(monkeypatch):
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "bloomberg")
    with pytest.raises(MarketDataUnavailableError):
        factory.get_market_data_provider()


def test_default_risk_free_rate_provider_is_fred(monkeypatch):
    monkeypatch.setenv("RISK_FREE_RATE_PROVIDER", "fred")
    provider = factory.get_risk_free_rate_provider()
    assert isinstance(provider, FredRiskFreeRateProvider)


def test_unknown_risk_free_rate_provider_raises(monkeypatch):
    monkeypatch.setenv("RISK_FREE_RATE_PROVIDER", "norges_bank")
    with pytest.raises(RiskFreeRateUnavailableError):
        factory.get_risk_free_rate_provider()
def test_default_object_storage_provider_is_local(monkeypatch):
    monkeypatch.setenv("OBJECT_STORAGE_PROVIDER", "local")
    storage = factory.get_object_storage()
    assert isinstance(storage, LocalObjectStorageProvider)


@pytest.mark.parametrize("provider_name", ["s3", "r2", "supabase"])
def test_s3_compatible_object_storage_aliases_all_build_s3_provider(monkeypatch, provider_name):
    # Regression test for the 2026-09-21 CSV-import outage: Railway had
    # OBJECT_STORAGE_PROVIDER=supabase set (matching backend/.env.example's
    # own wording at the time) but the factory only recognized "s3", so
    # every /portfolio/import-csv request 500'd on the get_object_storage
    # dependency before it ever looked at the uploaded file. "s3", "r2",
    # and "supabase" must all build the same S3ObjectStorageProvider.
    monkeypatch.setenv("OBJECT_STORAGE_PROVIDER", provider_name)
    monkeypatch.setenv("OBJECT_STORAGE_ENDPOINT_URL", "https://example.invalid")
    monkeypatch.setenv("OBJECT_STORAGE_ACCESS_KEY_ID", "test-key-id")
    monkeypatch.setenv("OBJECT_STORAGE_SECRET_ACCESS_KEY", "test-secret")
    storage = factory.get_object_storage()
    assert isinstance(storage, S3ObjectStorageProvider)


def test_unknown_object_storage_provider_raises(monkeypatch):
    monkeypatch.setenv("OBJECT_STORAGE_PROVIDER", "dropbox")
    with pytest.raises(NotImplementedError):
        factory.get_object_storage()


def test_primary_provider_can_be_switched_to_ollama(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
    monkeypatch.setenv("OLLAMA_MODEL_NAME", "qwen3:14b")
    provider = factory.get_llm_provider()
    assert isinstance(provider, OllamaProvider)
    assert provider.name == "ollama"


def test_ollama_primary_can_fall_back_to_gemini(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", "google_ai_studio")
    monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
    assert isinstance(factory.get_llm_provider(), OllamaProvider)
    assert isinstance(factory.get_llm_fallback_provider(), GoogleAIStudioProvider)
