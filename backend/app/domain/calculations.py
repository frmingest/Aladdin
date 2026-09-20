"""
Deterministic financial and portfolio arithmetic (architecture §2.2, §17,
§26 Phase 2).

Every function here is pure application code — no LLM involvement — per the
core design rule: "If a number can be calculated reliably by code, do not
ask the LLM to calculate it." These are the building blocks for financial
metrics (growth, margins, ROIC/ROE, valuation multiples, dividend yield),
FX conversion, P&L, and concentration/exposure.

Conventions:
- Ratios that are conventionally expressed as percentages (growth, margins,
  ROIC/ROE, dividend yield, weights) return a Decimal already scaled to
  percentage points (e.g. 12.5 means 12.5%), not a 0-1 fraction.
- A function returns None, never 0 or a fabricated value, when the inputs
  don't support a meaningful answer (missing data, zero/negative
  denominator where that's undefined). §13.3/§21: never present missing
  information as false precision, never invent a number that looks real.
  Callers are expected to render None as "insufficient data", not as "0".
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import overload

MONEY_PLACES = Decimal("0.01")
PERCENT_PLACES = Decimal("0.0001")
# For plain (non-percentage) ratios -- interest coverage, Net Debt/EBITDA,
# Net Debt/FCF, D/E -- rendered as e.g. "3.45x", not a currency amount.
RATIO_PLACES = Decimal("0.01")


@overload
def quantize(value: Decimal, places: Decimal = MONEY_PLACES) -> Decimal: ...
@overload
def quantize(value: None, places: Decimal = MONEY_PLACES) -> None: ...
def quantize(value: Decimal | None, places: Decimal = MONEY_PLACES) -> Decimal | None:
    """Rounds a computed value to a fixed number of decimal places at the
    point it becomes something a user sees or a value gets persisted for
    display — never applied to intermediate arithmetic. Decimal
    multiplication/division naturally grows its scale (e.g. a price with 6
    decimal places times an FX rate with 8 produces 14), and displaying
    that raw is itself a form of false precision (§13.3) — it implies a
    level of accuracy the inputs don't have. Defaults to money's 2 decimal
    places (cents); pass `places=Decimal("0.0001")` for a percentage, which
    matches the precision the upload schema already stores weights at
    (portfolio_positions.weight_pct, Numeric(9,4)).

    Overloaded (rather than a single `Decimal | None -> Decimal | None`
    signature) so a call site passing a value it knows is non-None gets
    back a plain `Decimal`, not `Decimal | None` — the untyped version
    made every such call site look like it could produce None (a mypy
    arg-type/assignment error against a `Decimal`-typed field or a
    `list[Decimal]`) even though `quantize` only ever returns None when
    its input was None. See PROGRESS.md's 2026-09-14 verification pass."""
    if value is None:
        return None
    return value.quantize(places, rounding=ROUND_HALF_UP)


# --- growth, margins, returns ---------------------------------------------


def growth_rate(current: Decimal | None, previous: Decimal | None) -> Decimal | None:
    """Percentage change from `previous` to `current` (e.g. revenue growth).

    Undefined (returns None) when either value is missing or `previous` is
    zero — a "growth rate off a zero base" is not a meaningful percentage.
    """
    if current is None or previous is None or previous == 0:
        return None
    return (current - previous) / abs(previous) * Decimal("100")


