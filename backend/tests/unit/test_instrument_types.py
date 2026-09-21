from app.domain.instrument_types import (
    BOND_FUND,
    COMMODITY_ETC,
    EQUITY_ETF,
    MONEY_MARKET_FUND,
    STOCK,
    classify_instrument,
)


def test_classifies_bond_fund():
    assert classify_instrument("Alfred Berg Nordic High Yield II R (NOK)") == BOND_FUND


def test_classifies_money_market_fund():
    assert classify_instrument("Heimdal Høyrente Plus B (NOK)") == MONEY_MARKET_FUND


def test_classifies_equity_etf():
    assert classify_instrument("L&G Gold Mining ETF") == EQUITY_ETF
    assert classify_instrument("Xtrackers Europe Defence Technologies UCITS ETF 1C") == EQUITY_ETF


def test_classifies_commodity_etc():
    assert classify_instrument("Xetra-Gold") == COMMODITY_ETC


def test_classifies_plain_company_name_as_stock():
    assert classify_instrument("Salmon Evolution") == STOCK
    assert classify_instrument("Vår Energi") == STOCK
