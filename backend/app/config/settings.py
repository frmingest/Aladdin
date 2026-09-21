"""Application settings.

Sprint 0: FastAPI skeleton config, plus Gemini/Mistral LLM provider wiring
(google_ai_studio primary, mistral fallback — see app/providers/). Rate
limit and budget defaults are carried over from the pre-reset app's own
tuning against Google/Mistral's real free tiers, not fresh guesses — see
claude/gemini-daily-budget-guard-2026-09-16.md,
claude/mistral-fallback-provider-2026-09-17.md, and
claude/llm-usage-ledger-and-rate-limit-estimation.md. Sprint 3 adds the
valuation engine's market-data/risk-free-rate provider config (see
app/providers/yfinance_provider.py, app/providers/fred_risk_free_rate_provider.py).
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

    # --- Object storage (see app/providers/object_storage.py) ---
    # "local" (default, dev only — Railway's disk is ephemeral, not a real
    # deployment option) | "s3" (any S3-compatible bucket: Cloudflare R2,
    # or Supabase Storage's own S3-compatible API).
    object_storage_provider: str = "local"
    object_storage_bucket: str = "aladdin-documents"
    object_storage_local_path: str = "./storage"
    object_storage_endpoint_url: str | None = None
    object_storage_region: str = "auto"
    object_storage_access_key_id: str | None = None
    object_storage_secret_access_key: str | None = None

    max_upload_size_mb: int = 25

    # --- Live research (Sprint 2, see app/providers/gemini_research_provider.py) ---
    # Qualitative macro/sector/company research via Gemini + Google Search
    # grounding — reuses google_ai_studio_api_key above, no separate key.
    # "none" disables the feature outright (get_research_provider() raises).
    research_provider: str = "gemini_search"  # "gemini_search" | "none"
    active_research_prompt_version: str = "v1"
    # A COMPLETED run older than this triggers a fresh grounded-search call
    # on the next GET; younger than this, the cached research_items are
    # served as-is (the run record itself is the cache — see
    # app/services/research/common.py).
    research_stale_after_hours: int = 24

    # --- Valuation engine (Sprint 3, see app/providers/yfinance_provider.py,
    # app/providers/fred_risk_free_rate_provider.py) ---
    market_data_provider: str = "yfinance"  # "yfinance" is the only option so far
    market_data_stale_after_hours: int = 24
    risk_free_rate_provider: str = "fred"  # "fred" is the only option so far
    fred_api_key: str | None = None
    active_risk_free_rate_series_version: str = "v1"
    risk_free_rate_stale_after_hours: int = 24
    # ERP / terminal growth / scenario offsets — app/domain/valuation_assumptions/.
    active_valuation_assumptions_version: str = "v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
