"""What today's price assumes, for a company the DCF cannot value (2026-10-14).

A loss-making company has no owner-earnings base to project, so the DCF stays
unavailable and the company is not ranked. This module answers a different,
smaller question with plain arithmetic and no forecast: if the shares are worth
today's price, what yearly owner earnings would the market already be counting
on, held at the terminal growth rate, to earn the cost of equity?

    market cap = owner earnings x (1 + g) / (r - g)
    owner earnings needed = market cap x (r - g) / (1 + g)

It is the Gordon terminal value in `dcf.terminal_value`, solved for the cash
flow instead of the value. It is information only: it is never a score, a zone,
a margin of safety or a price target, and nothing ranks on it (CLAUDE.md Rule 1:
deterministic arithmetic; nothing here invents an assumption, the discount rate
and terminal growth rate are supplied by the caller).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

ZERO = Decimal(0)
ONE = Decimal(1)


@dataclass(frozen=True)
class PriceAssumes:
    price_per_share: Decimal
    shares_outstanding: Decimal
    market_cap: Decimal
    discount_rate: Decimal
    terminal_growth_rate: Decimal
    # Yearly owner earnings (valuation currency) the price needs, in total and per share.
    required_owner_earnings: Decimal
    required_per_share: Decimal
    # The company's own latest owner earnings and its period, for the comparison
    # (negative for a loss-making company). None when not known.
    latest_owner_earnings: Decimal | None = None
    latest_period: str | None = None


def price_assumes(
    *,
    price_per_share: Decimal,
    shares_outstanding: Decimal,
    discount_rate: Decimal,
    terminal_growth_rate: Decimal,
    latest_owner_earnings: Decimal | None = None,
    latest_period: str | None = None,
) -> PriceAssumes:
    """The yearly owner earnings that justify `price_per_share` at the given
    discount and terminal growth rates. Raises ValueError for a non-positive
    price or share count, or a discount rate that does not exceed the growth rate."""
    if price_per_share <= ZERO:
        raise ValueError("Cannot read the price: price per share must be positive")
    if shares_outstanding <= ZERO:
        raise ValueError("Cannot read the price: shares outstanding must be positive")
    spread = discount_rate - terminal_growth_rate
    if spread <= ZERO:
        raise ValueError(
            f"Cannot read the price: discount rate ({discount_rate}) must exceed "
            f"terminal growth rate ({terminal_growth_rate})"
        )
    market_cap = price_per_share * shares_outstanding
    required = market_cap * spread / (ONE + terminal_growth_rate)
    return PriceAssumes(
        price_per_share=price_per_share,
        shares_outstanding=shares_outstanding,
        market_cap=market_cap,
        discount_rate=discount_rate,
        terminal_growth_rate=terminal_growth_rate,
        required_owner_earnings=required,
        required_per_share=required / shares_outstanding,
        latest_owner_earnings=latest_owner_earnings,
        latest_period=latest_period,
    )
