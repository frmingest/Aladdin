"""Justified price-to-book valuation for banks and insurers (2026-09-29).

Why this exists: an owner-earnings DCF (net income + D&A - capex) assumes
all profit can be paid out. A bank cannot: its regulators require it to
retain capital in proportion to its balance sheet, so most of what it earns
while growing stays in the business. Applying the DCF to SB1NO.OL gave
~1.8x the share price *before* any growth was assumed
(docs/sb1no-implausible-dcf-investigation-2026-09-29.md).

The standard replacement is the justified price-to-book ratio from the
Gordon-growth / residual-income framework:

    justified P/B = (ROE - g) / (cost of equity - g)

A bank earning exactly its cost of equity is worth book value (P/B = 1);
one that earns more is worth a premium in proportion to the spread. Value
per share = justified P/B x book value per share. CLAUDE.md Rule 1: every
number is plain arithmetic here; ROE, book value, cost of equity and g are
all supplied by the caller from filed facts and the versioned assumptions.
"""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

ZERO = Decimal(0)


def justified_price_to_book(roe: Decimal, cost_of_equity: Decimal, growth: Decimal) -> Decimal:
    """(ROE - g) / (cost of equity - g). Never below zero: a bank whose ROE
    sits under the growth rate destroys value by growing, and its equity is
    worth no more than nothing on this basis rather than a negative number.

    Raises ValueError when cost of equity does not exceed g (the formula is
    undefined, same rule as dcf.terminal_value)."""
    spread = cost_of_equity - growth
    if spread <= ZERO:
        raise ValueError(
            f"Cannot compute justified P/B: cost of equity ({cost_of_equity}) must exceed "
            f"growth ({growth})"
        )
    return max((roe - growth) / spread, ZERO)


@dataclass(frozen=True)
class FinancialsScenario:
    label: str  # "bear" | "base" | "bull"
    roe: Decimal
    justified_price_to_book: Decimal
    value_per_share: Decimal


@dataclass(frozen=True)
class FinancialsValuation:
    scenarios: list[FinancialsScenario]
    cost_of_equity: Decimal
    growth_rate: Decimal
    book_value_per_share: Decimal
    roe_periods_used: int
    roe_was_capped: bool
    current_price_per_share: Decimal | None = None

    def scenario(self, label: str) -> FinancialsScenario:
        for candidate in self.scenarios:
            if candidate.label == label:
                return candidate
        raise KeyError(f"No {label!r} scenario in this result")

    def margin_of_safety(self, label: str) -> Decimal | None:
        """(value - price) / value, same convention as DCFScenarioResult."""
        if self.current_price_per_share is None:
            return None
        value = self.scenario(label).value_per_share
        if value == ZERO:
            return None
        return (value - self.current_price_per_share) / value


def financials_valuation(
    *,
    roes: Sequence[Decimal],
    book_value_per_share: Decimal,
    cost_of_equity: Decimal,
    growth_rate: Decimal,
    max_roe: Decimal,
    roe_spread: Decimal,
    current_price_per_share: Decimal | None = None,
) -> FinancialsValuation:
    """Bear/base/bull justified-P/B values around the average of `roes`.

    Raises ValueError (fail visibly, never guess) when there is no ROE, the
    book value is not positive, or the base-case ROE does not exceed growth
    (no positive value can be justified on this basis)."""
    if not roes:
        raise ValueError("Cannot value on justified P/B: no ROE for any period")
    if book_value_per_share <= ZERO:
        raise ValueError("Cannot value on justified P/B: book value per share is not positive")
    average = sum(roes, ZERO) / Decimal(len(roes))
    capped = average > max_roe
    base_roe = min(average, max_roe)
    if base_roe <= growth_rate:
        raise ValueError(
            f"Cannot value on justified P/B: average ROE ({base_roe:.4f}) does not exceed growth "
            f"({growth_rate}) — the bank does not earn its cost of growth"
        )
    scenarios = []
    for label, roe in (
        ("bear", base_roe - roe_spread),
        ("base", base_roe),
        ("bull", base_roe + roe_spread),
    ):
        pb = justified_price_to_book(roe, cost_of_equity, growth_rate)
        scenarios.append(
            FinancialsScenario(
                label=label,
                roe=roe,
                justified_price_to_book=pb,
                value_per_share=pb * book_value_per_share,
            )
        )
    return FinancialsValuation(
        scenarios=scenarios,
        cost_of_equity=cost_of_equity,
        growth_rate=growth_rate,
        book_value_per_share=book_value_per_share,
        roe_periods_used=len(roes),
        roe_was_capped=capped,
        current_price_per_share=current_price_per_share,
    )
