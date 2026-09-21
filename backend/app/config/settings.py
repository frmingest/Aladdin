"""Application settings.

Sprint 0: FastAPI skeleton config, plus Gemini/Mistral LLM provider wiring
(google_ai_studio primary, mistral fallback — see app/providers/). Rate
limit and budget defaults are carried over from the pre-reset app's own
tuning against Google/Mistral's real free tiers, not fresh guesses — see
claude/gemini-daily-budget-guard-2026-09-16.md,
claude/mistral-fallback-provider-2026-09-17.md, and
claude/llm-usage-ledger-and-rate-limit-estimation.md.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    database_url: str | None = None

    app_name: str = "aladdin-backend"
    app_version: str = "0.1.0"

    # --- LLM provider (see app/providers/) ---
    llm_provider: str = "google_ai_studio"  # "google_ai_studio" | "mistral"
    google_ai_studio_api_key: str | None = None
    llm_model_name: str = "gemini-3.6-flash"
    llm_max_output_tokens: int = 8192
    llm_temperature: float = 0.2

    # Free-tier rate limits for llm_model_name. Hand-maintained — no API
    # exposes a free-tier AI Studio key's quota (see
    # claude/llm-usage-ledger-and-rate-limit-estimation.md). Defaults match
    # gemini-3.6-flash's free tier as observed 2026-09-14/17.
    llm_rate_limit_rpm: int = 5
    llm_rate_limit_tpm: int = 250_000
    llm_rate_limit_rpd: int = 20

    # Fallback provider, reached once the primary's daily budget is spent
    # (see claude/llm-provider-alternatives-2026-09-17.md and
    # claude/mistral-fallback-provider-2026-09-17.md). "none" is fully inert
    # — the default, so nothing changes until this is explicitly set.
    llm_fallback_provider: str = "none"  # "none" | "mistral"
    mistral_api_key: str | None = None
    mistral_model_name: str = "mistral-small-latest"
    mistral_rate_limit_rpm: int = 30  # conservative default, not vendor-confirmed


@lru_cache
def get_settings() -> Settings:
    return Settings()
