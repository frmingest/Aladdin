"""Fund look-through valuation — what the fund's own holdings are worth as
a basket, so an ETF can sit on the margin-of-safety board next to the stocks.

A fund has no financial statements, so the owner-earnings DCF cannot run on
it. What it does have (after a holdings import) is a list of the businesses
it owns with weights. The look-through uses the market's own earnings
multiple for each one:

1. fund earnings yield = sum(weight x 1/PE) / sum(weight), over the
   constituents that have a positive trailing P/E (aggregate earnings over
   aggregate price — the harmonic, not the arithmetic, mean of the P/Es);
2. fair P/E for the basket = (1 + g) / (r - g), the Gordon multiple of a
   business that pays out its earnings and grows at g forever, r being the
   same CAPM cost of equity the DCF uses and g the versioned terminal growth
   (bear/bull move g by the same offsets the DCF uses);
3. fair value per fund unit = price x fair P/E x fund earnings yield.

This is a SCREEN, not a DCF: it credits no growth above terminal growth, so
a basket of fast growers will read expensive by construction — that is the
"what are you paying per krone of today's earnings" question a
Buffett/Munger reader asks, and the result says so (`method_note`). It does
not use the DCF's per-company growth or owner earnings.

Fail-visibly: coverage is reported, and below MIN_COVERAGE_PCT the
valuation is withheld ("unavailable") rather than extrapolated; the
plausibility guard (value more than `max_ratio` x or less than 1/`max_ratio`
of the price) withholds it as "implausible" like the other models.
CLAUDE.md Rule 1: all arithmetic here, no LLM.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.fund import FundConstituentMultiple
from app.models.holding import Holding
from app.services.funds.facts import latest_exposures

MIN_COVERAGE_PCT = Decimal(60)
STALE_AFTER_DAYS = 14
ZERO = Decimal(0)
HUNDRED = Decimal(100)
METHOD_NOTE = (
    "Look-through earnings-yield screen: the fund's holdings' trailing earnings vs today's price, "
    "against the Gordon P/E at the DCF's cost of equity and terminal growth. Credits no growth "
    "above terminal growth, so fast-growing baskets read expensive by construction. Not a DCF."
)


@dataclass(frozen=True)
class LookThroughScenario:
    label: str
    growth_rate: Decimal
    fair_pe: Decimal
    value_per_unit: Decimal


@dataclass
class FundLookThroughValuation:
    scenarios: list[LookThroughScenario]
    fund_earnings_yield: Decimal
    fund_pe: Decimal
    coverage_pct: Decimal
    constituents_used: int
    constituents_total: int
    cost_of_equity: Decimal
    terminal_growth_rate: Decimal
    current_price_per_unit: Decimal | None = None
    oldest_observation: datetime | None = None
    notes: list[str] = field(default_factory=list)
    method_note: str = METHOD_NOTE

    def scenario(self, label: str) -> LookThroughScenario:
        for candidate in self.scenarios:
            if candidate.label == label:
                return candidate
        raise KeyError(f"No {label!r} scenario in this result")

    def margin_of_safety(self, label: str) -> Decimal | None:
        """(value - price) / value, same convention as the DCF."""
        if self.current_price_per_unit is None:
            return None
        value = self.scenario(label).value_per_unit
        if value == ZERO:
            return None
        return (value - self.current_price_per_unit) / value


class LookThroughUnavailable(ValueError):
    """The valuation cannot be computed; the message says why."""


def gordon_pe(cost_of_equity: Decimal, growth: Decimal) -> Decimal:
    if cost_of_equity <= growth:
        raise LookThroughUnavailable(
            f"cost of equity {cost_of_equity * 100:.1f}% is not above the growth rate {growth * 100:.1f}%: "
            "no finite fair P/E"
        )
    return (1 + growth) / (cost_of_equity - growth)


def compute_look_through(
    *,
    constituents: list[tuple[Decimal, Decimal | None]],
    cost_of_equity: Decimal,
    terminal_growth: Decimal,
    bull_offset: Decimal,
    bear_offset: Decimal,
    current_price: Decimal | None,
) -> FundLookThroughValuation:
    """`constituents` = (weight %, trailing P/E or None) for every equity
    line of the fund; a P/E that is None or not positive is uncovered."""
    total_weight = sum((w for w, _pe in constituents), ZERO)
    if total_weight <= 0:
        raise LookThroughUnavailable("the fund has no equity holdings imported")
    covered = [(w, pe) for w, pe in constituents if pe is not None and pe > 0]
    covered_weight = sum((w for w, _pe in covered), ZERO)
    coverage = covered_weight * HUNDRED / total_weight
    if coverage < MIN_COVERAGE_PCT:
        raise LookThroughUnavailable(
            f"the look-through covers only {coverage:.0f}% of the fund's equity weight "
            f"({len(covered)} of {len(constituents)} holdings have a positive trailing P/E); "
            f"needs at least {MIN_COVERAGE_PCT:.0f}%"
        )
    if current_price is None:
        raise LookThroughUnavailable("no current price for the fund")
    earnings_yield = sum((w / pe for w, pe in covered), ZERO) / covered_weight
    scenarios = []
    for label, growth in (
        ("bear", terminal_growth - bear_offset),
        ("base", terminal_growth),
        ("bull", terminal_growth + bull_offset),
    ):
        fair_pe = gordon_pe(cost_of_equity, growth)
        scenarios.append(LookThroughScenario(label, growth, fair_pe, current_price * fair_pe * earnings_yield))
    return FundLookThroughValuation(
        scenarios=scenarios,
        fund_earnings_yield=earnings_yield,
        fund_pe=1 / earnings_yield,
        coverage_pct=coverage,
        constituents_used=len(covered),
        constituents_total=len(constituents),
        cost_of_equity=cost_of_equity,
        terminal_growth_rate=terminal_growth,
        current_price_per_unit=current_price,
    )


def load_constituents(db: Session, fund: Holding) -> tuple[list[tuple[Decimal, Decimal | None]], datetime | None, int]:
    """(weight %, trailing P/E) per equity line of the fund's latest holdings
    import, the oldest P/E observation time, and how many lines have no
    stored P/E row at all (never refreshed)."""
    _as_of, exposures = latest_exposures(db, fund.id, "holding")
    stored = {
        (m.lookup_key or m.isin): m
        for m in db.scalars(select(FundConstituentMultiple).where(FundConstituentMultiple.holding_id == fund.id))
        if (m.lookup_key or m.isin)
    }
    linked_tickers = {
        h.id: h.ticker
        for h in db.scalars(
            select(Holding).where(Holding.id.in_({e.linked_holding_id for e in exposures if e.linked_holding_id}))
        )
    }
    constituents: list[tuple[Decimal, Decimal | None]] = []
    oldest: datetime | None = None
    unrefreshed = 0
    for exposure in exposures:
        key = exposure.isin or linked_tickers.get(exposure.linked_holding_id)
        row = stored.get(key) if key else None
        if row is None:
            unrefreshed += 1
            constituents.append((exposure.weight_pct, None))
            continue
        constituents.append((exposure.weight_pct, row.trailing_pe))
        observed = row.observed_at if row.observed_at.tzinfo else row.observed_at.replace(tzinfo=timezone.utc)
        oldest = observed if oldest is None or observed < oldest else oldest
    return constituents, oldest, unrefreshed
