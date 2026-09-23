"""Analysis readiness check (feature F2, agreed 2026-09-22).

Answers "is it worth spending an analysis run on this holding right now?"
*before* any quota is spent. The Google AI Studio free tier allows about 20
requests a day, shared across macro, sector and company research plus both
analysis passes. A run on a holding with no financials, a placeholder
ticker, or a misconfigured provider burns 2-5 of those calls on a useless
result.

Deliberately cheap and side-effect free:
- no LLM call, no market-data call, no research call, no writes
- reads only the DB (financial facts, cached prices, cached research runs),
  the settings object, and the in-process DailyBudgetGuard

Advisory, not enforced by POST /analysis/holdings/{id}/run: that endpoint
keeps its own existing hard gate (instrument type, NotEquityAnalyzableError)
and nothing else, so the readiness rules can evolve without changing what
the run endpoint accepts. The frontend disables its Run button on any
"block" result.

Status levels:
  ok    - fine
  warn  - the run will work but the result will be weaker, or it will
          spend extra quota (e.g. research needs refreshing)
  block - the run will fail or produce a worthless result
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES, display_label
from app.domain.period_dates import extract_year
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.market import MarketObservation
from app.models.research import ResearchRunType
from app.providers.budget import DailyBudgetGuard
from app.services.portfolio_import.ingestion import looks_like_placeholder_ticker
from app.services.research.common import is_stale, latest_completed_run

CheckStatus = Literal["ok", "warn", "block"]

# Policy thresholds, not financial arithmetic (CLAUDE.md Rule 1 is about
# computing figures; this only counts how many years of facts exist).
MIN_HISTORY_YEARS = 3

# Calls one full run makes on the primary LLM when nothing is cached:
# blind pass + reconciliation pass. Research refreshes are added on top.
ANALYSIS_PASS_CALLS = 2

_VALID_MARKET_DATA = {"yfinance"}
_VALID_RESEARCH = {"gemini_search"}
_GEMINI = "google_ai_studio"


@dataclass(frozen=True)
class ReadinessCheck:
    key: str
    label: str
    status: CheckStatus
    detail: str


@dataclass
class ReadinessReport:
    holding_id: uuid.UUID
    checks: list[ReadinessCheck] = field(default_factory=list)
    estimated_gemini_calls: int = 0
    gemini_calls_remaining_today: int | None = None

    @property
    def ready(self) -> bool:
        return not any(c.status == "block" for c in self.checks)

    @property
    def blockers(self) -> int:
        return sum(1 for c in self.checks if c.status == "block")

    @property
    def warnings(self) -> int:
        return sum(1 for c in self.checks if c.status == "warn")


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _age_text(value: datetime) -> str:
    hours = (datetime.now(timezone.utc) - _as_utc(value)).total_seconds() / 3600
    if hours < 1:
        return "less than an hour ago"
    if hours < 48:
        return f"{int(hours)} h ago"
    return f"{int(hours // 24)} days ago"


def _check_instrument_type(holding: Holding) -> ReadinessCheck:
    label = display_label(holding.asset_class_raw)
    if holding.asset_class_raw in EQUITY_ANALYZABLE_TYPES:
        return ReadinessCheck("instrument_type", "Instrument type", "ok", f"{label} — analyzable.")
    return ReadinessCheck(
        "instrument_type",
        "Instrument type",
        "block",
        f"Tagged '{label}'. Only Stock and Equity ETF can be analyzed. "
        "If the tag is wrong, change Instrument Type on the Holdings page.",
    )


def _check_providers(settings: Settings) -> ReadinessCheck:
    problems: list[str] = []
    if settings.market_data_provider not in _VALID_MARKET_DATA:
        problems.append(f"MARKET_DATA_PROVIDER is '{settings.market_data_provider}' (needs 'yfinance')")
    if settings.research_provider not in _VALID_RESEARCH:
        problems.append(f"RESEARCH_PROVIDER is '{settings.research_provider}' (needs 'gemini_search')")
    if not settings.google_ai_studio_api_key:
        problems.append("GOOGLE_AI_STUDIO_API_KEY is not set")
    if settings.llm_provider == "mistral" and not settings.mistral_api_key:
        problems.append("LLM_PROVIDER is 'mistral' but MISTRAL_API_KEY is not set")
    if problems:
        return ReadinessCheck("providers", "Server configuration", "block", "; ".join(problems) + ".")

    if not settings.fred_api_key:
        return ReadinessCheck(
            "providers",
            "Server configuration",
            "warn",
            "FRED_API_KEY is not set, so the DCF has no risk-free rate and the valuation will be thin.",
        )
    return ReadinessCheck("providers", "Server configuration", "ok", "Market data, research and LLM configured.")


def _check_ticker_and_price(db: Session, holding: Holding, settings: Settings) -> list[ReadinessCheck]:
    latest = db.scalar(
        select(MarketObservation)
        .where(MarketObservation.holding_id == holding.id)
        .order_by(MarketObservation.observed_at.desc())
        .limit(1)
    )
    placeholder = looks_like_placeholder_ticker(holding.ticker, holding.name)

    if placeholder and latest is None:
        ticker = ReadinessCheck(
            "ticker",
            "Ticker",
            "block",
            f"'{holding.ticker}' looks like an auto-generated placeholder from CSV import, not a market "
            "ticker. Set the real one (e.g. EQNR.OL, AAPL) on the Holdings page.",
        )
    elif latest is None:
        ticker = ReadinessCheck(
            "ticker",
            "Ticker",
            "warn",
            f"'{holding.ticker}' has never been priced, so it's unverified. The run will try to price it; "
            "open the Valuation section first to check it resolves.",
        )
    else:
        ticker = ReadinessCheck("ticker", "Ticker", "ok", f"'{holding.ticker}' resolves to a market price.")

    if latest is None:
        price = ReadinessCheck("price", "Price", "warn", "No price fetched yet.")
    else:
        age_hours = (datetime.now(timezone.utc) - _as_utc(latest.observed_at)).total_seconds() / 3600
        when = _age_text(latest.observed_at)
        if age_hours <= settings.market_data_stale_after_hours:
            price = ReadinessCheck("price", "Price", "ok", f"Fresh — fetched {when}.")
        else:
            price = ReadinessCheck(
                "price", "Price", "warn", f"Stale — fetched {when}. The run refreshes it (free, no LLM quota)."
            )
    return [ticker, price]


def _check_financial_history(db: Session, holding: Holding) -> ReadinessCheck:
    rows = db.execute(
        select(FinancialLineItem.period, FinancialLineItem.metric).where(
            FinancialLineItem.holding_id == holding.id
        )
    ).all()
    metrics_by_year: dict[int, set[str]] = {}
    for period, metric in rows:
        year = extract_year(period)
        if year is not None:
            metrics_by_year.setdefault(year, set()).add(metric)

    years = sorted(metrics_by_year, reverse=True)
    roe_years = [y for y in years if {"net_income", "total_equity"} <= metrics_by_year[y]]

    if not years:
        return ReadinessCheck(
            "financials",
            "Financial history",
            "block",
            "No financial facts. Import from SEC EDGAR (US filers) or upload an annual report first — "
            "without numbers the verdict would be guesswork.",
        )
    span = f"{len(years)} year(s): {', '.join(str(y) for y in years[:5])}"
    roe_note = f"; ROE computable for {len(roe_years)}"
    if len(years) < MIN_HISTORY_YEARS:
        return ReadinessCheck(
            "financials",
            "Financial history",
            "warn",
            f"Only {span}{roe_note}. At least {MIN_HISTORY_YEARS} years are needed for a meaningful trend.",
        )
    if len(roe_years) < MIN_HISTORY_YEARS:
        return ReadinessCheck(
            "financials",
            "Financial history",
            "warn",
            f"{span}{roe_note} — net income or equity is missing in some years, so the ROE hurdle test is weak.",
        )
    return ReadinessCheck("financials", "Financial history", "ok", f"{span}{roe_note}.")


def _check_sector(holding: Holding) -> ReadinessCheck:
    if holding.sector:
        return ReadinessCheck("sector", "Sector", "ok", holding.sector)
    return ReadinessCheck(
        "sector",
        "Sector",
        "warn",
        "No sector set, so sector research is skipped. Set it on the Holdings page.",
    )


def _check_research(db: Session, holding: Holding) -> tuple[ReadinessCheck, int]:
    """Returns the check and how many research refreshes (1 Gemini call
    each) the run will trigger."""
    scopes: list[tuple[str, object]] = [
        ("macro", latest_completed_run(db, type_=ResearchRunType.MACRO.value)),
        ("company", latest_completed_run(db, type_=ResearchRunType.COMPANY.value, holding_id=holding.id)),
    ]
    if holding.sector:
        scopes.insert(
            1,
            ("sector", latest_completed_run(db, type_=ResearchRunType.SECTOR.value, sector=holding.sector)),
        )

    stale = [name for name, run in scopes if is_stale(run)]  # type: ignore[arg-type]
    fresh = [name for name, _run in scopes if name not in stale]
    if not stale:
        return (
            ReadinessCheck("research", "Research cache", "ok", f"All fresh ({', '.join(fresh)})."),
            0,
        )
    return (
        ReadinessCheck(
            "research",
            "Research cache",
            "warn",
            f"Needs refreshing: {', '.join(stale)} — the run will spend {len(stale)} extra Gemini call(s). "
            + (f"Fresh: {', '.join(fresh)}." if fresh else ""),
        ),
        len(stale),
    )


def _check_quota(
    settings: Settings, budget_guard: DailyBudgetGuard | None, estimated: int
) -> tuple[ReadinessCheck, int | None]:
    if budget_guard is None:
        return (
            ReadinessCheck("quota", "Gemini quota today", "ok", "No daily budget guard configured."),
            None,
        )
    remaining = budget_guard.remaining_today()
    note = "Counted by this server since its last restart."
    if remaining >= estimated:
        return (
            ReadinessCheck(
                "quota",
                "Gemini quota today",
                "ok",
                f"{remaining} of {settings.llm_rate_limit_rpd} left; this run needs about {estimated}. {note}",
            ),
            remaining,
        )
    has_fallback = settings.llm_fallback_provider != "none"
    status: CheckStatus = "warn" if has_fallback else "block"
    fallback_note = (
        " The analysis passes may fall back to Mistral, but research refreshes can't."
        if has_fallback
        else " Try again after midnight UTC, or open cached research first."
    )
    return (
        ReadinessCheck(
            "quota",
            "Gemini quota today",
            status,
            f"Only {remaining} of {settings.llm_rate_limit_rpd} left; this run needs about {estimated}.{fallback_note}",
        ),
        remaining,
    )


def check_analysis_readiness(
    db: Session,
    holding: Holding,
    *,
    settings: Settings,
    budget_guard: DailyBudgetGuard | None,
) -> ReadinessReport:
    report = ReadinessReport(holding_id=holding.id)
    report.checks.append(_check_instrument_type(holding))
    report.checks.append(_check_providers(settings))
    report.checks.extend(_check_ticker_and_price(db, holding, settings))
    report.checks.append(_check_financial_history(db, holding))
    report.checks.append(_check_sector(holding))

    research_check, research_calls = _check_research(db, holding)
    report.checks.append(research_check)

    estimated = research_calls + (ANALYSIS_PASS_CALLS if settings.llm_provider == _GEMINI else 0)
    report.estimated_gemini_calls = estimated
    quota_check, remaining = _check_quota(settings, budget_guard, estimated)
    report.checks.append(quota_check)
    report.gemini_calls_remaining_today = remaining
    return report
