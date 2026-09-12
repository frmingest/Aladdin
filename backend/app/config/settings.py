"""
Centralized application configuration.

Per architecture §4/§28: configuration lives in environment variables and
versioned YAML/JSON, never hardcoded. Secrets are never committed — see
.env.example for the required keys and copy it to .env locally.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Application ---
    app_name: str = "Aladdin"
    application_version: str = "0.1.0"
    environment: str = "development"  # development | production
    log_level: str = "INFO"

    # --- Database ---
    database_url: str = "postgresql://aladdin:aladdin@localhost:5432/aladdin"

    # --- Object storage ---
    object_storage_provider: str = "local"  # local | supabase | r2
    object_storage_bucket: str = "aladdin-documents"
    object_storage_local_path: str = "./storage"

    # --- AI provider ---
    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # --- Market data provider ---
    market_data_provider: str = "stub"  # stub until §29 open question is resolved

    # --- Research provider ---
    research_provider: str = "stub"

    # --- Reporting ---
    default_reporting_currency: str = "NOK"

    # --- Versioning (persona/scoring/schema — see docs/architecture.md §2.4) ---
    active_prompt_version: str = "v1"
    active_scoring_version: str = "v1"
    active_extraction_schema_version: str = "v1"
    active_macro_regime_profile: str = "baseline"  # baseline | stagflation | crisis — see §13.1


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — import and call this, don't instantiate Settings() directly."""
    return Settings()
