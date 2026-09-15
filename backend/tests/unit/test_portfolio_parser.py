from tests.support import make_portfolio_csv

from app.services.portfolio.parser import parse_and_validate


def test_valid_rows_parse_cleanly():
    csv_bytes = make_portfolio_csv(
        [
            "VAR.OL,Vår Energi,Aksje,1200,27.51,28.40,NOK,Energy,BlueNord merger thesis",
            "EQNR.OL,Equinor,Aksje,500,20.0,300,NOK,Energy,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert result.is_valid, result.row_errors
    assert len(result.positions) == 2
    first = result.positions[0]
    assert first.ticker == "VAR.OL"
    assert first.name == "Vår Energi"
    assert first.currency == "NOK"
    assert first.notes == "BlueNord merger thesis"


def test_missing_required_field_is_reported_with_row_number():
    csv_bytes = make_portfolio_csv(
        [
            ",Vår Energi,Aksje,1200,27.51,28.40,NOK,Energy,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert not result.is_valid
    assert result.row_errors[0]["row"] == 1
    assert "ticker" in result.row_errors[0]["message"]


def test_invalid_currency_code_is_rejected():
    csv_bytes = make_portfolio_csv(
        [
            "VAR.OL,Vår Energi,Aksje,1200,27.51,28.40,NORWAY,Energy,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert not result.is_valid
    assert any("currency" in e["message"] for e in result.row_errors)


def test_duplicate_ticker_in_same_upload_is_rejected():
    csv_bytes = make_portfolio_csv(
        [
            "VAR.OL,Vår Energi,Aksje,1200,50,28.40,NOK,Energy,",
            "VAR.OL,Vår Energi,Aksje,100,50,28.40,NOK,Energy,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert not result.is_valid
    assert any("duplicate ticker" in e["message"] for e in result.row_errors)


def test_row_needs_either_quantity_or_weight():
    csv_bytes = make_portfolio_csv(
        [
            "VAR.OL,Vår Energi,Aksje,,,28.40,NOK,Energy,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert not result.is_valid
    assert any("quantity or weight_pct" in e["message"] for e in result.row_errors)


def test_weight_only_row_is_accepted():
    csv_bytes = make_portfolio_csv(
        [
            "VAR.OL,Vår Energi,Aksje,,100,,NOK,Energy,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert result.is_valid, result.row_errors
    assert result.positions[0].quantity is None


def test_comma_decimal_separator_is_accepted():
    csv_bytes = make_portfolio_csv(
        [
            'VAR.OL,Vår Energi,Aksje,1200,"27,51","28,40",NOK,Energy,',
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert result.is_valid, result.row_errors
    assert str(result.positions[0].weight_pct) == "27.51"


def test_weight_sum_far_from_100_produces_a_warning_not_an_error():
    csv_bytes = make_portfolio_csv(
        [
            "VAR.OL,Vår Energi,Aksje,,40,,NOK,Energy,",
            "EQNR.OL,Equinor,Aksje,,40,,NOK,Energy,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert result.is_valid
    assert any("sum to" in w for w in result.warnings)


def test_unknown_asset_class_label_does_not_fail_the_row():
    csv_bytes = make_portfolio_csv(
        [
            "BTC,Bitcoin,Crypto,1,10,,NOK,Alt,",
        ]
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert result.is_valid, result.row_errors
    assert result.positions[0].asset_class_raw == "Crypto"


_HEADER_WITH_ACQUIRED_AT = (
    "Ticker,Name,Asset class,Quantity,Weight %,Cost basis,Currency,Sector/Theme,Notes,Acquired at"
)


def test_acquired_at_column_is_parsed_as_a_date():
    """Phase 8 (ADR 0011) — the minimal one-row canonical-CSV path for a
    physical coin bought on its own date."""
    csv_bytes = make_portfolio_csv(
        [
            "XAU-COIN-2026-09,1oz Gold Coin,Commodity,1,,2450.00,USD,,,2026-09-10",
        ],
        header=_HEADER_WITH_ACQUIRED_AT,
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert result.is_valid, result.row_errors
    position = result.positions[0]
    assert position.acquired_at is not None
    assert position.acquired_at.date().isoformat() == "2026-09-10"


def test_missing_acquired_at_is_none_not_an_error():
    csv_bytes = make_portfolio_csv(
        [
            "XAU-COIN-2026-09,1oz Gold Coin,Commodity,1,,2450.00,USD,,,",
        ],
        header=_HEADER_WITH_ACQUIRED_AT,
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert result.is_valid, result.row_errors
    assert result.positions[0].acquired_at is None


def test_invalid_acquired_at_is_rejected_with_a_row_error():
    csv_bytes = make_portfolio_csv(
        [
            "XAU-COIN-2026-09,1oz Gold Coin,Commodity,1,,2450.00,USD,,,not-a-date",
        ],
        header=_HEADER_WITH_ACQUIRED_AT,
    )
    result = parse_and_validate(filename="portfolio.csv", content=csv_bytes)

    assert not result.is_valid
    assert any("acquired_at" in e["message"] for e in result.row_errors)
