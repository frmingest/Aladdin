import io

import openpyxl
import pytest

from app.domain.errors import UnreadableFileError
from app.services.documents.hashing import (
    check_basic_readability,
    extension_of,
    sha256_hex,
)


def test_sha256_hex_is_deterministic():
    assert sha256_hex(b"hello") == sha256_hex(b"hello")
    assert sha256_hex(b"hello") != sha256_hex(b"world")


@pytest.mark.parametrize(
    ("filename", "expected"),
    [("report.PDF", ".pdf"), ("deck.pptx", ".pptx"), ("model.xlsx", ".xlsx"), ("noext", "")],
)
def test_extension_of(filename, expected):
    assert extension_of(filename) == expected


def test_check_basic_readability_accepts_real_xlsx():
    wb = openpyxl.Workbook()
    buf = io.BytesIO()
    wb.save(buf)
    check_basic_readability("model.xlsx", buf.getvalue())  # does not raise


def test_check_basic_readability_rejects_garbage_pretending_to_be_xlsx():
    with pytest.raises(UnreadableFileError):
        check_basic_readability("fake.xlsx", b"not actually a spreadsheet")


def test_check_basic_readability_rejects_garbage_pdf():
    with pytest.raises(UnreadableFileError):
        check_basic_readability("fake.pdf", b"not actually a pdf")
