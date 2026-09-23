"""Portfolio overview: the dashboard roll-up that closes Sprint 5.

One read-only pass over what the database already holds, with no network,
market-data or LLM call, so the home page loads instantly:

- total value, accounts and positions from the latest snapshot of each
  account (the same "currently owned" rule as the margin-of-safety board)
- allocation by instrument type, sector, trading currency and account
- concentration: HHI over holding weights, effective number of holdings,
  and the share held by the top 1/5/10 positions
- a verdict and moat roll-up over the latest analysis run of each equity,
  weighted by NOK value
- a deterministic executive summary: fixed rules with fixed thresholds,
  written as plain sentences

CLAUDE.md Rule 1: every number is computed here in Python. The LLM is not
involved in producing any part of this view. The verdict and moat labels
are read back from stored analysis runs, which are the LLM's own recorded
output, and are only counted and summed here.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES, display_label
from app.models.account import Account
from app.models.holding import Holding
from app.models.portfolio import PortfolioSnapshot
from app.services.analysis.latest import latest_runs_by_holding, run_ratings
from app.services.calculations import herfindahl_hirschman_index
from app.services.valuation.board import current_positions

HUNDRED = Decimal(100)
ZERO = Decimal(0)

# Executive-summary thresholds. Changing one changes what the summary says,
# so each is named and documented here, not buried in a sentence builder.
LARGE_POSITION_WARN_PCT = Decimal(20)
"""A single holding above this share of the portfolio is flagged."""
SECTOR_WARN_PCT = Decimal(35)
"""A single sector above this share of the portfolio is flagged."""
LOW_COVERAGE_WARN_PCT = Decimal(50)
"""Less than this share of equity value analyzed is flagged."""
STALE_ANALYSIS_DAYS = 180
"""An analysis older than this is counted as stale."""
STALE_SNAPSHOT_DAYS = 31
"""An account whose latest snapshot is older than this is flagged."""

NOT_ANALYZED = "Not analyzed"
UNCLASSIFIED = "Unclassified"
VERDICT_ORDER = ("Strong Buy", "Buy", "Hold", "Sell", "Avoid", NOT_ANALYZED)
MOAT_ORDER = ("Wide", "Narrow", "None", NOT_ANALYZED)


@dataclass
class AllocationSlice:
    key: str
    label: str
    value_nok: Decimal
    weight_pct: Decimal
    holding_count: int


@dataclass
class RatingSlice:
    rating: str
    holding_count: int
    value_nok: Decimal
    weight_pct: Decimal
    """Share of the portfolio's analyzable equity value, 0-100."""


@dataclass
class PositionRow:
    holding_id: uuid.UUID
    ticker: str
    name: str
    instrument_type: str
    sector: str | None
    trading_currency: str
    value_nok: Decimal | None
    weight_pct: Decimal | None
    account_count: int
    verdict_rating: str | None = None
    moat_rating: str | None = None
    analyzed_at: datetime | None = None
    analysis_stale: bool = False


@dataclass
class Concentration:
    hhi: Decimal | None
    effective_holdings: Decimal | None
    top1_pct: Decimal | None
    top5_pct: Decimal | None
    top10_pct: Decimal | None


@dataclass
class SummaryPoint:
    tone: str  # "good" | "info" | "warn"
    text: str


@dataclass
class AccountRow:
    account_id: uuid.UUID | None
    name: str
    value_nok: Decimal
    position_count: int
    snapshot_at: datetime
    stale: bool


@dataclass
class Overview:
    as_of: datetime | None
    total_value_nok: Decimal = ZERO
    equity_value_nok: Decimal = ZERO
    holding_count: int = 0
    position_count: int = 0
    positions_missing_value: int = 0
    accounts: list[AccountRow] = field(default_factory=list)
    by_instrument_type: list[AllocationSlice] = field(default_factory=list)
    by_sector: list[AllocationSlice] = field(default_factory=list)
    by_currency: list[AllocationSlice] = field(default_factory=list)
    concentration: Concentration = field(
        default_factory=lambda: Concentration(None, None, None, None, None)
    )
    verdicts: list[RatingSlice] = field(default_factory=list)
    moats: list[RatingSlice] = field(default_factory=list)
    analyzed_equity_count: int = 0
    equity_count: int = 0
    analyzed_equity_value_pct: Decimal | None = None
    stale_analysis_count: int = 0
    positions: list[PositionRow] = field(default_factory=list)
    summary: list[SummaryPoint] = field(default_factory=list)


