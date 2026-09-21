import pytest

from app.services.portfolio_import.csv_parser import (
    CsvParseError,
    extract_account_number_from_filename,
    parse_broker_csv,
)

HEADER = "Handel\tValuta\tAntall\tGAV\t% i dag\tsiste kurs\tBelåningsverdi\tVerdi NOK\tAvkast.\tAvkast. NOK"


def _utf16(text: str) -> bytes:
    # Matches the real exports: UTF-16LE with a BOM.
    return text.encode("utf-16")


def test_parses_real_export_shape():
    rows = [
        HEADER,
        "Salmon Evolution\tNOK\t209\t3,9588\t-3,90625\t3,075\t77,121\t642,675\t-22,32\t-184,705",
        "Vår Energi\tNOK\t3915\t37,3367\t-1,3153087\t54,02\t126892,98\t211488,3\t44,68\t65315,18",
    ]
    content = _utf16("\n".join(rows))
    positions = parse_broker_csv(content, "Beholdningstabell_eksport_kontono._24175564_15.9.2026.csv")

    assert len(positions) == 2
    assert positions[0].name == "Salmon Evolution"
    assert positions[0].currency == "NOK"
    assert positions[0].quantity == 209
    assert positions[1].name == "Vår Energi"
    assert float(positions[1].avg_cost) == pytest.approx(37.3367)


def test_account_number_extracted_from_filename_with_underscores():
    assert (
        extract_account_number_from_filename(
            "Beholdningstabell_eksport_kontono._73898074_15.9.2026.csv"
        )
        == "73898074"
    )


def test_account_number_extracted_from_filename_with_spaces():
    assert (
        extract_account_number_from_filename("Beholdningstabell eksport kontono. 73898074 15.9.2026.csv")
        == "73898074"
    )


def test_account_number_none_when_absent():
    assert extract_account_number_from_filename("random_export.csv") is None


def test_rejects_file_missing_required_columns():
    content = _utf16("Foo\tBar\n1\t2")
    with pytest.raises(CsvParseError):
        parse_broker_csv(content, "bad.csv")


def test_rejects_empty_file():
    content = _utf16("")
    with pytest.raises(CsvParseError):
        parse_broker_csv(content, "empty.csv")


def test_rejects_header_only_file():
    content = _utf16(HEADER)
    with pytest.raises(CsvParseError):
        parse_broker_csv(content, "header-only.csv")


def test_wrong_encoding_with_bom_raises_parse_error_not_crash():
    # A plain UTF-8 CSV (like the whisky Collection_2.csv, explicitly out
    # of scope) has no UTF-16 BOM, so it's decoded as utf-8-sig and then
    # correctly rejected for missing the expected broker-export columns —
    # never silently misparsed.
    content = "ID,Brand,Name\n1,Foo,Bar".encode("utf-8-sig")
    with pytest.raises(CsvParseError):
        parse_broker_csv(content, "Collection_2.csv")
