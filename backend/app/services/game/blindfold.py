"""Blindfold Years (game mode E1, 2026-10-15).

A puzzle is one (holding, fiscal year t): the stored annual figures up to year
t with the company name masked, and the next year's owner earnings withheld.
The player stakes a low and a high figure; `reveal` then compares them with
the stored figure.

Pure functions first (no database, provider, model or clock); the last
section only gathers stored rows. CLAUDE.md Rule 1: every number, ratio and
comparison here is application code, the LLM is not involved. Reported
figures only, never prices, so the price and split fixes cannot leak in.

What stays out of the puzzle payload, on purpose: the answer, the company
name and ticker, the real fiscal-year labels (years are shown as "Year -3 ..
Year 0"), the reporting currency, and the source file names. (The puzzle id is
only a lookup key, "<holding id>:<year>"; the page never shows it.)
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.game_mapping.blindfold_v1 import BlindfoldRules
from app.domain.sectors import is_financial_sector
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.services import metrics as metrics_svc
from app.services.holding_facts import PeriodFacts, facts_by_period, period_for_year

ZERO = Decimal(0)
HUNDRED = Decimal(100)

# The rows shown for each year, in order: (key, label, kind).
ROWS: tuple[tuple[str, str, str], ...] = (
    ("revenue", "Revenue", "money"),
    ("operating_margin", "Operating margin", "ratio"),
    ("net_margin", "Net margin", "ratio"),
    ("owner_earnings", "Owner earnings", "money"),
    ("net_debt", "Net debt", "money"),
    ("roic", "Return on invested capital", "ratio"),
)


@dataclass(frozen=True)
class HoldingInput:
    id: uuid.UUID
    name: str
    ticker: str
    sector: str | None
    periods: dict[str, PeriodFacts]


@dataclass(frozen=True)
class Cell:
    value: Decimal | None
    fog: str | None = None
    """Why the cell is empty. An empty cell is fog, never a filled-in guess."""


@dataclass(frozen=True)
class YearColumn:
    label: str
    """"Year -3" .. "Year 0": relative, so the calendar year does not give the company away."""
    cells: dict[str, Cell]


@dataclass(frozen=True)
class StakeDomain:
    min: Decimal
    max: Decimal


@dataclass(frozen=True)
class Puzzle:
    puzzle_id: str
    sector: str | None
    years: list[YearColumn]
    stake_domain: StakeDomain
    last_owner_earnings: Decimal


@dataclass(frozen=True)
class Reveal:
    puzzle_id: str
    actual: Decimal
    low: Decimal
    high: Decimal
    inside: bool
    position: str
    """"below", "inside" or "above" the staked range."""
    width_class: str | None
    """"narrow", "medium" or "wide" (None when last year's owner earnings are zero)."""
    last_owner_earnings: Decimal
    shown_period: str
    answer_period: str
    answer_year: int


# --- ids ---------------------------------------------------------------------


def make_puzzle_id(holding_id: uuid.UUID, year: int) -> str:
    return f"{holding_id}:{year}"


def parse_puzzle_id(puzzle_id: str) -> tuple[uuid.UUID, int]:
    try:
        raw_id, raw_year = puzzle_id.split(":", 1)
        return uuid.UUID(raw_id), int(raw_year)
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"not a puzzle id: {puzzle_id!r}") from exc


def _order_key(puzzle_id: str) -> str:
    """A fixed shuffle: the same pool always comes in the same order."""
    return hashlib.sha1(puzzle_id.encode("utf-8")).hexdigest()


# --- eligibility --------------------------------------------------------------


def _window(holding: HoldingInput, year: int, rules: BlindfoldRules) -> dict[int, PeriodFacts] | None:
    """The consecutive annual periods year-prior..year+1, or None when any is
    missing, mixed-currency, in another currency than the rest, without
    computable owner earnings, or carrying a data-quality flag."""
    if is_financial_sector(holding.sector):
        return None
    out: dict[int, PeriodFacts] = {}
    for y in range(year - rules.min_prior_years, year + 2):
        period = period_for_year(holding.periods, y)
        if period is None or period.currency is None:
            return None
        basis, _ = metrics_svc.owner_basis_facts(period.facts)
        if metrics_svc.owner_earnings_from_facts(period.facts) is None:
            return None
        if metrics_svc.data_quality_warnings(period.facts, basis):
            return None
        out[y] = period
    if len({p.currency for p in out.values()}) != 1:
        return None
    return out


def eligible_years(holding: HoldingInput, rules: BlindfoldRules) -> list[int]:
    years = sorted({p.year for p in holding.periods.values() if p.year is not None})
    return [y for y in years if _window(holding, y, rules) is not None]