def _aware(value: datetime) -> datetime:
    # SQLite drops tzinfo; Postgres keeps it. Compare everything as UTC.
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _pct(part: Decimal, whole: Decimal) -> Decimal | None:
    if whole <= 0:
        return None
    return part / whole * HUNDRED


def _allocation(
    groups: dict[str, tuple[str, Decimal, int]], total: Decimal
) -> list[AllocationSlice]:
    slices = [
        AllocationSlice(key=k, label=label, value_nok=v, weight_pct=_pct(v, total) or ZERO, holding_count=n)
        for k, (label, v, n) in groups.items()
    ]
    slices.sort(key=lambda s: (-s.value_nok, s.label))
    return slices


def _fmt_nok(value: Decimal) -> str:
    return f"{int(value.quantize(Decimal(1))):,} kr".replace(",", " ")


def _fmt_pct(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.1'))}%"


def build_overview(db: Session, *, now: datetime | None = None) -> Overview:
    now = now or datetime.now(timezone.utc)
    positions = current_positions(db)
    if not positions:
        return Overview(as_of=None)

    snapshot_ids = {p.snapshot_id for p in positions}
    snapshots = {s.id: s for s in db.scalars(select(PortfolioSnapshot).where(PortfolioSnapshot.id.in_(snapshot_ids)))}
    holding_ids = {p.holding_id for p in positions}
    holdings = {h.id: h for h in db.scalars(select(Holding).where(Holding.id.in_(holding_ids)))}
    account_ids = {s.account_id for s in snapshots.values() if s.account_id is not None}
    accounts = (
        {a.id: a for a in db.scalars(select(Account).where(Account.id.in_(account_ids)))} if account_ids else {}
    )

    overview = Overview(as_of=max(_aware(s.uploaded_at) for s in snapshots.values()))
    overview.position_count = len(positions)

    # Per holding: value summed across accounts.
    value_by_holding: dict[uuid.UUID, Decimal] = {}
    accounts_by_holding: dict[uuid.UUID, set[uuid.UUID | None]] = {}
    account_totals: dict[uuid.UUID, tuple[Decimal, int]] = {}
    for p in positions:
        snapshot = snapshots[p.snapshot_id]
        accounts_by_holding.setdefault(p.holding_id, set()).add(snapshot.account_id)
        value = p.market_value_nok
        if value is None:
            overview.positions_missing_value += 1
            value = ZERO
        value_by_holding[p.holding_id] = value_by_holding.get(p.holding_id, ZERO) + value
        total, count = account_totals.get(snapshot.id, (ZERO, 0))
        account_totals[snapshot.id] = (total + value, count + 1)

    overview.holding_count = len(value_by_holding)
    total = sum(value_by_holding.values(), ZERO)
    overview.total_value_nok = total

    for snapshot_id, (value, count) in account_totals.items():
        snapshot = snapshots[snapshot_id]
        account = accounts.get(snapshot.account_id) if snapshot.account_id else None
        taken = _aware(snapshot.uploaded_at)
        overview.accounts.append(
            AccountRow(
                account_id=snapshot.account_id,
                name=account.name if account else "Unassigned snapshot",
                value_nok=value,
                position_count=count,
                snapshot_at=taken,
                stale=(now - taken).days > STALE_SNAPSHOT_DAYS,
            )
        )
    overview.accounts.sort(key=lambda a: (-a.value_nok, a.name))

    # Allocations.
    by_type: dict[str, tuple[str, Decimal, int]] = {}
    by_sector: dict[str, tuple[str, Decimal, int]] = {}
    by_currency: dict[str, tuple[str, Decimal, int]] = {}
    for holding_id, value in value_by_holding.items():
        h = holdings[holding_id]
        for groups, key, label in (
            (by_type, h.asset_class_raw, display_label(h.asset_class_raw)),
            (by_sector, h.sector or UNCLASSIFIED, h.sector or UNCLASSIFIED),
            (by_currency, h.trading_currency, h.trading_currency),
        ):
            prev_label, prev_value, prev_n = groups.get(key, (label, ZERO, 0))
            groups[key] = (prev_label, prev_value + value, prev_n + 1)
    overview.by_instrument_type = _allocation(by_type, total)
    overview.by_sector = _allocation(by_sector, total)
    overview.by_currency = _allocation(by_currency, total)

    # Concentration over holding weights (0-100).
    ordered = sorted(value_by_holding.items(), key=lambda kv: -kv[1])
    if total > 0:
        weights = [v / total * HUNDRED for _, v in ordered]
        hhi = herfindahl_hirschman_index(weights)
        overview.concentration = Concentration(
            hhi=hhi,
            effective_holdings=(Decimal(10000) / hhi) if hhi > 0 else None,
            top1_pct=sum(weights[:1], ZERO),
            top5_pct=sum(weights[:5], ZERO),
            top10_pct=sum(weights[:10], ZERO),
        )

    # Verdict / moat roll-up over analyzable equities.
    equity_ids = [hid for hid in value_by_holding if holdings[hid].asset_class_raw in EQUITY_ANALYZABLE_TYPES]
    overview.equity_count = len(equity_ids)
    equity_value = sum((value_by_holding[hid] for hid in equity_ids), ZERO)
    overview.equity_value_nok = equity_value
    runs = latest_runs_by_holding(db, equity_ids)

    verdict_groups: dict[str, tuple[int, Decimal]] = {}
    moat_groups: dict[str, tuple[int, Decimal]] = {}
    analyzed_value = ZERO
    ratings: dict[uuid.UUID, tuple[str | None, str | None, datetime | None]] = {}
    for hid in equity_ids:
        value = value_by_holding[hid]
        run = runs.get(hid)
        verdict, moat, analyzed_at = run_ratings(run) if run else (None, None, None)
        ratings[hid] = (verdict, moat, analyzed_at)
        if run is not None:
            overview.analyzed_equity_count += 1
            analyzed_value += value
            if analyzed_at is not None and (now - _aware(analyzed_at)).days > STALE_ANALYSIS_DAYS:
                overview.stale_analysis_count += 1
        for groups, key in ((verdict_groups, verdict or NOT_ANALYZED), (moat_groups, moat or NOT_ANALYZED)):
            n, v = groups.get(key, (0, ZERO))
            groups[key] = (n + 1, v + value)

    def _rating_slices(groups: dict[str, tuple[int, Decimal]], order: tuple[str, ...]) -> list[RatingSlice]:
        return [
            RatingSlice(rating=r, holding_count=groups[r][0], value_nok=groups[r][1],
                        weight_pct=_pct(groups[r][1], equity_value) or ZERO)
            for r in order
            if r in groups
        ]

    overview.verdicts = _rating_slices(verdict_groups, VERDICT_ORDER)
    overview.moats = _rating_slices(moat_groups, MOAT_ORDER)
    overview.analyzed_equity_value_pct = _pct(analyzed_value, equity_value)

    # Position table, largest first.
    for holding_id, value in ordered:
        h = holdings[holding_id]
        verdict, moat, analyzed_at = ratings.get(holding_id, (None, None, None))
        overview.positions.append(
            PositionRow(
                holding_id=holding_id,
                ticker=h.ticker,
                name=h.name,
                instrument_type=h.asset_class_raw,
                sector=h.sector,
                trading_currency=h.trading_currency,
                value_nok=value,
                weight_pct=_pct(value, total),
                account_count=len(accounts_by_holding[holding_id]),
                verdict_rating=verdict,
                moat_rating=moat,
                analyzed_at=analyzed_at,
                analysis_stale=analyzed_at is not None
                and (now - _aware(analyzed_at)).days > STALE_ANALYSIS_DAYS,
            )
        )

    overview.summary = executive_summary(overview)
    return overview


def executive_summary(o: Overview) -> list[SummaryPoint]:
    """Fixed rules over the computed overview. Deterministic: the same
    overview always yields the same sentences, in the same order."""
    points: list[SummaryPoint] = []
    if o.as_of is None or o.total_value_nok <= 0:
        return points

    account_word = "account" if len(o.accounts) == 1 else "accounts"
    points.append(SummaryPoint("info", (
        f"Portfolio value {_fmt_nok(o.total_value_nok)} across {o.holding_count} holdings "
        f"in {len(o.accounts)} {account_word}."
    )))

    c = o.concentration
    if o.positions and c.top1_pct is not None:
        top = o.positions[0]
        tone = "warn" if c.top1_pct > LARGE_POSITION_WARN_PCT else "info"
        points.append(SummaryPoint(tone, (
            f"Largest position is {top.name} at {_fmt_pct(c.top1_pct)} of the portfolio"
            + (f", above the {_fmt_pct(LARGE_POSITION_WARN_PCT)} flag level." if tone == "warn" else ".")
        )))
    if c.top5_pct is not None and c.effective_holdings is not None and o.holding_count > 5:
        points.append(SummaryPoint("info", (
            f"The top 5 holdings are {_fmt_pct(c.top5_pct)} of the portfolio; it behaves like "
            f"{c.effective_holdings.quantize(Decimal('0.1'))} equally weighted positions."
        )))

    for s in o.by_sector:
        if s.key != UNCLASSIFIED and s.weight_pct > SECTOR_WARN_PCT:
            points.append(SummaryPoint("warn", (
                f"{s.label} is {_fmt_pct(s.weight_pct)} of the portfolio, above the "
                f"{_fmt_pct(SECTOR_WARN_PCT)} sector flag level."
            )))
    unclassified = next((s for s in o.by_sector if s.key == UNCLASSIFIED), None)
    if unclassified is not None:
        points.append(SummaryPoint("warn", (
            f"{unclassified.holding_count} holding(s) worth {_fmt_pct(unclassified.weight_pct)} have no "
            "sector; set it on the Holdings page so sector research and allocation are complete."
        )))

    foreign = sum((s.weight_pct for s in o.by_currency if s.key != "NOK"), ZERO)
    if foreign > 0:
        points.append(SummaryPoint("info", f"{_fmt_pct(foreign)} of the portfolio trades in currencies other than NOK."))

    if o.equity_count:
        coverage = o.analyzed_equity_value_pct or ZERO
        tone = "good" if coverage >= 99 else ("warn" if coverage < LOW_COVERAGE_WARN_PCT else "info")
        points.append(SummaryPoint(tone, (
            f"{o.analyzed_equity_count} of {o.equity_count} stocks/equity ETFs have an analysis, "
            f"covering {_fmt_pct(coverage)} of equity value."
        )))

    negative = [p for p in o.positions if p.verdict_rating in ("Sell", "Avoid")]
    if negative:
        weight = sum((p.weight_pct or ZERO for p in negative), ZERO)
        names = ", ".join(p.name for p in negative[:5]) + (" and others" if len(negative) > 5 else "")
        points.append(SummaryPoint("warn", (
            f"Latest analysis rates {len(negative)} holding(s) Sell or Avoid ({_fmt_pct(weight)} of the "
            f"portfolio): {names}."
        )))

    wide = next((m for m in o.moats if m.rating == "Wide"), None)
    if wide is not None and o.analyzed_equity_count:
        points.append(SummaryPoint("good", (
            f"Wide-moat businesses are {_fmt_pct(wide.weight_pct)} of equity value "
            f"({wide.holding_count} holding(s))."
        )))

    if o.stale_analysis_count:
        points.append(SummaryPoint("warn", (
            f"{o.stale_analysis_count} analysis(es) are older than {STALE_ANALYSIS_DAYS} days; re-run them."
        )))
    stale_accounts = [a for a in o.accounts if a.stale]
    if stale_accounts:
        points.append(SummaryPoint("warn", (
            f"{len(stale_accounts)} account(s) have a snapshot older than {STALE_SNAPSHOT_DAYS} days: "
            + ", ".join(a.name for a in stale_accounts) + ". Re-import the latest export."
        )))
    if o.positions_missing_value:
        points.append(SummaryPoint("warn", (
            f"{o.positions_missing_value} position(s) have no market value and count as 0 in these totals."
        )))
    return points