def margin_pct(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    """A margin expressed as a percentage of `denominator` (e.g. EBITDA
    margin = EBITDA / revenue). Also used for ROIC/ROE (see aliases below) —
    the underlying arithmetic is identical; the names exist so call sites
    stay self-documenting."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator * Decimal("100")


# ROIC/ROE are the same ratio-as-percentage shape as a margin; named
# wrappers so callers read naturally and so the metric name is explicit at
# the call site rather than inferred from argument order.
def return_on_invested_capital(nopat: Decimal | None, invested_capital: Decimal | None) -> Decimal | None:
    return margin_pct(nopat, invested_capital)


def return_on_equity(net_income: Decimal | None, total_equity: Decimal | None) -> Decimal | None:
    return margin_pct(net_income, total_equity)


def dividend_yield(annual_dividend_per_share: Decimal | None, price: Decimal | None) -> Decimal | None:
    """Trailing dividend yield as a percentage of the current price."""
    if annual_dividend_per_share is None or price is None or price <= 0:
        return None
    if annual_dividend_per_share < 0:
        return None
    return annual_dividend_per_share / price * Decimal("100")


# --- owner earnings / cash generation (Buffett/Munger redesign, §2.2) ------


def free_cash_flow(operating_cash_flow: Decimal | None, capex: Decimal | None) -> Decimal | None:
    """A standard "owner earnings" proxy: operating cash flow less capital
    expenditure. Deliberately the plain textbook definition, not Buffett's
    fuller "owner earnings" (which also adjusts for maintenance-vs-growth
    capex and normalizes working-capital swings) -- that finer distinction
    needs data this codebase doesn't extract yet (see
    claude/buffett-munger-redesign-sprint-plan-2026-09-20.md's Phase 9/
    evidence-quality follow-up) and would be false precision to fake here.

    `capex` is expected as a positive figure (spend), matching how
    app.domain.valuation.compute_dcf_value's `capex_pct_of_revenue`
    assumption is applied. Returns None -- never a fabricated figure -- when
    either input is missing, so a caller renders "insufficient data" rather
    than a silent zero (§13.3/§21).
    """
    if operating_cash_flow is None or capex is None:
        return None
    return operating_cash_flow - capex


def average_over_periods(values: list[Decimal | None]) -> Decimal | None:
    """A plain arithmetic mean over however many periods actually have a
    value -- the "3-to-5-year average ROIC/ROE/margin" style metric the
    Buffett/Munger framework calls for (a single-period ratio can be
    noisy/cyclical in a way a multi-year average is not).

    Callers pass whatever periods they have (as few as one, as many as
    five-plus) after computing each period's ratio with the existing
    single-period functions above (e.g. `return_on_invested_capital` per
    year) -- this function does not know or care what the values represent,
    it only averages. `None` entries (a period with insufficient data for
    that ratio) are skipped rather than treated as zero, which would
    silently understate the average (§13.3). Returns None -- never a
    fabricated 0 -- when no period has a usable value at all.
    """
    present = [v for v in values if v is not None]
    if not present:
        return None
    return sum(present, Decimal("0")) / len(present)


# --- valuation multiples ----------------------------------------------------


def ratio(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    """A plain (non-percentage) ratio — P/E, EV/EBITDA, P/B, debt/EBITDA.

    A negative or zero denominator makes these multiples not meaningful in
    the conventional sense (e.g. "P/E" on negative earnings) — return None
    rather than a misleading negative multiple (§13.3).
    """
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator


def net_debt(total_debt: Decimal | None, cash_and_equivalents: Decimal | None) -> Decimal | None:
    if total_debt is None or cash_and_equivalents is None:
        return None
    return total_debt - cash_and_equivalents


# --- FX -----------------------------------------------------------------


def convert_currency(amount: Decimal | None, fx_rate: Decimal | None) -> Decimal | None:
    """Converts `amount` (in the FX rate's `from_currency`) using a rate
    already expressed as from_currency -> to_currency (see
    app.providers.base.FxRate). A rate of exactly 1 for a same-currency
    "conversion" is expected and correct, not a sentinel for "missing"."""
    if amount is None or fx_rate is None:
        return None
    return amount * fx_rate


# --- P&L -------------------------------------------------------------------


def unrealized_pnl(market_value: Decimal | None, cost_basis_value: Decimal | None) -> Decimal | None:
    """Absolute unrealized gain/loss, in whatever currency both inputs share
    (the caller is responsible for converting to a common currency first —
    see convert_currency)."""
    if market_value is None or cost_basis_value is None:
        return None
    return market_value - cost_basis_value


def unrealized_pnl_pct(market_value: Decimal | None, cost_basis_value: Decimal | None) -> Decimal | None:
    """Unrealized gain/loss as a percentage of cost basis. Undefined for a
    zero or negative cost basis (e.g. a fully written-down position)."""
    if market_value is None or cost_basis_value is None or cost_basis_value <= 0:
        return None
    return (market_value - cost_basis_value) / cost_basis_value * Decimal("100")


# --- concentration / exposure (§15, §19) ------------------------------------


def herfindahl_hirschman_index(weights_pct: list[Decimal]) -> Decimal | None:
    """Standard HHI on percentage weights (0-100 scale in, 0-10000 scale
    out): sum of each share's squared percentage. Conventional bands (US
    DOJ/FTC merger-guideline convention, used here only as a rough
    reference, not a regulatory claim): <1500 unconcentrated, 1500-2500
    moderately concentrated, >2500 highly concentrated.

    Returns None for an empty input (no basis for a concentration figure)
    rather than 0, which would misleadingly read as "perfectly
    diversified".
    """
    if not weights_pct:
        return None
    return sum((w * w for w in weights_pct), Decimal("0"))


def largest_weight_pct(weights_pct: list[Decimal]) -> Decimal | None:
    """The single largest position weight — a concentration signal that's
    easier to read at a glance than HHI alone."""
    if not weights_pct:
        return None
    return max(weights_pct)


def weights_by_group(values_by_key: dict[str, Decimal], total: Decimal | None = None) -> dict[str, Decimal]:
    """Converts a {group_key: value} map (e.g. {"NOK": 120000, "USD": 30000})
    into {group_key: weight_pct}. `total` defaults to the sum of the values
    given; pass it explicitly when the group total should be measured
    against a larger portfolio total than just the groups present here
    (e.g. groups that excluded some unvalued holdings).

    Returns an empty dict — never a dict with NaN/garbage weights — when
    the total is zero or negative.
    """
    denominator = total if total is not None else sum(values_by_key.values(), Decimal("0"))
    if not values_by_key or denominator is None or denominator <= 0:
        return {}
    return {key: (value / denominator * Decimal("100")) for key, value in values_by_key.items()}
