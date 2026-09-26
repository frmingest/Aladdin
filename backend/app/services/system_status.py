"""System status (feature F4): what is configured, what is stale, what failed.

Answers "why isn't this working?" without opening Railway's variables or
logs. Read-only. It makes no network call: every provider row reports
configuration only (whether a key is set, which provider is selected),
never a live probe. That keeps the page instant and means opening it never
spends LLM quota.

Secrets are never returned. A key appears only as "set" or "missing".
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config.paths import BACKEND_DIR
from app.config.settings import Settings
from app.domain.document_types import DOCUMENT_TYPE_ESEF_INDEX, DOCUMENT_TYPE_SEC_XBRL
from app.domain.regime_adjustments import get_regime_adjustments
from app.models.account import Account
from app.models.analysis import (
    AnalysisWorkerHeartbeat,
    EquityAnalysisRun,
    EquityAnalysisRunStatus,
)
from app.models.document import Document
from app.models.holding import Holding
from app.models.macro import MacroSeriesStatus
from app.models.market import (
    FxObservation,
    MarketObservation,
    RiskFreeRateObservation,
    ShareCountObservation,
)
from app.models.portfolio import PortfolioSnapshot
from app.models.research import ResearchRun, ResearchRunStatus
from app.models.thesis import ThesisTripwire
from app.providers.budget import DailyBudgetGuard
from app.services.risk.regime import classify_regime

OK, WARN, ERROR, OFF = "ok", "warn", "error", "off"
STUCK_RUN_AFTER = timedelta(hours=1)
FAILED_RUN_WINDOW = timedelta(days=7)

_KNOWN = {
    "llm_provider": {"google_ai_studio", "mistral", "ollama"},
    "research_provider": {"gemini_search", "none"},
    "market_data_provider": {"yfinance"},
    "risk_free_rate_provider": {"fred"},
    "fundamentals_provider": {"sec_edgar", "none"},
    "announcements_provider": {"newsweb", "none"},
    "macro_data_provider": {"live", "none"},
    "object_storage_provider": {"local", "s3", "r2", "supabase"},
}


@dataclass
class StatusItem:
    key: str
    label: str
    status: str
    value: str
    detail: str = ""


@dataclass
class FreshnessItem:
    key: str
    label: str
    last_at: datetime | None
    status: str
    detail: str = ""


@dataclass
class SystemStatus:
    generated_at: datetime
    version: str
    environment: str
    commit: str | None
    database_ok: bool
    database_dialect: str | None
    migration_current: str | None
    migration_head: str | None
    providers: list[StatusItem] = field(default_factory=list)
    llm_daily_limit: int = 0
    llm_calls_remaining_today: int = 0
    freshness: list[FreshnessItem] = field(default_factory=list)
    analysis: list[StatusItem] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)
    issues: list[str] = field(default_factory=list)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _key(value: str | None) -> str:
    return "set" if value else "missing"


def migration_head() -> str | None:
    """The newest revision in the code's alembic/versions (what a deploy
    should have migrated to)."""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        config = Config(str(BACKEND_DIR / "alembic.ini"))
        config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        heads = ScriptDirectory.from_config(config).get_heads()
        return ",".join(sorted(heads)) if heads else None
    except Exception:  # noqa: BLE001 — reported as unknown, not a 500
        return None


def _migration_current(db: Session) -> str | None:
    try:
        rows = db.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
    except Exception:  # noqa: BLE001 — no alembic_version table (tests, fresh DB)
        db.rollback()
        return None
    return ",".join(sorted(rows)) if rows else None


def _providers(settings: Settings) -> list[StatusItem]:
    items: list[StatusItem] = []

    def unknown(setting: str, value: str) -> bool:
        return value not in _KNOWN[setting]

    llm = settings.llm_provider
    if unknown("llm_provider", llm):
        items.append(StatusItem("llm", "Analysis LLM", ERROR, llm, "Unknown LLM_PROVIDER; analysis runs will fail."))
    elif llm == "google_ai_studio":
        ok = bool(settings.google_ai_studio_api_key)
        items.append(StatusItem("llm", "Analysis LLM", OK if ok else ERROR, f"Gemini · {settings.llm_model_name}",
                                f"API key {_key(settings.google_ai_studio_api_key)}"))
    elif llm == "mistral":
        ok = bool(settings.mistral_api_key)
        items.append(StatusItem("llm", "Analysis LLM", OK if ok else ERROR, f"Mistral · {settings.mistral_model_name}",
                                f"API key {_key(settings.mistral_api_key)}"))
    else:
        local = "localhost" in settings.ollama_base_url or "127.0.0.1" in settings.ollama_base_url
        on_server = settings.environment not in ("development", "local", "test")
        items.append(StatusItem(
            "llm", "Analysis LLM", WARN if (local and on_server) else OK,
            f"Ollama · {settings.ollama_model_name}",
            "Points at localhost on a deployed server; Railway can't reach the PC (Sprint 5B)."
            if (local and on_server) else f"{settings.ollama_base_url} (not probed from here)",
        ))

    fb = settings.llm_fallback_provider
    items.append(StatusItem("llm_fallback", "LLM fallback", OFF if fb == "none" else OK, fb,
                            "" if fb == "none" else "Used when the primary provider fails"))

    rp = settings.research_provider
    if unknown("research_provider", rp):
        items.append(StatusItem("research", "Live research", ERROR, rp, "Unknown RESEARCH_PROVIDER"))
    elif rp == "none":
        items.append(StatusItem("research", "Live research", OFF, "none", "Macro/sector/company research disabled"))
    else:
        items.append(StatusItem("research", "Live research", OK if settings.google_ai_studio_api_key else ERROR,
                                "Gemini + Google Search",
                                f"API key {_key(settings.google_ai_studio_api_key)}"))

    md = settings.market_data_provider
    items.append(StatusItem("market_data", "Prices, FX, beta", ERROR if unknown("market_data_provider", md) else OK,
                            md, "Unknown MARKET_DATA_PROVIDER; valuation has no prices" if unknown(
                                "market_data_provider", md) else "No key needed"))

    rf = settings.risk_free_rate_provider
    if unknown("risk_free_rate_provider", rf):
        items.append(StatusItem("risk_free", "Risk-free rate", ERROR, rf, "Unknown RISK_FREE_RATE_PROVIDER"))
    else:
        items.append(StatusItem("risk_free", "Risk-free rate", OK if settings.fred_api_key else WARN, "FRED",
                                f"API key {_key(settings.fred_api_key)}"))

    mp = settings.macro_data_provider
    if mp == "none":
        items.append(StatusItem("macro_data", "Macro data (rates, CPI, FX)", OFF, "none", "Stored values only; nothing fetched"))
    else:
        items.append(StatusItem(
            "macro_data", "Macro data (rates, CPI, FX)", OK if settings.fred_api_key else WARN,
            "Norges Bank + SSB + FRED",
            ("FRED key set" if settings.fred_api_key else "FRED_API_KEY missing; the 6 US series will not update")
            + (f" · refresh every {settings.macro_refresh_interval_hours} h" if settings.macro_refresh_interval_hours
               else " · background refresh off"),
        ))

    fp = settings.fundamentals_provider
    if fp == "none":
        items.append(StatusItem("edgar", "SEC EDGAR", OFF, "none", "US fundamentals import disabled"))
    elif unknown("fundamentals_provider", fp):
        items.append(StatusItem("edgar", "SEC EDGAR", ERROR, fp, "Unknown FUNDAMENTALS_PROVIDER"))
    else:
        items.append(StatusItem("edgar", "SEC EDGAR", OK if settings.sec_edgar_user_agent else WARN, "sec_edgar",
                                "Contact user agent set" if settings.sec_edgar_user_agent
                                else "SEC_EDGAR_USER_AGENT missing; EDGAR imports will fail"))

    ap = settings.announcements_provider
    items.append(StatusItem("newsweb", "Oslo Børs Newsweb", OFF if ap == "none" else (
        ERROR if unknown("announcements_provider", ap) else OK), ap, "No key needed" if ap == "newsweb" else ""))

    op = settings.object_storage_provider
    if unknown("object_storage_provider", op):
        items.append(StatusItem("storage", "Document storage", ERROR, op, "Unknown OBJECT_STORAGE_PROVIDER"))
    elif op == "local":
        on_server = settings.environment not in ("development", "local", "test")
        items.append(StatusItem("storage", "Document storage", WARN if on_server else OK, "local disk",
                                "Uploaded files are lost on redeploy" if on_server else settings.object_storage_local_path))
    else:
        keys = settings.object_storage_access_key_id and settings.object_storage_secret_access_key
        items.append(StatusItem("storage", "Document storage", OK if keys else ERROR, f"{op} · {settings.object_storage_bucket}",
                                f"Access keys {'set' if keys else 'missing'}"))
    return items


def _regime_dcf_item(db: Session, settings: Settings) -> StatusItem:
    """Sprint 14 (2026-09-26): whether the macro regime (app/services/risk/regime.py)
    is wired into the DCF discount rate. Off by default — a real behavior
    change to every valuation, Faiz's call (see Settings.regime_adjusted_dcf_enabled)."""
    if not settings.regime_adjusted_dcf_enabled:
        return StatusItem(
            "regime_dcf", "Regime-adjusted DCF", OFF, "off",
            "Every DCF uses the plain CAPM discount rate (Sprint 14 backlog item, not enabled)",
        )
    regime_result = classify_regime(db)
    adjustments = get_regime_adjustments(settings.active_regime_adjustment_version)
    addon = adjustments.discount_rate_addon.get(regime_result.regime, adjustments.default_addon)
    return StatusItem(
        "regime_dcf", "Regime-adjusted DCF", OK,
        f"{regime_result.regime} (+{addon * 100:.2f}pp)",
        f"Regime adjustments {adjustments.version} — every holding's DCF discount rate is widened by this amount",
    )


