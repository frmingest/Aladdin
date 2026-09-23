"""Statement-table CSV extraction. Fixtures are synthetic copies of the
layouts real IR downloads use (Vår Energi factsheet, Orkla quarterly and
accounting figures) — small invented numbers, not the real files."""
from decimal import Decimal

from app.services.documents.extraction.csv_statement import extract_csv

# Vår-style: semicolons, a junk first row, statements stacked under one
# header row, parentheses negatives, '#REF!' unit cells, quarter + YTD + FY.
FACTSHEET = """700;110;;80;80;;80
;;;;;;
;Consolidated statement of income;;;;;
;USD million;;Unit;Q1 2026;Q4 2025;YTD 2026;FY 2025;FY 2024
;Total income;;#REF!;2 667 ;2 235 ;2 667 ;8 096 ;7 450
;Depreciation and amortisation;;;(858);(802);(858);(2 710);(1 916)
;Operating profit/(loss) (EBIT);;;1 308 ;947 ;1 308 ;4 185 ;3 790
;Profit/(loss) for the period;;;374 ;25 ;374 ;846 ;327
;;;;;;
;Balance sheet statement;;;;;
;ASSETS;;;;;
;Total assets;;;26 914 ;26 145 ;26 914 ;26 145 ;21 868
;Total Equity;;;565 ;560 ;565 ;560 ;833
;Consolidated statement of cash flow;;;;;
; - Depreciation and amortisation;;;858 ;802 ;858 ;2 710 ;1 916
;#REF!;;;#REF!;#REF!;#REF!;#REF!;#REF!
;Net cash flow from operating activities;;;1 057 ;1 285 ;1 057 ;4 607 ;3 408
;Cash flows from investing activities;;;;;
;Expenditures on property, plant and equipment;;;(503);(627);(503);(2 457);(2 564)
""" + ";;;;;;\n" * 50

# Orkla-style: quoted multi-line period headers, a condensed income
# statement followed by segment tables that reuse "Operating revenues".
ACCOUNTING_FIGURES = '''Condensed Income Statement;;;;
Amounts in NOK million;"Q4
2025";"YTD Q4
2024";"YTD Q4
2025";
Operating revenues;18 775;69 254;71 547;
Depreciation;-724;-2 653;-2 732;
Operating profit    ;1 826;6 558;7 086;
Profit for the period ;2 091;6 399;12 057;
Profit attributable to owners of the parent;1 888;6 057;11 473;
;;;;
Operating revenues;;;;
Amounts in NOK million;"Q4
2025";"YTD Q4
2024";"YTD Q4
2025";
   Orkla Foods;5 633;20 594;20 864;
Orkla Group;18 775;69 254;71 547;
'''


def _facts(result):
    return {(f.metric, f.period): f for f in result.facts}


def test_factsheet_imports_only_annual_columns_scaled_to_units():
    result = extract_csv(FACTSHEET.encode("utf-8"), sheet_name="Factsheet")
    facts = _facts(result)

    assert facts[("revenue", "FY2025")].value == Decimal(8_096_000_000)
    assert facts[("revenue", "FY2025")].unit == "USD"
    assert facts[("revenue", "FY2024")].value == Decimal(7_450_000_000)
    assert facts[("operating_income", "FY2025")].value == Decimal(4_185_000_000)
    assert facts[("net_income", "FY2025")].value == Decimal(846_000_000)
    assert facts[("total_assets", "FY2025")].value == Decimal(26_145_000_000)
    assert facts[("total_equity", "FY2024")].value == Decimal(833_000_000)
    assert facts[("operating_cash_flow", "FY2025")].value == Decimal(4_607_000_000)
    # Printed as (2 457) / (2 710): stored as positive magnitudes.
    assert facts[("capital_expenditures", "FY2025")].value == Decimal(2_457_000_000)
    assert facts[("depreciation_and_amortization", "FY2025")].value == Decimal(2_710_000_000)
    # Quarter and YTD-2026 columns never become facts.
    assert all(f.period in {"FY2024", "FY2025"} for f in result.facts)
    assert "fact_conflicts" not in result.quality_flags
    assert all(f.confidence == 1.0 for f in result.facts)


