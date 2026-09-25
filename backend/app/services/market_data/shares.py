"""Shares outstanding for one holding (2026-09-25) — the input every
market multiple and the DCF's per-share value need, and the one figure
Oslo ESEF filings don't tag. See
claude/gap-closing-roic-roe-multiples-2026-09-25.md §4B.

Sources, in priority order (the first one available wins):

1. **manual** — a count Faiz typed in with a reference (Newsweb notice,
   the company's IR page). Wins while it exists; removing it falls back.
2. **sec_edgar** — the cover-page count of the latest SEC filing
   (dei:EntityCommonStockSharesOutstanding), saved by the EDGAR import.
   Used while under SEC_MAX_AGE_DAYS old.
3. **yfinance** — Yahoo's current count, cached as a dated row for 24 h
   (the same fail-visibly cache as prices: a failed refresh falls back to
   the last row and says so).
4. **filing** — a shares_outstanding fact from the latest annual filing
   (year-end, so stale for a company that issues shares).

Cross-check: net income ÷ basic EPS from the latest filing is the year's
weighted-average share count, give or take EPS rounding (2 decimals: Salmon
Evolution's -47.4m ÷ -0.11 is anywhere from 412m to 451m). A chosen count
more than 10% outside that range is flagged — usually a share issue or a
buyback since the report — never silently corrected.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.market import ShareCountObservation
from app.providers.base import MarketDataProvider, MarketDataUnavailableError
from app.services.market_data.common import get_or_refresh

SOURCE_MANUAL = "manual"
SOURCE_SEC = "sec_edgar"
SOURCE_YFINANCE = "yfinance"
SOURCE_FILING = "filing"
SOURCE_LABELS = {
    SOURCE_MANUAL: "entered by you",
    SOURCE_SEC: "SEC filing cover page",
    SOURCE_YFINANCE: "Yahoo Finance",
    SOURCE_FILING: "annual report (year-end)",
}

YFINANCE_STALE_AFTER_HOURS = 24
SEC_MAX_AGE_DAYS = 400
CROSS_CHECK_TOLERANCE = Decimal("0.10")
# EPS is published to 2 decimals: the true value is within +/- half a cent.
EPS_ROUNDING = Decimal("0.005")


@dataclass
class ShareCountResult:
    shares: Decimal | None = None
    source: str | None = None
    as_of: datetime | None = None
    reference: str | None = None
    note: str | None = None
    override_id: uuid.UUID | None = None
    # (low, high) weighted-average count implied by net income / basic EPS
    eps_implied_range: tuple[Decimal, Decimal] | None = None
    warnings: list[str] = field(default_factory=list)
    # Why no count is available (every source tried), when shares is None.
    unavailable_reason: str | None = None

    @property
    def source_label(self) -> str:
        return SOURCE_LABELS.get(self.source or "", self.source or "")

    def describe(self) -> str:
        """'2,496.4m shares (Yahoo Finance, 2026-09-25)'."""
        if self.shares is None:
            return "no share count"
        when = f", {self.as_of.date().isoformat()}" if self.as_of else ""
        return f"{_millions(self.shares)} shares ({self.source_label}{when})"


def _millions(value: Decimal) -> str:
    return f"{value / Decimal(1_000_000):,.1f}m"


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _latest(db: Session, holding_id: uuid.UUID, source: str) -> ShareCountObservation | None:
    return db.scalar(
        select(ShareCountObservation)
        .where(ShareCountObservation.holding_id == holding_id, ShareCountObservation.source == source)
        .order_by(ShareCountObservation.observed_at.desc(), ShareCountObservation.created_at.desc())
        .limit(1)
    )


def _from_row(row: ShareCountObservation) -> ShareCountResult:
    return ShareCountResult(
        shares=row.shares,
        source=row.source,
        as_of=_aware(row.observed_at),
        reference=row.reference,
        note=row.note,
        override_id=row.id if row.source == SOURCE_MANUAL else None,
    )


def eps_implied_range(facts: dict[str, Decimal]) -> tuple[Decimal, Decimal] | None:
    """(low, high) share count consistent with net income / basic EPS given
    EPS rounding, or None when either is missing or EPS is too small to
    divide by meaningfully."""
    net_income, eps = facts.get("net_income"), facts.get("eps_basic")
    if net_income is None or eps is None or net_income == 0 or abs(eps) <= EPS_ROUNDING:
        return None
    bounds = sorted(
        abs(net_income / (abs(eps) + delta)) for delta in (EPS_ROUNDING, -EPS_ROUNDING)
    )
    return bounds[0], bounds[1]


def _cross_check(result: ShareCountResult, facts: dict[str, Decimal], period: str | None) -> None:
    implied = eps_implied_range(facts)
    result.eps_implied_range = implied
    if implied is None or result.shares is None or result.source == SOURCE_FILING:
        return
    low, high = implied
    if result.shares < low * (1 - CROSS_CHECK_TOLERANCE) or result.shares > high * (1 + CROSS_CHECK_TOLERANCE):
        result.warnings.append(
            f"share count {_millions(result.shares)} differs by more than 10% from net income ÷ EPS "
            f"in {period or 'the latest filing'} (≈{_millions(low)}–{_millions(high)}) — the company "
            "may have issued or bought back shares since; check its announcements, or enter the "
            "current count yourself"
        )


def _yfinance_row(
    db: Session, holding: Holding, provider: MarketDataProvider, *, force: bool
) -> tuple[ShareCountObservation | None, str | None]:
    def _fetch_and_persist() -> ShareCountObservation:
        # getattr: a provider written before 2026-09-25 (or a test fake)
        # may not have the method at all — treat that as "no share count".
        fetch = getattr(provider, "get_shares_outstanding", None)
        if fetch is None:
            raise MarketDataUnavailableError(f"{provider.name} does not provide share counts")
        shares = fetch(holding.ticker)
        row = ShareCountObservation(
            holding_id=holding.id,
            shares=shares,
            observed_at=datetime.now(timezone.utc),
            source=SOURCE_YFINANCE,
            reference=f"https://finance.yahoo.com/quote/{holding.ticker}",
        )
        db.add(row)
        db.flush()
        return row

    snapshot = get_or_refresh(
        db,
        latest=lambda: _latest(db, holding.id, SOURCE_YFINANCE),
        observed_at_of=lambda row: row.observed_at,
        fetch_and_persist=_fetch_and_persist,
        stale_after_hours=YFINANCE_STALE_AFTER_HOURS,
        unavailable_error=MarketDataUnavailableError,
        force=force,
    )
    return snapshot.value, snapshot.reason


def resolve_share_count(
    db: Session,
    holding: Holding,
    provider: MarketDataProvider | None,
    *,
    latest_facts: dict[str, Decimal] | None = None,
    latest_period: str | None = None,
    force: bool = False,
) -> ShareCountResult:
    """The share count to use now, with its source and any cross-check
    warning. Never raises for a missing source; `unavailable_reason` says
    what was tried."""
    facts = latest_facts or {}
    tried: list[str] = []

    manual = _latest(db, holding.id, SOURCE_MANUAL)
    if manual is not None:
        result = _from_row(manual)
        _cross_check(result, facts, latest_period)
        return result

    sec = _latest(db, holding.id, SOURCE_SEC)
    if sec is not None:
        age = datetime.now(timezone.utc) - _aware(sec.observed_at)
        if age <= timedelta(days=SEC_MAX_AGE_DAYS):
            result = _from_row(sec)
            _cross_check(result, facts, latest_period)
            return result
        tried.append(f"SEC cover-page count is from {sec.observed_at.date()}, too old")

    if provider is not None:
        row, reason = _yfinance_row(db, holding, provider, force=force)
        if row is not None:
            result = _from_row(row)
            if reason:
                result.warnings.append(f"Yahoo Finance {reason}")
            _cross_check(result, facts, latest_period)
            return result
        tried.append(f"Yahoo Finance: {reason}")
    else:
        tried.append("no market data provider configured")

    filed = facts.get("shares_outstanding")
    if filed is not None and filed > 0:
        result = ShareCountResult(
            shares=filed,
            source=SOURCE_FILING,
            note=f"year-end count from {latest_period or 'the latest filing'}",
        )
        _cross_check(result, facts, latest_period)
        return result
    tried.append("no shares_outstanding fact in the latest filing")

    result = ShareCountResult(unavailable_reason="; ".join(tried))
    result.eps_implied_range = eps_implied_range(facts)
    return result


def add_manual_share_count(
    db: Session,
    holding: Holding,
    *,
    shares: Decimal,
    as_of: datetime,
    reference: str | None,
    note: str | None,
) -> ShareCountObservation:
    if shares <= 0:
        raise ValueError("shares must be positive")
    row = ShareCountObservation(
        holding_id=holding.id,
        shares=shares,
        observed_at=_aware(as_of),
        source=SOURCE_MANUAL,
        reference=(reference or "").strip() or None,
        note=(note or "").strip() or None,
    )
    db.add(row)
    db.commit()
    return row


def clear_manual_share_counts(db: Session, holding: Holding) -> int:
    """Removes every manual count for the holding (the automatic sources
    take over again). Returns how many rows were removed."""
    rows = list(
        db.scalars(
            select(ShareCountObservation).where(
                ShareCountObservation.holding_id == holding.id,
                ShareCountObservation.source == SOURCE_MANUAL,
            )
        )
    )
    for row in rows:
        db.delete(row)
    db.commit()
    return len(rows)


def record_sec_cover_shares(
    db: Session, holding: Holding, *, shares: Decimal, as_of: datetime, reference: str
) -> ShareCountObservation | None:
    """Saves the SEC cover-page count (EDGAR import). No-op when the same
    count for the same date is already stored."""
    existing = _latest(db, holding.id, SOURCE_SEC)
    if existing is not None and existing.shares == shares and _aware(existing.observed_at) == _aware(as_of):
        return None
    row = ShareCountObservation(
        holding_id=holding.id,
        shares=shares,
        observed_at=_aware(as_of),
        source=SOURCE_SEC,
        reference=reference,
    )
    db.add(row)
    db.flush()
    return row
