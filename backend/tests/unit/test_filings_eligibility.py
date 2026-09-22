from app.models import Holding
from app.services.filings.eligibility import names_match, newsweb_applies


def test_names_match_ignores_legal_suffixes_and_case():
    assert names_match("Equinor ASA", "EQUINOR ASA")
    assert names_match("Apple Inc.", "Apple Inc")
    assert names_match("Vår Energi ASA", "Var Energi")
    assert not names_match("Vår Energi ASA", "Varian Medical Systems Inc")


def test_newsweb_applies_to_oslo_and_nok_only():
    assert newsweb_applies(Holding(ticker="VAR.OL", name="x", trading_currency="NOK"))
    assert newsweb_applies(Holding(ticker="SALME", name="x", trading_currency="NOK"))
    assert not newsweb_applies(Holding(ticker="AAPL", name="x", trading_currency="USD"))
