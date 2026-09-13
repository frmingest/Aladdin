import pytest

from tests.support import make_pdf, make_pptx, make_xlsx

from app.domain.errors import UnreadableFileError
from app.services.documents.hashing import check_basic_readability, extension_of, sha256_hex


def test_sha256_is_deterministic_and_content_sensitive():
    a = sha256_hex(b"hello")
    b = sha256_hex(b"hello")
    c = sha256_hex(b"hello!")
    assert a == b
    assert a != c
    assert len(a) == 64


def test_extension_of_lowercases_and_handles_no_extension():
    assert extension_of("Report.PDF") == ".pdf"
    assert extension_of("noext") == ""


def test_valid_csv_is_readable():
    check_basic_readability("portfolio.csv", "Ticker,Name\nVAR.OL,Vår Energi\n".encode("utf-8"))


def test_invalid_utf8_csv_is_rejected():
    with pytest.raises(UnreadableFileError):
        check_basic_readability("portfolio.csv", b"\xff\xfe\x00bad")


def test_valid_xlsx_is_readable():
    content = make_xlsx({"Sheet1": [["A", "B"], [1, 2]]})
    check_basic_readability("report.xlsx", content)


def test_corrupt_xlsx_is_rejected():
    with pytest.raises(UnreadableFileError):
        check_basic_readability("report.xlsx", b"not a real xlsx file")


def test_valid_pdf_is_readable():
    content = make_pdf(["hello"])
    check_basic_readability("report.pdf", content)


def test_corrupt_pdf_is_rejected():
    with pytest.raises(UnreadableFileError):
        check_basic_readability("report.pdf", b"%PDF-not-real")


def test_valid_pptx_is_readable():
    content = make_pptx([("Slide 1", None)])
    check_basic_readability("deck.pptx", content)
