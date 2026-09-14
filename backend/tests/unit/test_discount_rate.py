"""
Unit tests for app.domain.discount_rate (ECON-001 fix, docs/decisions/
0014-macro-economic-review.md). Exercises the real discount_rate/versions/
v1.yaml shipped with the repo, plus the pure suggest_* functions with
synthetic macro/FX data — no DB/provider access anywhere in this module.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.domain.discount_rate import (
    CurrencyRiskFreeMethod,
    DiscountRateConfig,
    UnknownDiscountRateVersionError,
    load_discount_rate_config,
    suggest_discount_rate,
    suggest_fx_rate,
)

_NOW = datetime(2026, 9, 10, tzinfo=timezone.utc)


def test_v1_config_loads_nok_and_usd_mappings():
    load_discount_rate_config.cache_clear()
    config = load_discount_rate_config("v1")

    assert config.equity_risk_premium_pct == Decimal("5.0")
    assert config.currency_risk_free["NOK"].method == "single_series"
    assert config.currency_risk_free["NOK"].series_keys == ["no_policy_rate"]
    assert config.currency_risk_free["USD"].method == "real_plus_breakeven"
    assert config.currency_risk_free["USD"].series_keys == ["us_real_yield_10y", "us_breakeven_10y"]


def test_unknown_version_raises():
    load_discount_rate_config.cache_clear()
    with pytest.raises(UnknownDiscountRateVersionError):
        load_discount_rate_config("v999_does_not_exist")


def _config(**overrides) -> DiscountRateConfig:
    defaults = dict(
        version="test",
        equity_risk_premium_pct=Decimal("5"),
        currency_risk_free={
            "NOK": CurrencyRiskFreeMethod(method="single_series", series_keys=["no_policy_rate"]),
            "USD": CurrencyRiskFreeMethod(
                method="real_plus_breakeven", series_keys=["us_real_yield_10y", "us_breakeven_10y"]
            ),
        },
    )
    defaults.update(overrides)
    return DiscountRateConfig(**defaults)


def test_suggest_discount_rate_single_series_nok():
    latest = {"no_policy_rate": (Decimal("4.5"), _NOW)}
    result = suggest_discount_rate("NOK", latest, _config())

    assert result.available is True
    assert result.risk_free_pct == Decimal("4.5000")
    assert result.equity_risk_premium_pct == Decimal("5.0000")
    assert result.suggested_discount_rate_pct == Decimal("9.5000")
    assert result.risk_free_series_used == ["no_policy_rate"]
    assert result.macro_as_of == _NOW


def test_suggest_discount_rate_real_plus_breakeven_usd():
    latest = {
        "us_real_yield_10y": (Decimal("1.8"), _NOW),
        "us_breakeven_10y": (Decimal("2.3"), _NOW),
    }
    result = suggest_discount_rate("USD", latest, _config())

    assert result.available is True
    # 1.8 + 2.3 (nominal risk-free) + 5.0 (ERP) = 9.1
    assert result.risk_free_pct == Decimal("4.1000")
    assert result.suggested_discount_rate_pct == Decimal("9.1000")


def test_suggest_discount_rate_lowercase_currency_matches():
    latest = {"no_policy_rate": (Decimal("4.5"), _NOW)}
    result = suggest_discount_rate("nok", latest, _config())
    assert result.available is True
    assert result.currency == "NOK"


def test_suggest_discount_rate_unmapped_currency_unavailable():
    result = suggest_discount_rate("EUR", {}, _config())
    assert result.available is False
    assert "EUR" in result.reason
    assert "NOK" in result.reason and "USD" in result.reason


def test_suggest_discount_rate_missing_series_unavailable():
    result = suggest_discount_rate("USD", {"us_real_yield_10y": (Decimal("1.8"), _NOW)}, _config())
    assert result.available is False
    assert "us_breakeven_10y" in result.reason


def test_suggest_fx_rate_same_currency_is_trivially_one():
    result = suggest_fx_rate("NOK", "NOK", None)
    assert result.available is True
    assert result.rate == Decimal("1")


def test_suggest_fx_rate_uses_latest_observation():
    result = suggest_fx_rate("USD", "NOK", (Decimal("10.5"), _NOW))
    assert result.available is True
    assert result.rate == Decimal("10.5")
    assert result.observed_at == _NOW


def test_suggest_fx_rate_no_observation_unavailable():
    result = suggest_fx_rate("USD", "NOK", None)
    assert result.available is False
    assert "USD" in result.reason and "NOK" in result.reason
