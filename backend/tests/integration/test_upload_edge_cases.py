"""Upload edge cases (hardening sprint, 2026-10-13).

Every upload endpoint must answer a bad file with a 4xx and a readable
sentence, never a 500, a stored half-document, or text from outside the
upload folder. Uses the shared `client` fixture (in-memory DB, temp storage).
"""
from __future__ import annotations

import io

import openpyxl
import pytest

from app.config.settings import get_settings
from app.models import Holding

PDF_MAGIC = b"%PDF-1.4\n"


def _xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Line item", "FY2024"])
    ws.append(["Revenue", 1000])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _readable(response) -> str:
    detail = response.json()["detail"]
    assert isinstance(detail, str) and detail.strip(), response.text
    assert "Traceback" not in detail and "<html" not in detail.lower()
    return detail


@pytest.fixture()
def holding_id(client):
    from app.config.database import get_db
    from app.main import app

    db = next(app.dependency_overrides[get_db]())
    holding = Holding(ticker="EQNR.OL", name="Equinor ASA", trading_currency="NOK")
    db.add(holding)
    db.commit()
    hid = str(holding.id)
    db.close()
    return hid


def _upload(client, holding_id, name, content, mime="application/octet-stream", **data):
    return client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "annual_report", **data},
        files={"file": (name, content, mime)},
    )


# --- /documents/upload ------------------------------------------------------


@pytest.mark.parametrize("name", ["empty.pdf", "empty.xlsx", "empty.xhtml", "empty.csv"])
def test_empty_file_is_a_clear_4xx_for_every_supported_type(client, holding_id, name):
    response = _upload(client, holding_id, name, b"")
    assert 400 <= response.status_code < 500, response.text
    assert "empty" in _readable(response).lower()


def test_empty_upload_leaves_no_document_behind(client, holding_id):
    _upload(client, holding_id, "empty.pdf", b"")
    assert client.get("/documents").json() == []


def test_a_text_file_renamed_to_pdf_is_rejected_not_stored(client, holding_id):
    response = _upload(client, holding_id, "report.pdf", b"this is not a pdf at all")
    assert response.status_code == 422, response.text
    _readable(response)
    assert client.get("/documents").json() == []


def test_a_truncated_pdf_does_not_crash_the_server(client, holding_id):
    response = _upload(client, holding_id, "cut.pdf", PDF_MAGIC + b"1 0 obj << /Type /Catalog")
    assert response.status_code < 500, response.text


def test_a_corrupt_xlsx_is_rejected(client, holding_id):
    response = _upload(client, holding_id, "broken.xlsx", b"PK\x03\x04 not really a workbook")
    assert 400 <= response.status_code < 500, response.text
    _readable(response)


def test_upper_case_extension_is_accepted(client, holding_id):
    response = _upload(client, holding_id, "Q4.XLSX", _xlsx())
    assert response.status_code == 201, response.text


def test_no_extension_and_double_extension_are_unsupported_types(client, holding_id):
    for name in ("report", "report.pdf.exe", "archive.zip"):
        response = _upload(client, holding_id, name, b"data")
        assert response.status_code == 415, (name, response.text)
        _readable(response)


def test_path_style_filenames_cannot_escape_the_upload_folder(client, holding_id, tmp_path):
    for hostile in ("../../../escape.xlsx", "..\\..\\escape2.xlsx", "/etc/escape3.xlsx"):
        content = _xlsx() + hostile.encode()  # distinct bytes: one document each
        response = _upload(client, holding_id, hostile, content)
        assert response.status_code == 201, response.text
        stored = response.json()["document"]["original_filename"]
        assert "/" not in stored and "\\" not in stored and ".." not in stored
    # Nothing was written in or above the storage folder itself (every file sits one level down, in its hash folder).
    for folder in (tmp_path, tmp_path.parent, tmp_path.parents[1]):
        assert list(folder.glob("escape*")) == [], folder
    assert len(list(tmp_path.rglob("escape*.xlsx"))) == 3


