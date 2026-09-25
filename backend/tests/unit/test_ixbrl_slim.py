"""Large ESEF uploads: embedded base64 images/fonts are stripped before the
file is stored and parsed (2026-09-25, Orkla 2025 report = 99 MB)."""
import base64
import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.domain.errors import FileTooLargeError
from app.models import Base, Holding
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.providers.object_storage import LocalObjectStorageProvider
from app.services.documents import ingestion as ingestion_module
from app.services.documents.extraction.ixbrl import extract_ixbrl
from app.services.documents.extraction.ixbrl_slim import (
    MIN_PAYLOAD_BYTES,
    strip_embedded_media,
)
from app.services.documents.hashing import sha256_hex
from app.services.documents.ingestion import ingest_holding_document
from tests.unit.test_extraction_ixbrl import BALANCE, HEAD, INCOME


def _b64(n: int, *, wrap: bool = False, entity_breaks: bool = False) -> str:
    payload = base64.b64encode(os.urandom(n)).decode()
    if wrap:
        payload = "\n".join(payload[i : i + 76] for i in range(0, len(payload), 76))
    if entity_breaks:
        payload = "&#10;".join(payload[i : i + 76] for i in range(0, len(payload), 76))
    return payload


def _filing_with_media(image_bytes: int = 200_000) -> bytes:
    head = HEAD.replace(
        "<style>.x{font-family:Foo}</style>",
        "<style>@font-face{font-family:Foo;src:url(data:font/woff2;base64,"
        + _b64(50_000, wrap=True)
        + ") format('woff2')}</style>",
    )
    body = (
        head
        + '<div><p>ACME annual report 2025</p><img src="data:image/png;base64,'
        + _b64(image_bytes)
        + '" alt="Our plant"/><p>Letter from the CEO: a good year.</p>'
        + '<img src="data:image/jpeg;charset=utf-8;base64,'
        + _b64(30_000, entity_breaks=True)
        + '"/><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="/></div>\n'
        + "<div><p>Statement of income</p><table>"
        + INCOME
        + "</table></div>\n<div><p>Statement of financial position</p><table>"
        + BALANCE
        + "</table></div>\n</div></body></html>"
    )
    return body.encode("utf-8")


def test_strips_large_payloads_and_keeps_markup_valid():
    original = _filing_with_media()
    slim = strip_embedded_media(original)

    assert slim.removed_count == 3  # font, png, jpeg — not the tiny gif
    assert len(slim.content) < len(original) / 10
    assert slim.original_bytes == len(original)
    assert b'src="data:image/png;base64,"' in slim.content
    assert b"url(data:font/woff2;base64,) format" in slim.content
    assert b"R0lGODlhAQABAAAAACw=" in slim.content  # under MIN_PAYLOAD_BYTES
    assert slim.as_flag()["stored_size_bytes"] == len(slim.content)
    # Still well-formed XML: the strict parser accepts it.
    from lxml import etree

    etree.fromstring(slim.content, etree.XMLParser(huge_tree=True, resolve_entities=False, recover=False))


def test_extracted_facts_and_text_are_identical_after_stripping():
    original = _filing_with_media()
    before = extract_ixbrl(original)
    after = extract_ixbrl(strip_embedded_media(original).content)

    assert [(f.metric, f.period, f.value, f.unit, f.source_page) for f in before.facts] == [
        (f.metric, f.period, f.value, f.unit, f.source_page) for f in after.facts
    ]
    assert [p.text for p in before.pages] == [p.text for p in after.pages]
    assert before.details == after.details


def test_file_without_media_is_returned_unchanged():
    content = b'<html><body><img src="data:image/png;base64,' + b"A" * (MIN_PAYLOAD_BYTES - 4) + b'"/></body></html>'
    slim = strip_embedded_media(content)
    assert slim.removed_count == 0
    assert slim.content is content


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture()
def storage(tmp_path):
    return LocalObjectStorageProvider(str(tmp_path))


@pytest.fixture()
def holding(db):
    h = Holding(ticker="ACME.OL", name="ACME ASA", trading_currency="NOK")
    db.add(h)
    db.commit()
    return h


def test_upload_stores_the_slim_file_but_hashes_the_original(db, storage, holding, tmp_path):
    original = _filing_with_media(image_bytes=600_000)
    intake = ingest_holding_document(
        db, storage, holding_id=holding.id, filename="acme-2025-12-31-0-no.xhtml", content=original,
        mime_type="application/xhtml+xml", document_type="annual_report",
    )
    doc = intake.document
    assert doc.status == "processed"
    assert doc.sha256 == sha256_hex(original)
    assert doc.size_bytes < len(original) / 10
    stored = (tmp_path / f"{doc.sha256}/acme-2025-12-31-0-no.xhtml").read_bytes()
    assert len(stored) == doc.size_bytes
    # The flag survives extraction rewriting quality_flags.
    flag = doc.quality_flags["embedded_media_removed"]
    assert flag["items"] == 3 and flag["original_size_bytes"] == len(original)
    assert doc.quality_flags["ixbrl"]["facts_mapped"] > 0
    assert db.query(FinancialLineItem).filter(FinancialLineItem.metric == "revenue").count() == 2

    # The same file again is a duplicate (hash of the file as uploaded).
    again = ingest_holding_document(
        db, storage, holding_id=holding.id, filename="acme-2025-12-31-0-no.xhtml", content=original,
        mime_type="application/xhtml+xml", document_type="annual_report",
    )
    assert again.was_duplicate and db.query(Document).count() == 1


def test_size_limit_applies_to_the_file_as_uploaded(db, storage, holding, monkeypatch):
    class Limits:
        max_upload_size_mb = 0
        max_ixbrl_upload_size_mb = 1

    monkeypatch.setattr(ingestion_module, "get_settings", lambda: Limits())
    with pytest.raises(FileTooLargeError) as exc:
        ingest_holding_document(
            db, storage, holding_id=holding.id, filename="big.xhtml", content=_filing_with_media(1_000_000),
            mime_type="application/xhtml+xml", document_type="annual_report",
        )
    assert "MB, over the 1 MB limit" in str(exc.value)


def test_default_ixbrl_limit_fits_a_100_mb_annual_report():
    from app.config.settings import Settings

    assert Settings.model_fields["max_ixbrl_upload_size_mb"].default * 1024 * 1024 > 98_633_766
