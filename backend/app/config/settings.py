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

    # --- Access gate (2026-09-27, app/security.py -- see
    # claude/agentic-coding-audit-2026-09-27.md finding #1/#2) ---
    # Unset by default (local dev, CI): every endpoint stays exactly as
    # open as before this change, since nothing here reads it. Set in
    # Railway to require every request (except /health) to carry a
    # matching X-API-Key header. This is *not* real access control -- the
    # key ships in the frontend's built JS bundle (frontend/.env.example),
    # readable by anyone who opens dev tools -- it's a minimal gate against
    # stray/automated requests hitting a public backend URL (bots,
    # scanners, crawlers hammering a real financial-data API), not a
    # defense against a targeted attacker. Must match the frontend's
    # VITE_API_KEY exactly.
    app_auth_token: str | None = None
    # Comma-separated list of origins allowed to call this API
    # cross-origin. Local dev never needs this -- Vite's dev-server proxy
    # (frontend/vite.config.ts) makes /api same-origin -- so this only
    # matters for the real browser->backend call in production. Defaults
    # to the one known deployed frontend origin (see claude/progress.md)
    # rather than "*"; override to add another origin (a custom domain, a
    # second frontend) without a code change.
    cors_allowed_origins: str = "https://exciting-gratitude-production-71b5.up.railway.app"

    # --- LLM provider (see app/providers/) ---
    llm_provider: str = "google_ai_studio"  # "google_ai_studio" | "mistral" | "ollama"
    google_ai_studio_api_key: str | None = None
    llm_model_name: str = "gemini-3.6-flash"
    llm_max_output_tokens: int = 8192
    # A fund/ETF blind pass answers `fund_v1` (app/domain/analysis_schema/
    # fund_v1.py) -- 7 sections vs equity v1's 6, one more full narrative
    # section (`role_in_portfolio`) -- so it needs more room than the shared
    # default above. Discovered 2026-09-27: qwen3:14b hit the 8192-token
    # default mid-JSON on a real fund holding (XDEF.DE) and the app refused
    # the truncated output rather than accept it (CLAUDE.md Rule 2). Wired
    # in app/services/analysis/blind_pass.py via is_fund_schema(), applied
    # to every provider (LLMProvider.generate_structured's optional
    # `max_output_tokens` override) -- not just Ollama, since the cap is
    # schema-shaped, not provider-shaped.
    llm_max_output_tokens_fund: int = 16384
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
    # 24576, not 16384 (2026-09-27): a fund pass now asks for up to
    # llm_max_output_tokens_fund (16384) tokens of output, and num_ctx is
    # Ollama's *combined* prompt+generation budget -- 16384 left no room
    # for a real evidence-packet prompt alongside a full-length fund
    # output. Still comfortable on a 12GB card with OLLAMA_KV_CACHE_TYPE=
    # q8_0 (see docs/local-llm-ollama-setup.md).
    ollama_num_ctx: int = 24576
    ollama_keep_alive: str = "30m"
    # Calls stream (2026-09-25): OLLAMA_TIMEOUT_SECONDS caps one whole pass
    # (wall clock); OLLAMA_STALL_TIMEOUT_SECONDS is the longest wait for the
    # next chunk — mostly model load + reading a 16k-token prompt.
    ollama_timeout_seconds: float = 1800.0
    ollama_stall_timeout_seconds: float = 600.0
    # A pass stops within seconds (instead of after OLLAMA_TIMEOUT_SECONDS)
    # when less than this fraction of the model is in VRAM -- a partly-CPU
    # model runs several times slower (2026-09-29, ETLX.DE: 78% on GPU,
    # 3.5 tokens/s, timed out after 30 min). 0 disables the check.
    ollama_min_gpu_share: float = 0.95
    # 2026-09-30: instead of failing a pass at the first token when the model
    # spills to the CPU, plan before the pass: pick the smallest context that
    # holds the prompt + output, load the model at it, and use it only if it
    # is >= ollama_min_gpu_share in VRAM; else try the smaller fallback model
    # (qwen3:8b, ~5 GB, fits with room to spare). "" = no fallback model.
    ollama_adaptive_fit: bool = True
    ollama_fallback_model_name: str = "qwen3:8b"
    # The fallback model is small enough for a bigger context than the main
    # one (qwen3:8b at 32k needs ~8 GB incl. KV cache), so big evidence packets
    # run on it instead of failing.
    ollama_fallback_num_ctx: int = 32768
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
    # Sprint 15 #5: the worker runs the nightly tripwire check once per UTC
    # day, on its first poll after this hour (03:00 UTC = 05:00 Oslo in
    # summer, 04:00 in winter — after the Oslo/EU close and the FX fixings).
    tripwire_check_enabled: bool = True
    tripwire_check_hour_utc: int = 3

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
    # so a full-year report is typically 20-100 MB (Vår Energi 2025: 36 MB,
    # Orkla 2025: 99 MB). The limit is on the file as uploaded; intake then
    # strips the embedded images/fonts before storing and parsing it
    # (app/services/documents/extraction/ixbrl_slim.py), so what is stored
    # and parsed is usually a few MB.
    max_ixbrl_upload_size_mb: int = 250

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
    # Fallback for get_research_provider() when the primary provider raises
    # ResearchUnavailableError — most commonly Gemini's daily search-request
    # budget guard tripping on a portfolio with more sectors/holdings than
    # llm_rate_limit_rpd allows in one sitting (app/providers/budget.py).
    # "none" (default) keeps the pre-fallback behavior: get_or_refresh()
    # falls back to stale cached research on its own; "tavily" tries
    # app/providers/tavily_research_provider.py next, a free-tier
    # (1,000 searches/month, no card) search-for-agents API.
    research_fallback_provider: str = "none"  # "none" | "tavily"
    tavily_api_key: str | None = None

    # --- Valuation engine (Sprint 3, see app/providers/yfinance_provider.py,
    # app/providers/fred_risk_free_rate_provider.py) ---
    market_data_provider: str = "yfinance"  # "yfinance" is the only option so far
    market_data_stale_after_hours: int = 24
    risk_free_rate_provider: str = "fred"  # "fred" is the only option so far
    fred_api_key: str | None = None
    active_risk_free_rate_series_version: str = "v1"
    risk_free_rate_stale_after_hours: int = 24
    # ERP / terminal growth / scenario offsets — app/domain/valuation_assumptions/.
    # v2 (2026-09-29) adds the plausibility guardrails and the financials method.
    active_valuation_assumptions_version: str = "v2"

    # --- Regime-adjusted DCF (Sprint 14, 2026-09-26, app/domain/regime_adjustments/) ---
    # Off by default: wiring Sprint 12's macro regime (app/services/risk/regime.py)
    # into the DCF discount rate is a real behavior change to every valuation
    # in the app — Sprint 12 explicitly deferred it as Faiz's call rather than
    # switching it on silently in the same sprint that introduced the regime
    # signal. When true, every DCF's discount rate gets a per-regime add-on
    # from active_regime_adjustment_version
    # (app/services/valuation/holding_valuation.py).
    regime_adjusted_dcf_enabled: bool = False
    active_regime_adjustment_version: str = "v1"

    # --- Portfolio risk (Sprint 12, 2026-09-26, app/services/risk/) ---
    # Daily price history used for correlation/stress is cached per ticker
    # (app/models/risk.py's PriceHistoryObservation) and only re-fetched
    # from yfinance when the cached rows are older than this.
    risk_price_history_stale_after_hours: int = 24
    # 1 year of daily returns — long enough to average out single-name
    # noise, short enough to reflect the current correlation regime rather
    # than a stale one from years ago (app/services/risk/correlation.py).
    risk_correlation_lookback_days: int = 365
    # |correlation| at or above this, between two of the largest holdings,
    # is flagged as a correlated risk cluster (app/services/risk/correlation.py).
    risk_cluster_correlation_threshold: str = "0.6"
    # Stress shock size in standard deviations of the historical daily
    # return distribution, scaled to an annualized-ish shock (see
    # app/services/risk/stress.py's docstring for the exact scaling).
    risk_stress_shock_std_devs: str = "2"

    # --- Portfolio performance (Sprint 13, 2026-09-27, app/services/performance/) ---
    # Reuses PriceHistoryObservation (Sprint 12) for tickers, FX pairs and the
    # benchmark index alike — no dedicated staleness setting needed here.
    performance_lookback_days_default: int = 365
    performance_max_lookback_days: int = 730  # yfinance daily history tops out around 2y in practice
    # Oslo Børs Benchmark Index (yfinance ticker) — a reasonable default for a
    # NOK-denominated, largely Oslo-listed portfolio. Override per-request via
    # GET /performance/portfolio?benchmark=... (e.g. "^GSPC" for the S&P 500).
    performance_default_benchmark_ticker: str = "OSEBX.OL"

    # --- Precious metals (2026-09-26, app/services/precious_metals/) ---
    # gold-api.com's current-price endpoint is free/keyless with no
    # documented rate limit, but there's still no reason to hit it on
    # every page load -- refreshed at most this often, same staleness
    # discipline as every other live price in the app.
    precious_metals_price_stale_after_hours: int = 6
    # How much accumulated spot-price history to serve on the price chart.
    # There is no backfill (gold-api.com's historical endpoint isn't free)
    # -- this just caps how far back a request looks into what's been
    # organically cached since the feature was turned on.
    precious_metals_price_history_days_default: int = 365

    # --- Numeric macro data (2026-09-24, app/services/macro/) ---
    # Norges Bank + SSB are keyless; FRED reuses fred_api_key above.
    # "live" | "none" ("none" = no fetching; stored values are still shown).
    macro_data_provider: str = "live"
    active_macro_series_version: str = "v2"  # app/domain/macro_series.py
    # A series whose last successful fetch is older than this is refreshed
    # before an analysis builds its evidence packet (best effort).
    macro_stale_after_hours: int = 20
    # In-process refresh loop in the API server; 0 turns it off.
    macro_refresh_interval_hours: int = 12
    macro_history_years: int = 3

    # --- Primary-source filings (2026-09-22, app/providers/sec_edgar_provider.py,
    # app/providers/newsweb_provider.py) — both keyless and free. ---
    fundamentals_provider: str = "sec_edgar"  # "sec_edgar" | "none"
    # SEC fair-access policy requires a descriptive User-Agent with a contact
    # email, e.g. "Aladdin portfolio app you@example.com". Unset = EDGAR
    # imports fail visibly with a message saying so.
    sec_edgar_user_agent: str | None = None
    sec_edgar_max_years: int = 10
    # ESEF history import (Sprint 10, app/providers/esef_index_provider.py):
    # XBRL International's free filings.xbrl.org index, by LEI, no key.
    esef_index_provider: str = "filings_xbrl_org"  # "filings_xbrl_org" | "none"
    esef_index_max_filings: int = 5  # newest N filings per import (+1 comparative year)
    esef_index_timeout_seconds: float = 60.0
    announcements_provider: str = "newsweb"  # "newsweb" | "none"
    announcements_lookback_days: int = 365
    # How many of the most recent announcements go into the analysis
    # evidence packet (all are still stored and shown in the UI).
    announcements_in_evidence_packet: int = 15
    # Newsweb annual-report *filing* fetch (Sprint 15, 2026-09-26):
    # downloads the actual ESEF attachment (unzipping it if needed) and
    # runs it through the same iXBRL extractor an upload uses, instead of
    # only reading announcement metadata. Keyless, same host as above.
    newsweb_filing_provider: str = "newsweb"  # "newsweb" | "none"
    newsweb_filing_lookback_days: int = 730  # ~2 years, wide enough to always catch the latest annual report
    newsweb_filing_timeout_seconds: float = 30.0
    newsweb_filing_max_download_mb: int = 300  # the raw .zip/.xhtml attachment as downloaded
    # "Fetch every available year" (2026-09-26, Faiz's ask): an absolute
    # calendar year, not a rolling day-count like newsweb_filing_lookback_days
    # above, so the window always reaches this far back no matter how much
    # later "today" is. 2022 is Faiz's own backstop for "around when ESEF/
    # iXBRL annual-report tagging started in Norway" — Oslo Børs issuers
    # generally began publishing ESEF-tagged annual reports on Newsweb from
    # FY2020/FY2021 onward, so 2022 comfortably covers what's actually there.
    newsweb_filing_history_start_year: int = 2022

    # --- Analysis engine (Sprint 4, see app/services/analysis/) ---
    # Two-pass Buffett/Munger analysis: a blind pass (evidence only, no
    # user notes — CLAUDE.md Rule 4) followed by a reconciliation pass
    # (blind output + the holding's own notes, if any).
    active_analysis_schema_version: str = "v1"  # app/domain/analysis_schema/
    active_analysis_prompt_version: str = "v2"  # prompts/analysis/{blind,reconciliation}_vN.md (v2: document excerpts)
    active_analysis_assumptions_version: str = "v1"  # app/domain/analysis_assumptions/
    # Sprint 6: uploaded-document passages in the evidence packet
    # (app/services/analysis/document_excerpts.py). ~4,000 tokens fits the
    # local qwen3:14b 16k window next to figures and research (decision 22).
    evidence_document_token_budget: int = 4000
    evidence_document_max_excerpt_chars: int = 1600
    evidence_documents_max: int = 4
    # Sprint 8 (F9): the fund / ETF analysis path (app/services/funds/).
    # Separate versions so a fund run never picks up the single-company
    # schema/prompts or vice versa.
    active_fund_analysis_schema_version: str = "fund_v1"  # app/domain/analysis_schema/fund_v1.py
    active_fund_analysis_prompt_version: str = "fund_v1"  # prompts/analysis/{blind,reconciliation}_fund_v1.md


@lru_cache
def get_settings() -> Settings:
    return Settings()