def test_oversize_upload_is_413_with_the_limit_in_words(client, holding_id, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_upload_size_mb", 1)
    response = _upload(client, holding_id, "big.xlsx", b"x" * (1024 * 1024 + 1))
    assert response.status_code == 413, response.text
    assert "MB" in _readable(response) or "mb" in _readable(response).lower()


def test_the_same_report_twice_is_one_document(client, holding_id):
    content = _xlsx()
    first = _upload(client, holding_id, "q4.xlsx", content)
    second = _upload(client, holding_id, "q4-copy.xlsx", content)
    assert first.status_code == second.status_code == 201
    assert first.json()["was_duplicate_file"] is False
    assert second.json()["was_duplicate_file"] is True
    assert first.json()["document"]["id"] == second.json()["document"]["id"]
    assert len(client.get("/documents").json()) == 1


def test_unicode_and_very_long_filenames_are_handled(client, holding_id):
    for name in ("årsrapport 2025 – Équinor.xlsx", ("a" * 200) + ".xlsx"):
        response = _upload(client, holding_id, name, _xlsx() + b"\x00" * len(name))
        assert response.status_code < 500, (name[:30], response.text)


# --- /portfolio/import-csv --------------------------------------------------

HEADER = "Handel\tValuta\tAntall\tGAV\t% i dag\tsiste kurs\tBelåningsverdi\tVerdi NOK\tAvkast.\tAvkast. NOK"
ROW = "L&G Gold Mining ETF\tEUR\t144\t109,9347\t-0,640031\t102,46\t79493,04\t158986,08\t-11,94\t-21550,24"


def _csv(client, content, name="export.csv", account="123"):
    return client.post(
        "/portfolio/import-csv",
        data={"account_number": account},
        files={"file": (name, content, "text/csv")},
    )


def test_csv_empty_file_is_a_clear_422(client):
    response = _csv(client, b"")
    assert response.status_code == 422, response.text
    _readable(response)


def test_csv_header_only_imports_nothing_and_says_so(client):
    response = _csv(client, (HEADER + "\n").encode("utf-16"))
    assert response.status_code == 422, response.text
    _readable(response)


def test_csv_with_undecodable_bytes_is_422_not_500(client):
    response = _csv(client, b"\xff\xfe\x00\x00\xd8\x00\xd8\x00 garbage \x80\x81\x82")
    assert response.status_code == 422, response.text
    _readable(response)


@pytest.mark.parametrize("encoding", ["utf-16", "utf-8", "utf-8-sig", "cp1252"])
def test_csv_in_the_usual_encodings_is_read_or_refused_clearly(client, encoding):
    content = (HEADER + "\n" + ROW).encode(encoding)
    response = _csv(client, content)
    assert response.status_code in (201, 422), (encoding, response.text)
    if response.status_code == 422:
        _readable(response)


def test_csv_with_a_ragged_row_does_not_crash(client):
    content = (HEADER + "\n" + ROW + "\nbroken row\twith\tfew columns").encode("utf-16")
    response = _csv(client, content)
    assert response.status_code < 500, response.text


def test_csv_oversize_is_413(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_upload_size_mb", 1)
    response = _csv(client, b"x" * (1024 * 1024 + 1))
    assert response.status_code == 413, response.text
    _readable(response)


# --- /funds/{id}/holdings/import --------------------------------------------


def test_fund_holdings_import_rejects_empty_and_garbage(client):
    from app.config.database import get_db
    from app.main import app

    db = next(app.dependency_overrides[get_db]())
    fund = Holding(ticker="XDEF", name="Xtrackers Defence", trading_currency="EUR", asset_class_raw="equity_etf")
    db.add(fund)
    db.commit()
    holding_id = str(fund.id)
    db.close()
    for name, content in (("holdings.csv", b""), ("holdings.csv", b"\x00\x01\x02 binary"), ("holdings.xlsx", b"PK nope")):
        response = client.post(f"/funds/{holding_id}/holdings/import", files={"file": (name, content, "text/csv")})
        assert 400 <= response.status_code < 500, (name, response.status_code, response.text)


# --- the helpers behind it --------------------------------------------------


def test_safe_filename_keeps_ordinary_names_and_cleans_hostile_ones():
    from app.services.documents.hashing import MAX_FILENAME_CHARS, safe_filename

    for fine in ("Q4 2025.xlsx", "årsrapport – Équinor.pdf", "Beholdningstabell_eksport_kontono._73898074_15.9.2026.csv"):
        assert safe_filename(fine) == fine
    assert safe_filename("../../a.pdf") == "a.pdf"
    assert safe_filename("C:\\Users\\me\\a.pdf") == "a.pdf"
    assert safe_filename("a\x00b\n.pdf") == "ab.pdf"
    assert safe_filename("") == "upload" and safe_filename(None) == "upload" and safe_filename("..") == "upload"
    assert safe_filename("   ", default="upload.csv") == "upload.csv"
    long = safe_filename(("x" * 400) + ".pdf")
    assert len(long) == MAX_FILENAME_CHARS and long.endswith(".pdf")


def test_local_storage_refuses_keys_outside_its_folder(tmp_path):
    from app.providers.object_storage import (
        LocalObjectStorageProvider,
        ObjectStorageUnavailableError,
    )

    storage = LocalObjectStorageProvider(str(tmp_path / "store"))
    assert storage.retrieve(storage.store("abc/ok.pdf", b"1").split("store/", 1)[1]) == b"1"
    with pytest.raises(ObjectStorageUnavailableError):
        storage.store("abc/../../evil.pdf", b"x")
    with pytest.raises(ObjectStorageUnavailableError):
        storage.retrieve("../../etc/passwd")
    assert not (tmp_path / "evil.pdf").exists()
