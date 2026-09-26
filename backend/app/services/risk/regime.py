"""Macro regime classification (Sprint 12), from whatever the current
macro catalogue actually stores (app/domain/macro_series.py `v1`):

  NO: policy rate, NOWA, 3m T-bill, 10y yield, USD/NOK, EUR/NOK, CPI y/y
  US: fed funds upper bound, 10y yield, 10y-2y curve, CPI y/y,
      unemployment, HY credit spread

That's both a home-market series (Norway CPI, via SSB) and a set of US
series — no Norges Bank yield-curve or credit-spread series exists in the
catalogue, so the curve/credit legs of this classification are
necessarily US-only; the output says so plainly rather than implying a
Norway-specific signal that isn't there.

Three categories (baseline / stagflation / crisis) is deliberately coarse:
the catalogue has policy rates, one curve, one credit spread and two CPI
series — enough to say "credit stress" or "high inflation + weak growth
expectations", not enough to support a finer regime taxonomy without
overfitting thin data.

Persistence/hysteresis: every input to the classification is a 3-month
ROLLING AVERAGE of `IndicatorSnapshot.history` (already-computed monthly
values, app/services/macro/indicators.py), not the single latest print.
This is stateless and reproducible — the same stored history always
classifies the same way — and it's what stops one noisy print (a one-off
CPI spike, a one-day credit-spread gap) from flipping the whole regime:
the average of the last 3 months has to cross the threshold, which by
construction needs the new level to actually persist across at least
part of that window, not just show up once. No new table/persisted state
is needed for this rule (CLAUDE.md: don't add one just to have one).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.orm import Session

from app.services.macro.indicators import (
    IndicatorSnapshot,
    MacroIndicators,
    get_macro_indicators,
)

REGIME_BASELINE = "baseline"
REGIME_STAGFLATION = "stagflation"
REGIME_CRISIS = "crisis"

# Thresholds, named and documented, not buried in the rule below.
CRISIS_HY_SPREAD_PP = Decimal("6.0")
"""US high-yield OAS smoothed above this (percentage points) is treated as
acute credit stress — a normal/benign spread is roughly 3-4pp; 2008/2020
peaks were well above 8pp, so 6pp sits between "elevated" and "crisis"."""
STAGFLATION_CPI_PCT = Decimal("4.0")
"""Smoothed 12-month CPI inflation above this, in either the US or Norway,
counts as "high" for the stagflation trigger."""
STAGFLATION_CURVE_PP = Decimal("0.0")
"""US 10y-2y at or below this (flat/inverted), smoothed, is the "weak
growth expectations" leg of the stagflation trigger."""

ROLLING_MONTHS = 3


@dataclass
class RegimeInput:
    key: str
    label: str
    region: str
    latest_value: Decimal | None
    smoothed_value: Decimal | None
    unit: str


@dataclass
class RegimeResult:
    regime: str
    home_market_series_included: bool
    curve_and_credit_are_us_only: bool
    explanation: str
    method_note: str
    inputs: list[RegimeInput] = field(default_factory=list)
    data_complete: bool = True
    missing: list[str] = field(default_factory=list)


def _smoothed(snap: IndicatorSnapshot) -> Decimal | None:
    """Mean of the last `ROLLING_MONTHS` monthly history points, falling
    back to the latest raw value if less history than that is stored yet
    (early on / after a fresh macro-data reset) — never crashes, just
    smooths over less."""
    tail = snap.history[-ROLLING_MONTHS:]
    if not tail:
        return snap.value
    return sum((p.value for p in tail), Decimal(0)) / len(tail)


def classify_regime(db: Session, *, indicators: MacroIndicators | None = None) -> RegimeResult:
    indicators = indicators or get_macro_indicators(db)
    by_key = {s.key: s for s in indicators.indicators}

    needed = ("us_hy_spread", "us_10y_2y", "us_cpi_yoy", "no_cpi_yoy")
    missing = [k for k in needed if by_key.get(k) is None or by_key[k].value is None]

    inputs: list[RegimeInput] = []
    smoothed: dict[str, Decimal | None] = {}
    for key in needed:
        snap = by_key.get(key)
        if snap is None:
            continue
        s = _smoothed(snap) if snap.value is not None else None
        smoothed[key] = s
        inputs.append(
            RegimeInput(
                key=key, label=snap.label, region=snap.region, latest_value=snap.value,
                smoothed_value=s.quantize(Decimal("0.01")) if s is not None else None, unit=snap.display_unit,
            )
        )

    method_note = (
        f"Each input is a {ROLLING_MONTHS}-month rolling average of Aladdin's own stored monthly "
        "history, not the single latest print, so one noisy month can't flip the regime on its own."
    )

    if missing:
        return RegimeResult(
            regime=REGIME_BASELINE,
            home_market_series_included=False,
            curve_and_credit_are_us_only=True,
            explanation=(
                "Not enough macro data captured yet to classify a regime "
                f"(missing: {', '.join(missing)}); defaulting to baseline."
            ),
            method_note=method_note,
            inputs=inputs,
            data_complete=False,
            missing=missing,
        )

    hy_spread = smoothed["us_hy_spread"]
    curve = smoothed["us_10y_2y"]
    us_cpi = smoothed["us_cpi_yoy"]
    no_cpi = smoothed["no_cpi_yoy"]

    if hy_spread is not None and hy_spread >= CRISIS_HY_SPREAD_PP:
        regime = REGIME_CRISIS
        explanation = (
            f"US high-yield credit spread has averaged {hy_spread:.2f}pp over the last {ROLLING_MONTHS} "
            f"months, at/above the {CRISIS_HY_SPREAD_PP}pp crisis threshold — credit markets are pricing "
            "meaningful stress. Favor quality, low leverage and real financial-fortress balance sheets; "
            "discount rates used for valuation should reflect wider spreads, not just the risk-free rate."
        )
    elif (
        curve is not None
        and curve <= STAGFLATION_CURVE_PP
        and ((us_cpi is not None and us_cpi >= STAGFLATION_CPI_PCT) or (no_cpi is not None and no_cpi >= STAGFLATION_CPI_PCT))
    ):
        regime = REGIME_STAGFLATION
        explanation = (
            f"The US 10y-2y curve has averaged {curve:.2f}pp (flat/inverted, weak growth expectations) "
            f"while CPI inflation is running at or above {STAGFLATION_CPI_PCT}% "
            f"(US {us_cpi:.2f}% / Norway {no_cpi:.2f}%) — a stagflation-leaning mix of high inflation and "
            "weak growth. Pricing power and low fixed-cost leverage matter more than growth multiples here; "
            "a higher terminal discount rate is more defensible than the baseline assumption."
        )
    else:
        regime = REGIME_BASELINE
        explanation = (
            f"Credit spreads ({hy_spread:.2f}pp), the yield curve ({curve:.2f}pp) and CPI inflation "
            f"(US {us_cpi:.2f}% / Norway {no_cpi:.2f}%) show no crisis or stagflation signal on this "
            "reading — no change to standard valuation assumptions is indicated by macro conditions alone."
        )

    return RegimeResult(
        regime=regime,
        home_market_series_included=True,
        curve_and_credit_are_us_only=True,
        explanation=explanation,
        method_note=method_note,
        inputs=inputs,
    )
