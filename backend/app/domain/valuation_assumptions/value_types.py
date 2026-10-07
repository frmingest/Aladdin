"""The shape every valuation-assumptions version conforms to — kept
separate from a specific version (v1.py) so a future v2 imports the same
dataclass rather than redefining it."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class ValuationAssumptions:
    version: str

    # Equity risk premium by currency, as a FRACTION (0.045 = 4.5%) —
    # combined with the live risk-free rate and a holding's beta in
    # app/services/valuation/discount_rate.py's CAPM cost of equity.
    equity_risk_premium: dict[str, Decimal] = field(default_factory=dict)
    # Used for a currency with no entry above.
    default_equity_risk_premium: Decimal = Decimal("0.055")

    # Gordon-growth terminal growth rate, as a fraction — must stay below
    # any scenario's discount rate or the terminal-value formula is
    # undefined (app/services/valuation/dcf.py raises rather than dividing
    # by a non-positive number).
    terminal_growth_rate: Decimal = Decimal("0.025")

    # How many years of explicit projection before the terminal value.
    projection_years: int = 10

    # Added to / subtracted from the deterministically-computed historical
    # base-case growth rate (app/services/valuation/growth.py) to produce
    # the bull/bear scenarios — not independent forecasts, just a
    # documented, versioned spread around the base case.
    bull_growth_offset: Decimal = Decimal("0.03")
    bear_growth_offset: Decimal = Decimal("0.03")

    # Used only when a holding's live beta (app/providers/base.py's
    # MarketDataProvider.get_beta) is unavailable.
    default_beta: Decimal = Decimal("1.0")

    # --- v2 (2026-09-29): guardrails against implausible valuations -------
    # The defaults below leave every guardrail OFF, so v1 (which never set
    # them) keeps producing exactly the numbers it always did — CLAUDE.md
    # Rule 3, never edit a version a real run has used.

    # Ceiling on the base-case growth rate taken from historical CAGR. A
    # raw CAGR is not a forecast: SB1NO.OL's owner earnings compounded at
    # 31.5%/yr across a bank merger, and projecting that for 10 years gave
    # a "DCF value" 17x the share price.
    max_base_growth: Decimal | None = None
    # When True, explicit-period growth fades linearly from the (capped)
    # base rate in year 1 to the terminal growth rate in the final year,
    # instead of compounding one rate for the whole window.
    fade_growth_to_terminal: bool = False
    # Floor under the CAPM cost of equity. A low observed beta (banks,
    # utilities: 0.4-0.6) pushes CAPM below what any equity investor would
    # accept, which inflates every value derived from it.
    min_cost_of_equity: Decimal | None = None
    # A DCF whose base value is more than this multiple of the price (or
    # less than 1/multiple of it) is treated as a model failure, not a
    # finding: it is withheld from the margin of safety, price target and
    # the analysis evidence, and the reason is shown instead.
    plausibility_max_ratio: Decimal | None = None

    # Banks/insurers: owner earnings are not distributable (regulatory
    # capital must be retained), so an owner-earnings DCF does not apply.
    # A holding whose sector contains one of these (case-insensitive) is
    # valued on justified price-to-book instead:
    #   P/B = (ROE - g) / (cost of equity - g).
    financials_sector_keywords: tuple[str, ...] = ()
    # How many of the latest fiscal years' ROE are averaged (fewer if the
    # holding has fewer periods on file).
    financials_roe_history_years: int = 5
    # ROE above this is not assumed sustainable (competitive erosion).
    financials_max_roe: Decimal = Decimal("0.20")
    # Bull/bear scenarios move the ROE by this many points around base.
    financials_roe_spread: Decimal = Decimal("0.02")


    # --- v3 (2026-10-03): how the growth base is chosen ---------------------
    # "earliest_period" (v1, v2): CAGR from the earliest period on file, which
    # fails when that year is a loss. "profitable_run" (v3): CAGR over the
    # latest unbroken run of profitable years (app/services/valuation/growth.py
    # profitable_run_cagr), so one early loss year no longer blocks a company
    # that is profitable now.
    growth_base_method: str = "earliest_period"

    # --- v4 (2026-10-07): where the DCF starts when earnings are uneven -----
    # "latest_year" (v1-v3): start from the latest year's owner earnings.
    # "normalised_median" (v4): when the latest `normalisation_window_years`
    # fiscal years are volatile (any year above `normalisation_dispersion` x
    # the median or below 1/that of it), start from their median and grow it
    # at the terminal rate; stable histories behave exactly as in v3.
    # Needs at least `normalisation_min_years` years of complete inputs.
    base_earnings_method: str = "latest_year"
    normalisation_window_years: int = 5
    normalisation_min_years: int = 3
    normalisation_dispersion: Decimal = Decimal(2)
    # v5: how owner earnings are built for upstream oil and gas (an Energy
    # holding that reports decommissioning payments). "net_income" is the
    # classic net income + D&A - capex basis; "cash" uses operating cash flow -
    # capex - decommissioning/lease/financing-interest payments, because
    # Norwegian petroleum tax makes most of the tax expense deferred.
    upstream_owner_earnings_basis: str = "net_income"
