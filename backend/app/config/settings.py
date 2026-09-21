"""Application settings (Sprint 0 skeleton — healthcheck only).

Deliberately minimal: this reads only what the skeleton app needs to start
and report its own health. LLM provider settings (Gemini/Mistral) are added
in a later pass once MISTRAL_API_KEY is actually present in backend/.env
(see CLAUDE.md status-honesty rule — don't wire what isn't configured yet).
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