def _fresh(key: str, label: str, last_at: datetime | None, max_age: timedelta | None, now: datetime,
           *, never: str = "Never", detail: str = "") -> FreshnessItem:
    last_at = _aware(last_at)
    if last_at is None:
        return FreshnessItem(key, label, None, WARN, never)
    if max_age is not None and now - last_at > max_age:
        return FreshnessItem(key, label, last_at, WARN, detail or "Older than the refresh window")
    return FreshnessItem(key, label, last_at, OK, detail)


def _share_count_detail(db: Session) -> str:
    """'3 holdings with a share count: 1 entered by you, 2 from Yahoo'."""
    rows = db.execute(
        select(ShareCountObservation.source, func.count(func.distinct(ShareCountObservation.holding_id)))
        .group_by(ShareCountObservation.source)
    ).all()
    if not rows:
        return ""
    labels = {"manual": "entered by you", "sec_edgar": "from SEC", "yfinance": "from Yahoo"}
    return "Holdings with a share count: " + ", ".join(
        f"{count} {labels.get(source, source)}" for source, count in sorted(rows)
    )


def build_system_status(
    db: Session, settings: Settings, budget: DailyBudgetGuard, *, now: datetime | None = None
) -> SystemStatus:
    now = now or datetime.now(timezone.utc)
    status = SystemStatus(
        generated_at=now,
        version=settings.app_version,
        environment=settings.environment,
        commit=(os.environ.get("RAILWAY_GIT_COMMIT_SHA") or "")[:7] or None,
        database_ok=True,
        database_dialect=db.get_bind().dialect.name,
        migration_current=_migration_current(db),
        migration_head=migration_head(),
        providers=_providers(settings),
        llm_daily_limit=settings.llm_rate_limit_rpd,
        llm_calls_remaining_today=budget.remaining_today(),
    )
    status.providers.append(_regime_dcf_item(db, settings))

    market_window = timedelta(hours=settings.market_data_stale_after_hours)
    research_window = timedelta(hours=settings.research_stale_after_hours)

    def latest_research(type_: str, run_status: str) -> datetime | None:
        column = ResearchRun.completed_at if run_status == ResearchRunStatus.COMPLETED.value else ResearchRun.started_at
        return db.scalar(select(func.max(column)).where(ResearchRun.type == type_, ResearchRun.status == run_status))

    status.freshness = [
        _fresh("prices", "Latest price", db.scalar(select(func.max(MarketObservation.observed_at))), market_window, now),
        _fresh("fx", "Latest FX rate", db.scalar(select(func.max(FxObservation.observed_at))), market_window, now),
        _fresh("risk_free", "Latest risk-free rate",
               db.scalar(select(func.max(RiskFreeRateObservation.observed_at))), timedelta(days=7), now),
        _fresh("macro_data", "Macro data (last successful fetch)",
               db.scalar(select(func.max(MacroSeriesStatus.last_success_at))),
               timedelta(hours=max(settings.macro_refresh_interval_hours, settings.macro_stale_after_hours) * 2),
               now, never="Never fetched"),
        _fresh("macro", "Macro research", latest_research("MACRO", ResearchRunStatus.COMPLETED.value), research_window, now),
        _fresh("company", "Company research (any)",
               latest_research("COMPANY", ResearchRunStatus.COMPLETED.value), None, now),
        _fresh("newsweb", "Newsweb announcements",
               latest_research("ANNOUNCEMENTS", ResearchRunStatus.COMPLETED.value), None, now),
        _fresh("edgar", "SEC EDGAR import",
               db.scalar(select(func.max(Document.uploaded_at)).where(Document.type == DOCUMENT_TYPE_SEC_XBRL)),
               None, now, never="Never imported"),
        _fresh("esef_index", "ESEF history import (filings.xbrl.org)",
               db.scalar(select(func.max(Document.uploaded_at)).where(Document.type == DOCUMENT_TYPE_ESEF_INDEX)),
               None, now, never="Never imported"),
        _fresh("share_counts", "Latest share count (Yahoo)",
               db.scalar(select(func.max(ShareCountObservation.observed_at))
                         .where(ShareCountObservation.source == "yfinance")),
               timedelta(days=7), now, never="Never fetched",
               detail=_share_count_detail(db)),
        _fresh("snapshot", "Latest portfolio import", db.scalar(select(func.max(PortfolioSnapshot.uploaded_at))),
               timedelta(days=31), now, never="No portfolio imported", detail=""),
    ]
    macro_failures = db.scalars(
        select(MacroSeriesStatus).where(MacroSeriesStatus.last_error.is_not(None))
        .order_by(MacroSeriesStatus.series_key)
    ).all()
    if macro_failures:
        status.freshness.append(FreshnessItem(
            "macro_data_failures", f"Macro series failing ({len(macro_failures)})",
            _aware(max(f.last_attempt_at for f in macro_failures)), WARN,
            "; ".join(f"{f.series_key}: {f.last_error}" for f in macro_failures)[:400],
        ))
    last_failure = db.scalar(
        select(ResearchRun).where(ResearchRun.status == ResearchRunStatus.FAILED.value)
        .order_by(ResearchRun.started_at.desc()).limit(1)
    )
    if last_failure is not None:
        status.freshness.append(FreshnessItem(
            "research_failure", f"Last failed research ({last_failure.type.lower()})",
            _aware(last_failure.started_at), WARN if now - _aware(last_failure.started_at) < timedelta(days=1) else OK,
            (last_failure.error_message or "")[:240],
        ))

    total_runs = db.scalar(select(func.count(EquityAnalysisRun.id))) or 0
    last_run = db.scalar(select(EquityAnalysisRun).order_by(EquityAnalysisRun.started_at.desc()).limit(1))
    failed_recent = db.scalar(select(func.count(EquityAnalysisRun.id)).where(
        EquityAnalysisRun.status == EquityAnalysisRunStatus.FAILED.value,
        EquityAnalysisRun.started_at >= now - FAILED_RUN_WINDOW,
    )) or 0
    # Local-worker runs are covered by the worker lease (app/services/analysis/queue.py)
    # and reported separately below.
    running = db.scalars(select(EquityAnalysisRun).where(
        EquityAnalysisRun.status == EquityAnalysisRunStatus.RUNNING.value,
        EquityAnalysisRun.engine != "local")).all()
    stuck = [r for r in running if now - _aware(r.started_at) > STUCK_RUN_AFTER]
    queued_local = db.scalar(select(func.count(EquityAnalysisRun.id)).where(
        EquityAnalysisRun.status == EquityAnalysisRunStatus.QUEUED.value,
        EquityAnalysisRun.engine == "local")) or 0
    beat = db.scalar(select(AnalysisWorkerHeartbeat).order_by(AnalysisWorkerHeartbeat.last_seen_at.desc()).limit(1))

    status.analysis = [
        StatusItem("runs_total", "Analysis runs", OK, str(total_runs)),
        StatusItem("last_run", "Last run", OK if last_run and last_run.status != "FAILED" else (WARN if last_run else OFF),
                   _aware(last_run.started_at).isoformat() if last_run else "never",
                   " · ".join(part for part in (
                       last_run.status,
                       " ".join(p for p in (last_run.provider, last_run.model_name) if p),
                       (last_run.error_message or "")[:200],
                   ) if part) if last_run else ""),
        StatusItem("failed_7d", "Failed in the last 7 days", WARN if failed_recent else OK, str(failed_recent)),
        StatusItem("stuck", "Stuck (running > 1 h)", ERROR if stuck else OK, str(len(stuck)),
                   "Probably interrupted by a restart; re-run the holding." if stuck else ""),
    ]
    if beat is None:
        status.analysis.append(StatusItem(
            "local_worker", "Local worker (your PC)", WARN if queued_local else OFF, "never started",
            "Runs queued for the PC wait until `python -m app.worker` runs there." if queued_local else ""))
    else:
        seen = _aware(beat.last_seen_at)
        online = beat.state != "stopped" and now - seen <= timedelta(seconds=settings.worker_online_seconds)
        worker_state = beat.state if online else "offline"
        status.analysis.append(StatusItem(
            "local_worker", "Local worker (your PC)",
            (WARN if beat.state in ("llm_unavailable", "waiting_quota") else OK) if online else (WARN if queued_local else OFF),
            f"{beat.worker_id}: {worker_state}",
            " · ".join(p for p in (beat.model_name, f"last seen {seen.isoformat()}", beat.detail or "") if p)))
    status.analysis.append(StatusItem(
        "queued_local", "Queued for your PC", OK, str(queued_local)))

    # Sprint 11: reads the tripwires' state as last evaluated (whenever a
    # thesis page was last opened), not a fresh evaluation — this endpoint
    # reads configuration and the database only, same as everywhere else on
    # this page.
    active_tripwires = db.scalar(
        select(func.count(ThesisTripwire.id)).where(ThesisTripwire.active.is_(True))
    ) or 0
    firing_tripwires = db.scalar(
        select(func.count(ThesisTripwire.id)).where(
            ThesisTripwire.active.is_(True), ThesisTripwire.fired_at.is_not(None)
        )
    ) or 0
    status.analysis.append(StatusItem(
        "thesis_tripwires", "Thesis tripwires", WARN if firing_tripwires else OK,
        f"{active_tripwires} active, {firing_tripwires} firing"))

    status.counts = {
        "holdings": db.scalar(select(func.count(Holding.id))) or 0,
        "accounts": db.scalar(select(func.count(Account.id))) or 0,
        "snapshots": db.scalar(select(func.count(PortfolioSnapshot.id))) or 0,
        "documents": db.scalar(select(func.count(Document.id))) or 0,
    }

    issues = [f"{p.label}: {p.detail or p.value}" for p in status.providers if p.status == ERROR]
    if status.migration_current and status.migration_head and status.migration_current != status.migration_head:
        issues.append(
            f"Database is at migration {status.migration_current}, code expects {status.migration_head}. Run alembic upgrade head."
        )
    issues += [f"{a.label}: {a.value}. {a.detail}".strip() for a in status.analysis if a.status == ERROR]
    if status.llm_calls_remaining_today == 0 and settings.llm_provider == "google_ai_studio":
        issues.append("Gemini daily budget used up in this server process; it resets at 00:00 UTC.")
    status.issues = issues
    return status
