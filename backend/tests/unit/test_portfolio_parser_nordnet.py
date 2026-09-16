"""
Tests against a real Nordnet Beholdningstabell export (tests/fixtures/) —
this is Faiz's actual data source, not a hypothetical format, so it gets its
own fixture rather than only a synthetic one (see
docs/decisions/0003-nordnet-export-support.md).
"""

from decimal import Decimal
from pathlib import Path

from app.domain.asset_class import AssetClass
from app.services.portfolio.parser import parse_and_validate

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "nordnet_beholdningstabell.csv"


def _nordnet_csv(*rows: str) -> bytes:
    """A minimal synthetic Nordnet Beholdningstabell export — same shape
    (tab-delimited, UTF-16, Norwegian headers) as the real FIXTURE above,
    but built fresh per test rather than mutating the shared fixture (which
    other tests here assert an exact 3-position/name set against)."""
    header = "Handel\tValuta\tAntall\tGAV\tVerdi NOK"
    return ("\n".join([header, *rows]) + "\n").encode("utf-16")


def test_real_nordnet_export_parses_without_row_errors():
    result = parse_and_validate(filename="nordnet.csv", content=FIXTURE.read_bytes())

    assert result.is_valid, result.row_errors
    assert len(result.positions) == 3
    assert any("nordnet" in w.lower() for w in result.warnings)


def test_nordnet_instrument_names_become_the_holding_key():
    result = parse_and_validate(filename="nordnet.csv", content=FIXTURE.read_bytes())

    names = {p.name for p in result.positions}
    assert names == {"L&G Gold Mining ETF", "Salmon Evolution", "Vår Energi"}
    tickers = {p.ticker for p in result.positions}
    assert tickers == names  # no exchange ticker in this export — name is the key


def test_nordnet_asset_class_infers_etf_from_name():
    result = parse_and_validate(filename="nordnet.csv", content=FIXTURE.read_bytes())

    by_name = {p.name: p for p in result.positions}
    assert by_name["L&G Gold Mining ETF"].asset_class_raw == "ETF"
    assert by_name["Vår Energi"].asset_class_raw == "Aksje"


def test_nordnet_kontanter_row_classified_as_cash_not_aksje():
    """A "Kontanter" row is the account's cash balance, not a security — it
    used to fall through to the "everything else defaults to Aksje" case
    (see the real portfolio's dashboard silently excluding cash from every
    total, root-caused to this), which was wrong both for display (cash
    reads as an unclassified equity holding) and for
    app.services.market_data.valuation, which only knows to value a
    ticker-less CASH holding at par, not a ticker-less EQUITY one."""
    csv_bytes = _nordnet_csv("Kontanter\tNOK\t51071\t1\t51071")
    result = parse_and_validate(filename="beholdning.csv", content=csv_bytes)

    assert result.is_valid, result.row_errors
    assert len(result.positions) == 1
    position = result.positions[0]
    assert position.name == "Kontanter"
    assert position.ticker == "Kontanter"  # no ticker column — name is the key, same as any Nordnet row
    assert position.asset_class_raw == "Kontanter"
    assert position.asset_class == AssetClass.CASH
    assert position.market_ticker is None
    assert position.currency == "NOK"
    assert position.quantity == Decimal("51071")


def test_nordnet_weights_are_derived_from_verdi_nok_and_sum_to_100():
    result = parse_and_validate(filename="nordnet.csv", content=FIXTURE.read_bytes())

    assert not result.warnings or all("nordnet" in w.lower() for w in result.warnings)
    total = sum(p.weight_pct for p in result.positions)
    assert abs(total - Decimal("100")) < Decimal("0.1")

    by_name = {p.name: p for p in result.positions}
    # Vår Energi has the largest Verdi NOK (77342.72) of the three rows.
    assert by_name["Vår Energi"].weight_pct > by_name["Salmon Evolution"].weight_pct


def test_nordnet_gav_becomes_cost_basis_with_comma_decimal_parsed():
    result = parse_and_validate(filename="nordnet.csv", content=FIXTURE.read_bytes())

    by_name = {p.name: p for p in result.positions}
    assert by_name["Vår Energi"].cost_basis == Decimal("35.5")
    assert by_name["Vår Energi"].quantity == Decimal("1456")
    assert by_name["Vår Energi"].currency == "NOK"
    assert by_name["L&G Gold Mining ETF"].currency == "EUR"
