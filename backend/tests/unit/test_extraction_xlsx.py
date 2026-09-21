import io

import openpyxl

from app.services.documents.extraction.xlsx import extract_xlsx


def _make_xlsx(rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_known_label_rows_become_structured_facts_per_period():
    content = _make_xlsx(
        [
            ["Line item", "FY2024", "FY2025"],
            ["Revenue", 1000, 1200],
            ["Net income", 100, 150],
            ["Some unrelated line", 999, 999],
        ]
    )
    result = extract_xlsx(content)

    facts_by_metric = {(f.metric, f.period): f.value for f in result.facts}
    assert facts_by_metric[("revenue", "FY2024")] == 1000
    assert facts_by_metric[("revenue", "FY2025")] == 1200
    assert facts_by_metric[("net_income", "FY2024")] == 100
    # The unrecognized label never becomes a fact — only preserved as page text.
    assert not any(f.metric == "some_unrelated_line" for f in result.facts)
    assert "Some unrelated line" in result.pages[0].text


def test_norwegian_labels_also_match():
    content = _make_xlsx([["Line item", "FY2024"], ["Driftsinntekter", 500]])
    result = extract_xlsx(content)
    assert result.facts[0].metric == "revenue"
    assert result.facts[0].value == 500


def test_empty_sheet_yields_no_facts_and_no_crash():
    content = _make_xlsx([])
    result = extract_xlsx(content)
    assert result.facts == []
    assert len(result.pages) == 1
