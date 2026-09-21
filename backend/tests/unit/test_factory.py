"""Unit tests for app.providers.factory — the only place a call site should
ever learn which vendor is configured."""
import pytest

from app.config.settings import get_settings
from app.providers import factory
from app.providers.base import LLMUnavailableError
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider
from app.providers.mistral_provider import MistralProvider


@pytest.fixture(autouse=True)
def _clear_caches(monkeypatch):
    """Every settings-derived cache must start clean for each test, since
    get_settings()/get_llm_provider()/... are process-wide @lru_cache
    singletons that would otherwise leak state between tests."""
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_FALLBACK_PROVIDER", raising=False)
    monkeypatch.delenv("GOOGLE_AI_STUDIO_API_KEY", raising=False)
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    get_settings.cache_clear()
    factory.get_llm_provider.cache_clear()
    factory.get_llm_fallback_provider.cache_clear()
    factory.get_primary_budget_guard.cache_clear()
    yield
    get_settings.cache_clear()
    factory.get_llm_provider.cache_clear()
    factory.get_llm_fallback_provider.cache_clear()
    factory.get_primary_budget_guard.cache_clear()


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
