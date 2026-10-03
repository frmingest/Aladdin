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


def test_classifies_equity_fund_sprint8():
    from app.domain.instrument_types import (
        EQUITY_FUND,
        FUND_ANALYSIS_TYPES,
        is_fund_type,
    )

    assert classify_instrument("DNB Norden Indeks A") == EQUITY_FUND
    assert classify_instrument("Storebrand Global Fund") == EQUITY_FUND
    # A fund name with no marker stays a stock until re-tagged by hand,
    # unless it starts with a known Nordic fund manager (Sprint 19).
    assert classify_instrument("Heimdal Utbytte A") == EQUITY_FUND
    assert classify_instrument("Some Unmarked Name A") == "stock"
    assert is_fund_type("equity_etf") and is_fund_type("equity_fund")
    assert not is_fund_type("stock") and "bond_fund" not in FUND_ANALYSIS_TYPES


def test_nordic_fund_manager_products_without_a_marker_are_equity_funds_sprint19():
    from app.domain.instrument_types import EQUITY_FUND

    assert classify_instrument("Heimdal Utbytte N") == EQUITY_FUND
    assert classify_instrument("Skagen Vekst A") == EQUITY_FUND
    # the specific patterns still win
    assert classify_instrument("Heimdal Høyrente Pluss B") == MONEY_MARKET_FUND
    assert classify_instrument("Alfred Berg Nordic High Yield II R") == BOND_FUND
    # a listed company is not a fund because a manager shares a word with it
    assert classify_instrument("Storebrand") == STOCK
    assert classify_instrument("DNB Bank") == STOCK