def test_factsheet_keeps_every_statement_as_page_text_without_empty_rows():
    result = extract_csv(FACTSHEET.encode("utf-8"), sheet_name="Factsheet")
    titles = [p.text.split("\n")[0] for p in result.pages]
    assert "Consolidated statement of income" in titles
    assert "Balance sheet statement" in titles
    assert "Consolidated statement of cash flow" in titles
    # "Cash flows from investing activities" is a sub-heading, not a new page.
    assert "Cash flows from investing activities" not in titles
    income = next(p for p in result.pages if p.text.startswith("Consolidated statement of income"))
    assert "Q1 2026" in income.text and "2 667" in income.text
    assert all(";;" not in p.text for p in result.pages)


def test_accounting_figures_uses_statement_not_segment_table_and_parent_profit():
    result = extract_csv(ACCOUNTING_FIGURES.encode("utf-8"), sheet_name="Income statement")
    facts = _facts(result)

    assert facts[("revenue", "FY2025")].value == Decimal(71_547_000_000)
    assert facts[("revenue", "FY2025")].currency == "NOK"
    # "Profit attributable to owners of the parent" beats "Profit for the period".
    assert facts[("net_income", "FY2025")].value == Decimal(11_473_000_000)
    assert facts[("net_income", "FY2024")].value == Decimal(6_057_000_000)
    assert facts[("depreciation_and_amortization", "FY2025")].value == Decimal(2_732_000_000)
    assert facts[("operating_income", "FY2025")].value == Decimal(7_086_000_000)
    # "YTD Q4" = full year; the plain Q4 column is not imported.
    assert {f.period for f in result.facts} == {"FY2024", "FY2025"}


def test_windows_1252_encoded_csv_is_read():
    content = "Resultatregnskap;;\nNOK million;2024;2025\nSum driftsinntekter;1 000;1 200\nÅrsresultat;100;150\n"
    result = extract_csv(content.encode("cp1252"))
    facts = _facts(result)
    assert facts[("revenue", "FY2025")].value == Decimal(1_200_000_000)
    assert facts[("net_income", "FY2024")].value == Decimal(100_000_000)


def test_comma_delimited_csv_is_read():
    content = 'Income statement,,\nUSD thousand,FY2024,FY2025\nRevenue,"1,000","1,200"\n'
    facts = _facts(extract_csv(content.encode("utf-8")))
    assert facts[("revenue", "FY2025")].value == Decimal(1_200_000)


def test_same_priority_labels_with_different_values_are_a_conflict_not_a_guess():
    content = "Income statement;;\nNOK million;FY2024;FY2025\nRevenue;1 000;1 200\nNet sales;1 000;1 150\n"
    result = extract_csv(content.encode("utf-8"))
    facts = _facts(result)
    assert ("revenue", "FY2025") not in facts
    assert facts[("revenue", "FY2024")].value == Decimal(1_000_000_000)  # both agree
    assert "fact_conflicts" in result.quality_flags
    assert "FY2025 revenue" in result.details["fact_conflicts"][0]


def test_missing_scale_is_flagged_and_imported_as_printed():
    content = "Line item;FY2024;FY2025\nRevenue;1000;1200\n"
    result = extract_csv(content.encode("utf-8"))
    fact = _facts(result)[("revenue", "FY2025")]
    assert fact.value == Decimal(1200)
    assert fact.unit == "unit"
    assert fact.confidence < 1.0
    assert "scale_not_stated" in result.quality_flags


def test_data_row_with_year_like_values_is_not_a_header():
    content = "NOK million;FY2024;FY2025\nRevenue;2021;2024\nNet income;10;12\n"
    facts = _facts(extract_csv(content.encode("utf-8")))
    assert facts[("revenue", "FY2025")].value == Decimal(2_024_000_000)
    assert facts[("net_income", "FY2025")].value == Decimal(12_000_000)


def test_estimate_columns_are_never_imported():
    content = "NOK million;2025;2026E;2027E\nRevenue;100;120;140\n"
    result = extract_csv(content.encode("utf-8"))
    assert {f.period for f in result.facts} == {"FY2025"}
