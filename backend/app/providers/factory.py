"""Wires configured settings to concrete LLMProvider instances.

Call sites ask this factory for a provider — never import
GoogleAIStudioProvider/MistralProvider directly — so a future third
provider (or a swap) is "a new file behind app.providers.factory, no
service-layer change" (claude/llm-provider-alternatives-2026-09-17.md).
"""
from __future__ import annotations

from functools import lru_cache

from app.config.settings import Settings, get_settings
from app.providers.base import LLMProvider, LLMUnavailableError
from app.providers.budget import DailyBudgetGuard
from app.providers.google_ai_studio_provider import GoogleAIStudioProvider
from app.providers.mistral_provider import MistralProvider


def _build_provider(name: str, settings: Settings) -> LLMProvider:
    if name == "google_ai_studio":
        return GoogleAIStudioProvider(
            api_key=settings.google_ai_studio_api_key or "",
            model=settings.llm_model_name,
            temperature=settings.llm_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
            rpm=settings.llm_rate_limit_rpm,
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
