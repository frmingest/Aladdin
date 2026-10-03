"""Sprint 8: deterministic parsing of provider holdings files."""
from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

import openpyxl
import pytest

from app.services.funds.holdings_import import (
    HoldingsFileError,
    parse_holdings_file,
    parse_weight,
)

D = Decimal

LG_CSV = (
    b"L&G Gold Mining UCITS ETF\n"
    b"Holdings as of 31/08/2026\n"
    b"\n"
    b"Security Name;Ticker;ISIN;Country;Currency;Weight (%)\n"
    b"Newmont;NEM;US6516391066;United States;USD;15,5\n"
    b"Agnico-Eagle Mines;AEM;CA0084741085;Canada;CAD;11,0\n"
    b"AngloGold Ashanti;AU;GB00BRXH2664;South Africa;ZAR;10,2\n"
    b"Total;;;;;36,7\n"
    b"\n\n\n"
    b"Source: L&G. Past performance is not a guide.\n"
)


def test_csv_with_title_rows_decimal_comma_and_total_row():
    parsed = parse_holdings_file("lg.csv", LG_CSV)
    assert [r.name for r in parsed.rows] == ["Newmont", "Agnico-Eagle Mines", "AngloGold Ashanti"]
    assert parsed.rows[0].weight_pct == D("15.5")
    assert parsed.rows[0].isin == "US6516391066"
    assert parsed.as_of_date == date(2026, 8, 31)
    assert parsed.header_row == 4
    assert parsed.weight_sum_pct == D("36.7")
    assert not parsed.weights_were_fractions


def test_derived_exposures_are_summed_per_label():
    csv = (
        b"Name,Weight,Country\nA,10,Canada\nB,5,Canada\nC,20,Australia\n"
    )
    parsed = parse_holdings_file("h.csv", csv)
    assert parsed.derived_exposures("country") == [("Australia", D("20")), ("Canada", D("15"))]
    assert parsed.derived_exposures("sector") == []


def test_fraction_weights_in_xlsx_are_scaled_to_percent():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Fund holdings"])
    ws.append(["As of", date(2026, 6, 30)])
    ws.append(["Holding", "% of net assets"])
    ws.append(["Equinor ASA", 0.049])
    ws.append(["DNB Bank ASA", 0.05])
    buf = io.BytesIO()
    wb.save(buf)
    parsed = parse_holdings_file("h.xlsx", buf.getvalue())
    assert parsed.weights_were_fractions
    assert [r.weight_pct for r in parsed.rows] == [D("5.0000"), D("4.9000")]
    assert parsed.as_of_date == date(2026, 6, 30)


def test_negative_weights_are_skipped_and_reported():
    parsed = parse_holdings_file("h.csv", b"Name;Weight\nA;60\nFX forward;-0,5\nB;40\n")
    assert [r.name for r in parsed.rows] == ["A", "B"]
    assert parsed.warnings and "FX forward" in parsed.warnings[0]


def test_file_without_a_holdings_table_is_refused():
    with pytest.raises(HoldingsFileError, match="no holdings table"):
        parse_holdings_file("x.csv", b"Revenue;2025;2024\nSales;10;9\n")


def test_weights_above_100_percent_are_refused():
    with pytest.raises(HoldingsFileError, match="more than 100"):
        parse_holdings_file("x.csv", b"Name;Weight\nA;80\nB;70\n")


def test_other_extensions_are_refused():
    with pytest.raises(HoldingsFileError, match=".csv, .xlsx or .pdf"):
        parse_holdings_file("x.pptx", b"PK")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("4,85 %", D("4.85")), ("4.85", D("4.85")), (0.0485, D("0.0485")), ("1.234,5", D("1234.5")),
     ("", None), ("n/a", None), ("-", None)],
)
def test_parse_weight(raw, expected):
    assert parse_weight(raw) == expected


# ------------------------------------------------ PDF holdings (Sprint 19)


def _pdf_with_tables(pages):
    """Builds a text-layer PDF. `pages` is a list of (title lines, table rows);
    each table is drawn as a ruled grid so PyMuPDF's table finder sees it."""
    import pymupdf

    doc = pymupdf.open()
    for title_lines, rows in pages:
        page = doc.new_page()
        y = 60
        for line in title_lines:
            page.insert_text((50, y), line, fontsize=11)
            y += 18
        top = y + 20
        col_width, row_height = 130, 22
        ncols = len(rows[0])
        for r, row in enumerate(rows):
            for c, text in enumerate(row):
                rect = pymupdf.Rect(
                    50 + c * col_width, top + r * row_height,
                    50 + (c + 1) * col_width, top + (r + 1) * row_height,
                )
                page.draw_rect(rect, color=(0, 0, 0), width=0.8)
                page.insert_text((rect.x0 + 4, rect.y1 - 6), str(text), fontsize=9)
        assert ncols
    data = doc.tobytes()
    doc.close()
    return data


def test_pdf_table_with_title_date_and_decimal_commas():
    pdf = _pdf_with_tables(
        [
            (
                ["Fund annual report", "Portfolio as of 31.12.2025"],
                [
                    ["Security", "Country", "% of net assets"],
                    ["Equinor ASA", "Norway", "4,85"],
                    ["DNB Bank ASA", "Norway", "3,10"],
                    ["Total", "", "7,95"],
                ],
            )
        ]
    )
    parsed = parse_holdings_file("annual-report.pdf", pdf)
    assert [r.name for r in parsed.rows] == ["Equinor ASA", "DNB Bank ASA"]
    assert parsed.rows[0].weight_pct == D("4.85")
    assert parsed.rows[0].country == "Norway"
    assert parsed.as_of_date == date(2025, 12, 31)
    assert parsed.sheet.startswith("page 1")


def test_pdf_table_continuing_on_the_next_page_without_a_header_is_joined():
    pdf = _pdf_with_tables(
        [
            (
                ["Schedule of investments 30.06.2026"],
                [["Holding", "Sector", "Weight %"], ["Aker BP", "Energy", "5,0"], ["Orkla", "Staples", "4,0"]],
            ),
            ([], [["Mowi", "Staples", "3,0"], ["Telenor", "Telecom", "2,0"]]),
        ]
    )
    parsed = parse_holdings_file("fund.pdf", pdf)
    assert [r.name for r in parsed.rows] == ["Aker BP", "Orkla", "Mowi", "Telenor"]
    assert parsed.weight_sum_pct == D("14")


def test_pdf_without_a_text_layer_is_refused_with_the_reason():
    import pymupdf

    doc = pymupdf.open()
    doc.new_page()
    data = doc.tobytes()
    doc.close()
    with pytest.raises(HoldingsFileError, match="no text layer"):
        parse_holdings_file("scan.pdf", data)


def test_pdf_with_text_but_no_holdings_table_is_refused():
    pdf = _pdf_with_tables([(["Just a letter to unit holders"], [["a", "b"], ["c", "d"]])])
    with pytest.raises(HoldingsFileError, match="no holdings table found"):
        parse_holdings_file("letter.pdf", pdf)


def test_unsupported_extension_message_mentions_pdf():
    with pytest.raises(HoldingsFileError, match=r"\.csv, \.xlsx or \.pdf"):
        parse_holdings_file("holdings.docx", b"x")
