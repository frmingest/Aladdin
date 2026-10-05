"""End-to-end: an uploaded ESEF filing -> stored facts -> /metrics (2026-10-05).

A bank is recognised from its own balance sheet even when no sector was set;
a debt line that bundles leases carries a plain note next to net debt; a
metric that could not be extracted lists the closest tagged lines."""
from __future__ import annotations

from tests.unit.test_extraction_ixbrl import INCOME, _filing
from tests.unit.test_extraction_ixbrl_debt import BANK, BUNDLED, _bs

CASH = _bs(("ifrs-full:CashAndCashEquivalents", "i25", "200.0"))


def _holding(client, ticker="ACME.OL", sector=None):
    body = {"ticker": ticker, "name": "ACME ASA", "trading_currency": "NOK"}
    if sector:
        body["sector"] = sector
    response = client.post("/holdings", json=body)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload(client, holding_id, content):
    response = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "annual_report"},
        files={"file": ("acme-2025.xhtml", content, "application/xhtml+xml")},
    )
    assert response.status_code == 201, response.text


def _metrics(client, holding_id):
    response = client.get(f"/holdings/{holding_id}/metrics", params={"period": "FY2025"})
    assert response.status_code == 200, response.text
    return response.json()


def test_bank_is_recognised_from_its_balance_sheet_without_a_sector(client):
    holding_id = _holding(client)  # no sector set
    _upload(client, holding_id, _filing(INCOME, BANK + CASH))

    body = _metrics(client, holding_id)

    for name in ("net_debt", "debt_to_equity", "roic", "owner_earnings"):
        assert name not in body["computed"]
        assert "not meaningful for a bank" in body["skipped"][name]


def test_an_industrial_company_keeps_its_debt_measures(client):
    holding_id = _holding(client)
    rows = _bs(("ifrs-full:LongtermBorrowings", "i25", "800.0")) + CASH
    _upload(client, holding_id, _filing(INCOME, rows))

    body = _metrics(client, holding_id)

    assert body["computed"]["net_debt"] == "600000000.000000"  # 800m debt - 200m cash
    assert "net_debt" not in body["skipped"]


def test_bundled_leases_are_noted_next_to_net_debt(client):
    holding_id = _holding(client)
    _upload(client, holding_id, _filing(INCOME, BUNDLED + CASH))

    body = _metrics(client, holding_id)

    assert body["computed"]["net_debt"] == "1480000000.000000"  # 1 680m - 200m cash
    assert "includes lease liabilities" in body["notes"]["net_debt"]


def test_a_missing_debt_figure_names_the_closest_tagged_lines(client):
    holding_id = _holding(client)
    rows = _bs(("ifrs-full:CurrentLeaseLiabilities", "i25", "35.0")) + CASH
    _upload(client, holding_id, _filing(INCOME, rows))

    body = _metrics(client, holding_id)

    assert "total_debt" not in body["facts"]
    assert any(
        "No total debt extracted" in w and "ifrs-full:CurrentLeaseLiabilities" in w for w in body["warnings"]
    )


def test_missing_inputs_are_listed_as_a_data_coverage_warning(client):
    holding_id = _holding(client)
    _upload(client, holding_id, _filing(INCOME, CASH))

    body = _metrics(client, holding_id)

    coverage = [w for w in body["warnings"] if w.startswith("Data coverage FY2025")]
    assert len(coverage) == 1
    assert "still missing:" in coverage[0] and "earnings per share" in coverage[0]
    assert "revenue" not in coverage[0].split("still missing:")[1]  # extracted, so not listed as missing
