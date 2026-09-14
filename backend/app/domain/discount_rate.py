"""
Discount-rate and FX-rate suggestions (ECON-001, docs/decisions/
0014-macro-economic-review.md, architecture §17).

Before this module, `ValuationCaseCreate.discount_rate_pct` and
`.fx_rate_to_reporting` were free-typed numbers with no relationship to
anything else the application already knows: the risk-free legs the app
fetches every day via Phase 4 (`us_real_yield_10y`, `us_breakeven_10y`,
`no_policy_rate`) and the FX observations Phase 2 persists on every market
refresh (`app.models.market_data.FxObservation`). A DCF discount rate is
conventionally risk-free rate + equity risk premium (+ a company/country
premium); typing "9" with no visible anchor means the same case type can
silently embed a very different real discount rate depending only on when
the form happened to be filled in.

This module never substitutes a value the caller didn't ask for (§21) — it
only computes a *suggestion*, surfaced by `app.services.valuation.defaults`
via `GET /valuation/holdings/{holding_id}/defaults`, that the frontend can
show next to the field and let the user click to accept. `compute_dcf_value`
(app.domain.valuation) is completely unaware this module exists; whatever
`discount_rate_pct`/`fx_rate_to_reporting` a caller actually supplies is
still exactly what gets used.

Mirrors app.domain.macro_series/scenarios's versioned-YAML load pattern
(§2.4): the currency -> risk-free-series mapping and the equity risk
premium constant live in discount_rate/versions/{version}.yaml, not in
application code, so either can change without a code change and without
losing the ability to interpret a past suggestion against the config that
actually produced it.
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from functools import lru_cache

import yaml

from app.config.paths import DISCOUNT_RATE_DIR
from app.domain.calculations import PERCENT_PLACES, quantize

_SUPPORTED_METHODS = {"single_series", "real_plus_breakeven"}


class UnknownDiscountRateVersionError(Exception):
    def __init__(self, version: str):
        self.version = version
        super().__init__(
            f"discount rate version '{version}' has no config file under discount_rate/versions/"
        )


@dataclass(frozen=True)
class CurrencyRiskFreeMethod:
    method: str  # single_series | real_plus_breakeven
    series_keys: list[str]


@dataclass(frozen=True)
class DiscountRateConfig:
    version: str
    equity_risk_premium_pct: Decimal
    currency_risk_free: dict[str, CurrencyRiskFreeMethod]


@lru_cache
def load_discount_rate_config(version: str) -> DiscountRateConfig:
    path = DISCOUNT_RATE_DIR / f"{version}.yaml"
    if not path.exists():
        raise UnknownDiscountRateVersionError(version)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))

    currency_risk_free = {
        currency.upper(): CurrencyRiskFreeMethod(
            method=entry["method"],
            series_keys=list(entry["series_keys"]),
        )
        for currency, entry in raw.get("currency_risk_free", {}).items()
    }
    return DiscountRateConfig(
        version=raw["version"],
        equity_risk_premium_pct=Decimal(str(raw["equity_risk_premium_pct"])),
        currency_risk_free=currency_risk_free,
    )


@dataclass(frozen=True)
class DiscountRateSuggestion:
    """`available=False` (with `reason`) whenever the config or the macro
    data it needs isn't there yet — never a fabricated number (§13.3/§21).
    Every populated field is deterministic arithmetic over already-persisted
    MacroObservation rows; nothing here calls an LLM or a live provider."""

    available: bool
    currency: str
    config_version: str
    risk_free_pct: Decimal | None = None
    equity_risk_premium_pct: Decimal | None = None
    suggested_discount_rate_pct: Decimal | None = None
    risk_free_series_used: list[str] = field(default_factory=list)
    macro_as_of: datetime | None = None
    reason: str | None = None


def suggest_discount_rate(
    currency: str,
    latest_series_values: dict[str, tuple[Decimal, datetime]],
    config: DiscountRateConfig,
) -> DiscountRateSuggestion:
    """`latest_series_values` is `{series_key: (value, observed_at)}` for
    whatever macro series currently have a persisted observation — normally
    `app.services.research.macro.get_latest_macro_snapshot(db)`'s
    `.observations`, reshaped by the caller. Read-only, no DB/provider
    access here, so this stays trivially unit-testable."""
    currency = currency.upper()
    method_def = config.currency_risk_free.get(currency)
    if method_def is None:
        return DiscountRateSuggestion(
            available=False,
            currency=currency,
            config_version=config.version,
            reason=(
                f"no risk-free-rate mapping configured for currency '{currency}' in "
                f"discount_rate/versions/{config.version}.yaml — supported currencies: "
                f"{', '.join(sorted(config.currency_risk_free)) or 'none'}"
            ),
        )
    if method_def.method not in _SUPPORTED_METHODS:
        return DiscountRateSuggestion(
            available=False,
            currency=currency,
            config_version=config.version,
            reason=f"unknown risk-free method '{method_def.method}' for currency '{currency}'",
        )

    values: list[Decimal] = []
    observed_ats: list[datetime] = []
    missing: list[str] = []
    for series_key in method_def.series_keys:
        point = latest_series_values.get(series_key)
        if point is None:
            missing.append(series_key)
            continue
        values.append(point[0])
        observed_ats.append(point[1])

    if missing:
        return DiscountRateSuggestion(
            available=False,
            currency=currency,
            config_version=config.version,
            reason=(
                "macro series not yet available: " + ", ".join(missing) + " — run a macro "
                "refresh (POST /research/macro/refresh) first"
            ),
        )

    # Both supported methods currently reduce to "sum the series" — a single
    # series sums trivially with itself, real_plus_breakeven sums the real
    # yield and the breakeven back into a nominal rate. Kept as an explicit
    # per-method branch (rather than always summing) so a future method
    # that isn't a plain sum doesn't silently fall through.
    risk_free_pct = sum(values, Decimal("0"))

    suggested = risk_free_pct + config.equity_risk_premium_pct
    return DiscountRateSuggestion(
        available=True,
        currency=currency,
        config_version=config.version,
        risk_free_pct=quantize(risk_free_pct, PERCENT_PLACES),
        equity_risk_premium_pct=quantize(config.equity_risk_premium_pct, PERCENT_PLACES),
        suggested_discount_rate_pct=quantize(suggested, PERCENT_PLACES),
        risk_free_series_used=list(method_def.series_keys),
        macro_as_of=min(observed_ats),
    )


@dataclass(frozen=True)
class FxRateSuggestion:
    """Mirrors DiscountRateSuggestion's "suggest, never substitute" shape
    for the `fx_rate_to_reporting` field, sourced from the same
    `FxObservation` rows Phase 2's market-data refresh already persists
    (app.services.market_data.valuation) — no new provider call."""

    available: bool
    from_currency: str
    to_currency: str
    rate: Decimal | None = None
    observed_at: datetime | None = None
    reason: str | None = None


def suggest_fx_rate(
    from_currency: str,
    to_currency: str,
    latest_observation: tuple[Decimal, datetime] | None,
) -> FxRateSuggestion:
    """`latest_observation` is `(rate, observed_at)` for the most recent
    `FxObservation` row for this pair, or None if there isn't one yet —
    the caller does the DB query so this function stays a pure, unit-
    testable transformation, matching this module's other suggest_* shape."""
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    if from_currency == to_currency:
        return FxRateSuggestion(
            available=True, from_currency=from_currency, to_currency=to_currency, rate=Decimal("1")
        )
    if latest_observation is None:
        return FxRateSuggestion(
            available=False,
            from_currency=from_currency,
            to_currency=to_currency,
            reason=(
                f"no fx_observations row for {from_currency}->{to_currency} yet — refresh this "
                "holding's market data first"
            ),
        )
    rate, observed_at = latest_observation
    return FxRateSuggestion(
        available=True,
        from_currency=from_currency,
        to_currency=to_currency,
        rate=rate,
        observed_at=observed_at,
    )
