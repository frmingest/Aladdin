"""End-to-end tests for POST /portfolio/import-csv (app/api/portfolio.py)."""
from __future__ import annotations

HEADER = "Handel\tValuta\tAntall\tGAV\t% i dag\tsiste kurs\tBelåningsverdi\tVerdi NOK\tAvkast.\tAvkast. NOK"


def _utf16(text: str) -> bytes:
    return text.encode("utf-16")


def _account_74_bytes() -> bytes:
    rows = [
        HEADER,
        "L&G Gold Mining ETF\tEUR\t144\t109,9347\t-0,640031\t102,46\t79493,04\t158986,08\t-11,94\t-21550,24",
        "Xtrackers Europe Defence Technologies UCITS ETF 1C\tEUR\t317\t32,542\t0,591416\t29,765\t76255,06\t101673,42\t-13,98\t-16524,51",
    ]
    return _utf16("\n".join(rows))


def test_import_csv_creates_account_document_and_snapshot(client):
    response = client.post(
        "/portfolio/import-csv",
        files={
            "file": (
                "Beholdningstabell_eksport_kontono._73898074_15.9.2026.csv",
                _account_74_bytes(),
                "text/csv",
            )
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["account"]["account_number"] == "73898074"
    assert body["document"]["type"] == "portfolio_export"
    assert body["document"]["original_filename"].endswith(".csv")
    assert body["snapshot"]["reporting_currency"] == "NOK"
    assert len(body["snapshot"]["positions"]) == 2
    assert body["holdings_created"] == 2
    assert body["holdings_matched"] == 0
    assert body["was_duplicate_file"] is False

    # Both imported holdings are tagged as equity ETFs, not plain "equity"
    # guesswork — confirms the instrument-type tagging round-trips through
    # the API (schemas/holding.py's asset_class_raw).
    holdings_response = client.get("/holdings")
    assert holdings_response.status_code == 200
    tags = {h["ticker"]: h["asset_class_raw"] for h in holdings_response.json()}
    assert tags["L-G-GOLD-MINING-ETF"] == "equity_etf"


def test_import_csv_accepts_explicit_account_number_override(client):
    response = client.post(
        "/portfolio/import-csv",
        data={"account_number": "OVERRIDE-1", "account_name": "Test ASK"},
        files={"file": ("no-account-in-name.csv", _account_74_bytes(), "text/csv")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["account"]["account_number"] == "OVERRIDE-1"
    assert body["account"]["name"] == "Test ASK"


def test_import_csv_without_account_number_or_filename_hint_is_422(client):
    response = client.post(
        "/portfolio/import-csv",
        files={"file": ("no-account-here.csv", _account_74_bytes(), "text/csv")},
    )
    assert response.status_code == 422, response.text


def test_import_csv_rejects_non_csv_file(client):
    response = client.post(
        "/portfolio/import-csv",
        data={"account_number": "123"},
        files={"file": ("export.xlsx", b"not a csv", "application/octet-stream")},
    )
    assert response.status_code == 415, response.text


def test_import_csv_rejects_malformed_csv(client):
    bad_content = "Foo\tBar\n1\t2".encode("utf-16")
    response = client.post(
        "/portfolio/import-csv",
        data={"account_number": "123"},
        files={"file": ("bad.csv", bad_content, "text/csv")},
    )
    assert response.status_code == 422, response.text


def test_reimporting_same_file_creates_second_snapshot_not_second_document(client):
    content = _account_74_bytes()
    first = client.post(
        "/portfolio/import-csv",
        data={"account_number": "73898074"},
        files={"file": ("export.csv", content, "text/csv")},
    )
    second = client.post(
        "/portfolio/import-csv",
        data={"account_number": "73898074"},
        files={"file": ("export.csv", content, "text/csv")},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["document"]["id"] == second.json()["document"]["id"]
    assert second.json()["was_duplicate_file"] is True

    snapshots = client.get("/portfolio/snapshots").json()
    assert len(snapshots) == 2