def build_pool(holdings: list[HoldingInput], rules: BlindfoldRules) -> list[str]:
    """Every puzzle id on offer, in a fixed shuffled order."""
    ids = [make_puzzle_id(h.id, y) for h in holdings for y in eligible_years(h, rules)]
    return sorted(ids, key=_order_key)


# --- the puzzle ---------------------------------------------------------------


def _owner_earnings(period: PeriodFacts) -> Decimal:
    result = metrics_svc.owner_earnings_from_facts(period.facts)
    assert result is not None  # _window only returns periods where it is computable
    return result[0]


def _column(label: str, period: PeriodFacts, previous: PeriodFacts | None) -> YearColumn:
    result = metrics_svc.compute_holding_metrics(
        period.facts, period.currencies, prior_facts=previous.facts if previous else None
    )
    cells: dict[str, Cell] = {}
    for key, _label, _kind in ROWS:
        if key == "revenue":
            value = period.facts.get("revenue")
            cells[key] = Cell(value) if value is not None else Cell(None, "not filed")
        elif key == "owner_earnings":
            cells[key] = Cell(_owner_earnings(period))
        elif key in result.computed:
            cells[key] = Cell(result.computed[key])
        else:
            cells[key] = Cell(None, result.skipped.get(key, "not available"))
    return YearColumn(label=label, cells=cells)


def stake_domain(series: list[Decimal], rules: BlindfoldRules) -> StakeDomain:
    """The slider range, from the years SHOWN only. Never from the answer."""
    lo, hi = min(series), max(series)
    magnitude = max(abs(lo), abs(hi))
    span = max(hi - lo, magnitude / 4)
    if span == ZERO:
        span = Decimal(1)
    pad = span * rules.domain_padding
    return StakeDomain(min=lo - pad, max=hi + pad)


def build_puzzle(holding: HoldingInput, year: int, rules: BlindfoldRules) -> Puzzle | None:
    window = _window(holding, year, rules)
    if window is None:
        return None
    shown = list(range(year - rules.min_prior_years, year + 1))
    columns = [
        _column(f"Year {y - year}" if y != year else "Year 0", window[y], period_for_year(holding.periods, y - 1))
        for y in shown
    ]
    series = [_owner_earnings(window[y]) for y in shown]
    return Puzzle(
        puzzle_id=make_puzzle_id(holding.id, year),
        sector=holding.sector,
        years=columns,
        stake_domain=stake_domain(series, rules),
        last_owner_earnings=series[-1],
    )


# --- the reveal ---------------------------------------------------------------


def width_class(low: Decimal, high: Decimal, last: Decimal, rules: BlindfoldRules) -> str | None:
    if last == ZERO:
        return None
    pct = (high - low) / abs(last) * HUNDRED
    if pct < rules.width_narrow_pct:
        return "narrow"
    if pct > rules.width_wide_pct:
        return "wide"
    return "medium"


def build_reveal(holding: HoldingInput, year: int, low: Decimal, high: Decimal, rules: BlindfoldRules) -> Reveal | None:
    """Compare the staked range with the stored next-year figure. A value equal
    to a bound counts as inside. None when the puzzle is not on offer."""
    if low > high:
        raise ValueError("the low stake is above the high stake")
    window = _window(holding, year, rules)
    if window is None:
        return None
    actual = _owner_earnings(window[year + 1])
    last = _owner_earnings(window[year])
    inside = low <= actual <= high
    position = "inside" if inside else ("below" if actual < low else "above")
    return Reveal(
        puzzle_id=make_puzzle_id(holding.id, year),
        actual=actual,
        low=low,
        high=high,
        inside=inside,
        position=position,
        width_class=width_class(low, high, last, rules),
        last_owner_earnings=last,
        shown_period=window[year].period,
        answer_period=window[year + 1].period,
        answer_year=year + 1,
    )


# --- stored rows ----------------------------------------------------------------


def load_holdings(db: Session) -> list[HoldingInput]:
    out: list[HoldingInput] = []
    for holding in db.scalars(select(Holding)):
        periods = facts_by_period(db, holding.id)
        if periods:
            out.append(HoldingInput(holding.id, holding.name, holding.ticker, holding.sector, periods))
    return out


def find_holding(db: Session, holding_id: uuid.UUID) -> HoldingInput | None:
    holding = db.get(Holding, holding_id)
    if holding is None:
        return None
    return HoldingInput(holding.id, holding.name, holding.ticker, holding.sector, facts_by_period(db, holding.id))


def source_file(db: Session, holding_id: uuid.UUID, period: str) -> str | None:
    """The file the answer year's net income was read from (shown after the reveal only)."""
    return db.scalar(
        select(Document.original_filename)
        .join(FinancialLineItem, FinancialLineItem.document_id == Document.id)
        .where(
            FinancialLineItem.holding_id == holding_id,
            FinancialLineItem.period == period,
            FinancialLineItem.metric == "net_income",
        )
        .limit(1)
    )
