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

    # --- Ingestion (§6.1 file validation) ---
    max_upload_size_mb: int = 25

    # --- AI provider (§26 Phase 3 — switched from the architecture's original
    # Anthropic recommendation to Google AI Studio's free tier, see
    # docs/decisions/0005-phase3-google-ai-studio-llm-provider.md) ---
    llm_provider: str = "google_ai_studio"  # google_ai_studio | stub
    google_ai_studio_api_key: str = ""
    llm_model_name: str = "gemini-2.5-flash"
    llm_max_output_tokens: int = 8192
    llm_temperature: float = 0.2
    # Naive evidence-packet excerpt budget (§5.3) — total characters of
    # document_chunk text included per holding analysis. No relevance
    # ranking yet (decision 0006); this just caps prompt size/cost.
    llm_excerpt_char_budget: int = 12000

    # --- Market data provider (§29 resolved in Phase 2 — see
    # docs/decisions/0004-phase2-market-data-and-financial-metrics.md) ---
    market_data_provider: str = "yfinance"  # yfinance | stub

    # --- External research (§26 Phase 4 — see
    # docs/decisions/0007-phase4-external-research.md) ---
    # Central-bank/macro numeric data (§9.1). "fred_norges_bank" routes each
    # registered series (app.domain.macro_series) to whichever of the two
    # vendor providers the registry says owns it.
    macro_data_provider: str = "fred_norges_bank"  # fred_norges_bank | stub
    fred_api_key: str = ""
    active_macro_series_version: str = "v1"

    # Qualitative macro/world-news and sector research (§9.2/§9.3) — resolves
    # the §29 "Research provider" open question for Phase 4. Reuses the
    # already-configured Google AI Studio key/model (decision 0005) with
    # Gemini's Google Search grounding tool rather than a second vendor
    # account.
    research_provider: str = "gemini_search"  # gemini_search | stub
    research_max_grounded_items: int = 8
    # Independent of active_prompt_version (the analysis persona) — these
    # templates live under prompts/research/ and version on their own.
    active_research_prompt_version: str = "v1"

    # §2.7 "cache aggressively" / §9.1 "refresh approximately daily" / §9.3
    # "cached for a rolling period" — a refresh is skipped (the most recent
    # completed research_runs row is reused) until its age exceeds these.
    macro_refresh_interval_hours: int = 24
    sector_research_refresh_interval_days: int = 7

    # APScheduler background jobs (§4) driving the two intervals above.
    # Disabled in tests (see tests/__init__.py) so the test suite never opens
    # a real scheduler thread or makes a live provider call on import.
    enable_scheduler: bool = True

    # --- Reporting ---
    default_reporting_currency: str = "NOK"

    # --- Versioning (persona/scoring/schema — see docs/architecture.md §2.4) ---
    active_prompt_version: str = "v1"
    active_scoring_version: str = "v1"
    active_extraction_schema_version: str = "v1"
    active_macro_regime_profile: str = "baseline"  # baseline | stagflation | crisis — see §13.1

    # --- Thesis & portfolio intelligence (§26 Phase 5) ---
    # app.domain.portfolio_risk's composite-risk-score weights/band thresholds
    # (scoring/versions/{version}.yaml, same file naming convention as
    # active_scoring_version but a distinct version namespace — see decision
    # 0008) and app.domain.scenarios' shock registry (scenarios/versions/).
    active_risk_scoring_version: str = "risk_v1"
    active_scenario_version: str = "v1"
    # §17 — the LLM critiques valuation assumptions; the deterministic DCF
    # calculation itself (app.domain.valuation) never depends on this.
    active_valuation_prompt_version: str = "v1"

    # §15.1 systemic/state risk — deterministic, jurisdiction-specific
    # constants. Only Norway is implemented (matches Faiz's own portfolio and
    # the architecture's single-user, NOK-reporting scope); a holding whose
    # institution isn't recognized as Norwegian is simply excluded from the
    # wealth-tax estimate rather than guessed at (§21).
    deposit_guarantee_limit_nok: int = 2_000_000  # Norwegian Banks' Guarantee Fund, per institution
    # Norwegian formuesskatt (wealth tax), 2024 rules: combined state+
    # municipal rate above the bunnfradrag (basic allowance), with a
    # skjermingsfradrag-style discount on listed shares/funds (currently 20%
    # of market value is exempt from the tax base — "the taxable value of
    # shares is 80% of market value"). This is a simplification (real rules
    # have a second, higher bracket and per-couple splitting) documented as a
    # known gap, not a tax-advice claim (§25 non-goals).
    wealth_tax_bunnfradrag_nok: int = 1_700_000
    wealth_tax_rate_pct: float = 1.1
    wealth_tax_share_discount_pct: float = 20.0


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — import and call this, don't instantiate Settings() directly."""
    return Settings()
