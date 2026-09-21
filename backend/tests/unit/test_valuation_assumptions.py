"""Unit tests for the versioned valuation-assumptions loader
(app/domain/valuation_assumptions/)."""
from decimal import Decimal

import pytest

from app.domain.valuation_assumptions import get_valuation_assumptions


def test_v1_has_erp_for_every_currency_in_the_portfolios_actual_mix():
    assumptions = get_valuation_assumptions("v1")
    for currency in ("USD", "EUR", "GBP", "NOK"):
        assert assumptions.equity_risk_premium[currency] == Decimal("0.045")


def test_v1_terminal_growth_is_below_every_mapped_currencys_typical_discount_rate():
    assumptions = get_valuation_assumptions("v1")
    # Sanity bound: terminal growth must stay well under a plausible
    # cost-of-equity floor (risk-free rate + beta*ERP), or Gordon growth's
    # denominator risks going non-positive for a low-beta holding.
    assert assumptions.terminal_growth_rate < Decimal("0.04")


def test_unknown_version_raises():
    with pytest.raises(ValueError, match="Unknown valuation assumptions version"):
        get_valuation_assumptions("v999-does-not-exist")
