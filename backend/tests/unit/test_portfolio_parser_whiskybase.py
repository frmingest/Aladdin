"""
Tests against a real Whiskybase "my collection" export (tests/fixtures/) —
Faiz's actual whisky-collection data source, per ADR 0011's explicit
precondition that the importer be built from a real sample rather than a
guessed format (same precedent as the Nordnet importer, decision 0003).
"""

from decimal import Decimal
from pathlib import Path

from app.domain.asset_class import AssetClass
from app.services.portfolio.parser import parse_and_validate

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "whiskybase_collection.csv"


def test_real_whiskybase_export_parses_without_row_errors():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    assert result.is_valid, result.row_errors
    assert len(result.positions) == 26
    assert any("whiskybase" in w.lower() for w in result.warnings)


def test_every_bottle_is_collectible_with_quantity_one_and_no_market_ticker():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    for position in result.positions:
        assert position.asset_class == AssetClass.COLLECTIBLE
        assert position.quantity == Decimal("1")
        assert position.market_ticker is None


def test_whiskybase_id_becomes_a_stable_unique_ticker():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    tickers = [p.ticker for p in result.positions]
    assert len(tickers) == len(set(tickers))  # every id is unique, per Whiskybase's own catalog
    assert "WB-195396" in tickers  # Port Dundas 2000 DL


def test_brand_and_name_combine_with_bottling_series_into_a_readable_name():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    by_ticker = {p.ticker: p for p in result.positions}
    assert by_ticker["WB-195396"].name == "Port Dundas 2000 DL — Old Particular"


def test_price_paid_becomes_cost_basis_when_present():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    by_ticker = {p.ticker: p for p in result.positions}
    # Glenfarclas 15-year-old (id 234852): Price Paid 86.05, Currency EUR.
    glenfarclas = by_ticker["WB-234852"]
    assert glenfarclas.cost_basis == Decimal("86.05")
    assert glenfarclas.currency == "EUR"


def test_missing_price_paid_leaves_cost_basis_unset_not_fabricated():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    by_ticker = {p.ticker: p for p in result.positions}
    # Port Dundas 2000 DL (id 195396): Price Paid blank, Currency EUR still present.
    port_dundas = by_ticker["WB-195396"]
    assert port_dundas.cost_basis is None
    assert port_dundas.currency == "EUR"


def test_missing_price_and_currency_falls_back_to_average_shop_price_currency():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    by_ticker = {p.ticker: p for p in result.positions}
    # Woodford Reserve Batch Proof (id 127260): Price Paid AND Currency both
    # blank, but Currency Whisky (Average Shop Price's own currency) is USD.
    woodford = by_ticker["WB-127260"]
    assert woodford.cost_basis is None
    assert woodford.currency == "USD"


def test_distilleries_column_becomes_sector():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    by_ticker = {p.ticker: p for p in result.positions}
    assert by_ticker["WB-195396"].sector == "Port Dundas"


def test_added_on_date_becomes_acquired_at():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    by_ticker = {p.ticker: p for p in result.positions}
    # "Added on" = "2023-04-30 20:35:43" -> date-only acquired_at.
    assert by_ticker["WB-195396"].acquired_at.date().isoformat() == "2023-04-30"


def test_notes_carry_cask_age_strength_vintage_and_reference_price():
    result = parse_and_validate(filename="Collection.csv", content=FIXTURE.read_bytes())

    by_ticker = {p.ticker: p for p in result.positions}
    notes = by_ticker["WB-195396"].notes
    assert "cask: Refill Barrel" in notes
    assert "strength: 51.50 %vol" in notes
    assert "vintage: 10.2000" in notes
    assert "Whiskybase community avg price: 79.9 EUR (reference only, not cost)" in notes


def test_duplicate_whiskybase_id_in_same_upload_is_rejected():
    csv_bytes = (
        b'ID,CollectionID,Brand,Name,"Bottling serie","Bottle Status","Stated Age",Size,'
        b'Strength,"Strength Unit","Cask Type",List,Rating,"My Rating","Price Paid",Currency,'
        b'"Average Shop Price","Currency Whisky",Distilleries,Vintage,"Added on",Photo\n'
        b'1,1,Brand,Name,,closed,,700,40,%vol,,,80,,50,EUR,60,EUR,Distillery,,"2024-01-01 00:00:00",\n'
        b'1,1,Brand,Name,,closed,,700,40,%vol,,,80,,50,EUR,60,EUR,Distillery,,"2024-01-01 00:00:00",\n'
    )
    result = parse_and_validate(filename="dup.csv", content=csv_bytes)

    assert not result.is_valid
    assert any("duplicate ticker" in e["message"] for e in result.row_errors)
