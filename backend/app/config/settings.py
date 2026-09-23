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
    llm_provider: str = "google_ai_studio"  # "google_ai_studio" | "mistral" | "ollama"
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
    llm_fallback_provider: str = "none"  # "none" | "mistral" | "google_ai_studio" | "ollama"
    mistral_api_key: str | None = None
    mistral_model_name: str = "mistral-small-latest"
    mistral_rate_limit_rpm: int = 30  # conservative default, not vendor-confirmed

    # --- Local LLM via Ollama (2026-09-23, app/providers/ollama_provider.py,
    # docs/local-llm-ollama-setup.md). Used when LLM_PROVIDER=ollama: the
    # heavy analysis passes run on your own GPU; Gemini keeps the light,
    # search-grounded research. Defaults are sized for a 12GB card
    # (RTX 3060 12GB) running qwen3:14b with OLLAMA_KV_CACHE_TYPE=q8_0.
    ollama_base_url: str = "http://localhost:11434"
    ollama_model_name: str = "qwen3:14b"
    ollama_num_ctx: int = 16384
    ollama_keep_alive: str = "30m"
    ollama_timeout_seconds: float = 900.0
    # False = ask thinking models (Qwen3) to skip the <think> phase, which
    # is much faster and doesn't help schema-constrained JSON. None = don't
    # send the field at all.
    ollama_think: bool | None = False
    # Only when Ollama sits behind an authenticating proxy/tunnel. Plain
    # Ollama has no auth — never expose port 11434 to the internet.
    ollama_api_key: str | None = None

    # --- Local analysis worker (Sprint 5B / F8 + F5, app/worker/) ---
    # `python -m app.worker` on the PC claims runs queued with engine=local
    # from the shared database and runs them here. Nothing listens for
    # inbound connections; Railway never learns the Ollama URL.
    worker_id: str | None = None  # default: the machine's hostname
    worker_llm_provider: str = "ollama"  # the LLM the worker runs the passes on
    worker_poll_seconds: int = 30  # how often an idle worker looks for work
    worker_heartbeat_seconds: int = 30
    # A RUNNING local run whose worker hasn't been seen for this long is
    # released: re-queued, or FAILED once it has been claimed
    # worker_max_attempts times.
    worker_lease_minutes: int = 30
    worker_max_attempts: int = 2
    # A worker counts as "online" in the UI if seen within this window.
    worker_online_seconds: int = 120

    # --- Object storage (see app/providers/object_storage.py) ---
    # "local" (default, dev only — Railway's disk is ephemeral, not a real
    # deployment option) | "s3" / "r2" / "supabase" — all three build the
    # same S3-compatible client (Cloudflare R2 or Supabase Storage's own
    # S3-compatible API); "r2"/"supabase" are accepted as aliases so naming
    # the actual vendor here doesn't 500 (see app/providers/factory.py).
    object_storage_provider: str = "local"
    object_storage_bucket: str = "aladdin-documents"
    object_storage_local_path: str = "./storage"
    object_storage_endpoint_url: str | None = None
    object_storage_region: str = "auto"
    object_storage_access_key_id: str | None = None
    object_storage_secret_access_key: str | None = None

    max_upload_size_mb: int = 25
    # ESEF annual reports (.xhtml) embed their fonts and images as base64,
    # so a full-year report is typically 20-60 MB (Vår Energi 2025: 36 MB).
    max_ixbrl_upload_size_mb: int = 80

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

    # --- Primary-source filings (2026-09-22, app/providers/sec_edgar_provider.py,
    # app/providers/newsweb_provider.py) — both keyless and free. ---
    fundamentals_provider: str = "sec_edgar"  # "sec_edgar" | "none"
    # SEC fair-access policy requires a descriptive User-Agent with a contact
    # email, e.g. "Aladdin portfolio app you@example.com". Unset = EDGAR
    # imports fail visibly with a message saying so.
    sec_edgar_user_agent: str | None = None
    sec_edgar_max_years: int = 10
    announcements_provider: str = "newsweb"  # "newsweb" | "none"
    announcements_lookback_days: int = 365
    # How many of the most recent announcements go into the analysis
    # evidence packet (all are still stored and shown in the UI).
    announcements_in_evidence_packet: int = 15

    # --- Analysis engine (Sprint 4, see app/services/analysis/) ---
    # Two-pass Buffett/Munger analysis: a blind pass (evidence only, no
    # user notes — CLAUDE.md Rule 4) followed by a reconciliation pass
    # (blind output + the holding's own notes, if any).
    active_analysis_schema_version: str = "v1"  # app/domain/analysis_schema/
    active_analysis_prompt_version: str = "v1"  # prompts/analysis/{blind,reconciliation}_vN.md
    active_analysis_assumptions_version: str = "v1"  # app/domain/analysis_assumptions/


@lru_cache
def get_settings() -> Settings:
    return Settings()
