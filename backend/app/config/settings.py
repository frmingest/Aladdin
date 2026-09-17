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
    object_storage_provider: str = "local"  # local | r2 | supabase
    object_storage_bucket: str = "aladdin-documents"
    object_storage_local_path: str = "./storage"
    # Only used by object_storage_provider in {r2, supabase} — both expose an
    # S3-compatible API (see docs/decisions/0010), so one provider class
    # serves either, distinguished only by these connection settings.
    # R2: https://<account_id>.r2.cloudflarestorage.com, region "auto".
    # Supabase Storage: https://<project_ref>.supabase.co/storage/v1/s3,
    # region matches the project's region.
    object_storage_endpoint_url: str = ""
    object_storage_region: str = "auto"
    object_storage_access_key_id: str = ""
    object_storage_secret_access_key: str = ""

    # --- Ingestion (§6.1 file validation) ---
    max_upload_size_mb: int = 25

    # --- Application access (§24 "authenticate application access") ---
    # Empty disables auth (local dev/tests, matching this codebase's existing
    # "fail loudly only once configured" convention for optional secrets —
    # e.g. google_ai_studio_api_key/fred_api_key above). Deploying with a
    # public URL requires setting this — see docs/decisions/0010.
    app_auth_token: str = ""
    # Comma-separated list of allowed browser origins for CORS, e.g.
    # "https://aladdin-frontend.up.railway.app". Empty means no cross-origin
    # requests are allowed — fine when frontend/backend share an origin
    # (local dev's Vite proxy), required once they're separate Railway
    # services (see docs/decisions/0010).
    cors_allowed_origins: str = ""

    # --- AI provider (§26 Phase 3 — switched from the architecture's original
    # Anthropic recommendation to Google AI Studio's free tier, see
    # docs/decisions/0005-phase3-google-ai-studio-llm-provider.md) ---
    llm_provider: str = "google_ai_studio"  # google_ai_studio | stub
    google_ai_studio_api_key: str = ""
    # Was "gemini-2.5-flash" (ADR 0005's original pick) until 2026-09-14, when
    # it started 404ing for this account with "no longer available to new
    # users" — see ADR 0005's Update section. ADR 0005 flagged this default as
    # something to revisit as free-tier model availability changes, not a
    # permanently-correct choice; revisit again if this one is retired too.
    llm_model_name: str = "gemini-3.6-flash"
    llm_max_output_tokens: int = 8192
    llm_temperature: float = 0.2
    # Naive evidence-packet excerpt budget (§5.3) — total characters of
    # document_chunk text included per holding analysis. No relevance
    # ranking yet (decision 0006); this just caps prompt size/cost.
    llm_excerpt_char_budget: int = 12000

    # --- LLM usage ledger & free-tier rate-limit estimation (§28
    # observability follow-up — see docs/decisions/0013-llm-usage-ledger-and-
    # rate-limit-estimation.md). Every real Gemini call (analysis + research)
    # is recorded in llm_usage_events (app.models.llm_usage) straight from
    # the vendor's own usage_metadata; app.services.usage compares that
    # ledger against these three limits to estimate "how many more holding
    # analyses today". They are NOT fetched from Google — no public API
    # exposes a free-tier AI Studio key's quota/usage (see the ADR) — so keep
    # them in sync by hand with whatever aistudio.google.com/usage shows for
    # llm_model_name's tier; defaults below match gemini-3.6-flash's free
    # tier as observed 2026-09-14.
    llm_rate_limit_rpm: int = 5
    llm_rate_limit_tpm: int = 250_000
    llm_rate_limit_rpd: int = 20
    # Calibration baseline for the "how many analyses can we run" estimate
    # before the ledger has any real history of its own (it can't — this
    # feature postdates every analysis run so far). Seeded from Faiz's first
    # real run — Vår Energi: 3 documents / 280 pages, single blind-pass call
    # (no thesis/notes on file yet to trigger a reconciliation pass) — per
    # Google AI Studio's own usage dashboard. app.services.usage prefers the
    # real historical average over this fallback the moment any
    # ANALYSIS_BLIND/ANALYSIS_RECONCILIATION events exist.
    llm_baseline_input_tokens: int = 5870
    llm_baseline_output_tokens: int = 1484

    # --- Fallback LLM provider (§29, 2026-09-17 — see claude/llm-provider-
    # alternatives-2026-09-17.md project doc for the full comparison against
    # local Ollama and other alternatives). Used only by
    # app.services.analysis.runner when Gemini's daily free-tier request
    # budget (llm_rate_limit_rpd) is exhausted mid-run — a holding that would
    # otherwise be skipped gets a real analysis from a second provider
    # instead. "none" (the default) preserves the original skip-on-
    # exhaustion behavior; nothing changes for the primary/normal case
    # either way. Gemini remains the default *primary* provider (llm_provider
    # above) — this never replaces it, only fills the gap once it's spent.
    llm_fallback_provider: str = "none"  # none | mistral
    mistral_api_key: str = ""
    mistral_model_name: str = "mistral-small-latest"
    # Assumed conservative default, NOT vendor-confirmed (Mistral doesn't
    # publish a fixed free-tier RPM the way Google AI Studio's usage
    # dashboard does — see the alternatives doc's Option 2 table). Faiz:
    # check https://console.mistral.ai/ for your account's actual limit and
    # adjust; 0 disables pacing entirely. Reuses llm_max_output_tokens/
    # llm_temperature above rather than a second pair of knobs — both
    # providers serve the same two-pass analysis prompts
    # (app.services.analysis.llm_analysis), just with different vendors
    # underneath.
    mistral_rate_limit_rpm: int = 30

    # --- Market data provider (§29 resolved in Phase 2 — see
    # docs/decisions/0004-phase2-market-data-and-financial-metrics.md) ---
    market_data_provider: str = "yfinance"  # yfinance | stub
    # Phase 8 (ADR 0011) — physical gold/silver pricing (XAU/XAG), composed
    # behind market_data_provider (see app.providers.composite_market_provider)
    # rather than a third market_data_provider value, since it only ever
    # affects the two commodity tickers and leaves every other ticker's
    # routing untouched. "none" disables it (a COMMODITY holding then simply
    # has no market_ticker route, same as any other unpriced holding).
    commodity_price_provider: str = "gold_api"  # gold_api | none
    gold_api_base_url: str = "https://api.gold-api.com/price"

    # --- External research (§26 Phase 4 — see
    # docs/decisions/0007-phase4-external-research.md) ---
    # Central-bank/macro numeric data (§9.1). "fred_norges_bank" routes each
    # registered series (app.domain.macro_series) to whichever of the two
    # vendor providers the registry says owns it.
    macro_data_provider: str = "fred_norges_bank"  # fred_norges_bank | stub
    fred_api_key: str = ""
    # v2 adds commodity (WTI/Brent oil) and Eurozone/China coverage (ECON-003/
    # ECON-004 fixes, docs/decisions/0014) — v1 remains loadable (and is what
    # any pre-v2 macro_observations/analysis_runs row is still interpreted
    # against) for reproducibility (§2.4), it's just no longer the default.
    active_macro_series_version: str = "v2"

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
    # v2 adds an explicit requirement to engage with macro/FX evidence when
    # it's present (ECON-006 fix, docs/decisions/0014) — v1 remains loadable
    # (and is what any pre-v2 analysis_runs row is still interpreted against)
    # for reproducibility (§2.4), it's just no longer the default.
    # v3 adds an explicit prompt-injection guardrail (hard rule 9): evidence
    # `content` excerpts are untrusted document text, not instructions — see
    # docs/decisions/0015-agentic-coding-and-ai-safety-guardrails.md. No
    # change to what the model is asked to assess or the output schema, so
    # this is a low-risk default bump; v1/v2 remain loadable for
    # reproducibility of pre-v3 analysis_runs rows.
    active_prompt_version: str = "v3"
    # v2 adds regime-conditional factor weights (ECON-002 fix, docs/
    # decisions/0014) — app.domain.scoring.classify_macro_regime picks the
    # profile per run from the latest macro snapshot; v1 remains loadable
    # (and is what any pre-v2 analysis_runs row is still interpreted
    # against) for reproducibility (§2.4), it's just no longer the default.
    active_scoring_version: str = "v2"
    active_extraction_schema_version: str = "v1"

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
    # ECON-001 fix (docs/decisions/0014) — app.domain.discount_rate's
    # currency->risk-free-series mapping and equity risk premium constant.
    # Powers a *suggestion* only (GET /valuation/holdings/{id}/defaults);
    # compute_dcf_value never depends on this either.
    active_discount_rate_version: str = "v1"

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
