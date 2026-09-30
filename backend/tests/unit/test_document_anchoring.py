"""Page anchors added when an XHTML filing is served to the reader.

Uses the synthetic ESEF-style filing from the iXBRL extraction tests, so the
page numbers checked here are the same ones `financial_line_items.source_page`
holds for that file."""
from lxml import html as lxml_html

from app.services.documents.anchoring import ANCHOR_PREFIX, add_page_anchors
from app.services.documents.extraction.ixbrl import extract_ixbrl
from tests.unit.test_extraction_ixbrl import BALANCE, INCOME, _filing


def _page_text(doc, number: int) -> str:
    anchor = doc.get_element_by_id(f"{ANCHOR_PREFIX}{number}")
    return anchor.getparent().text_content()


def test_every_page_gets_an_anchor_numbered_like_the_extractor_numbers_pages():
    content = _filing(INCOME, BALANCE)
    result = extract_ixbrl(content)
    facts = {(f.metric, f.period): f for f in result.facts}

    doc = lxml_html.fromstring(add_page_anchors(content))

    # page 1 cover, 2 income statement, 3 balance sheet
    assert doc.get_element_by_id(f"{ANCHOR_PREFIX}1") is not None
    assert doc.get_element_by_id(f"{ANCHOR_PREFIX}3") is not None
    assert not doc.xpath(f"//*[@id='{ANCHOR_PREFIX}4']")

    # The anchor a figure links to is the page that figure was tagged on.
    revenue_page = facts[("revenue", "FY2025")].source_page
    assets_page = facts[("total_assets", "FY2025")].source_page
    assert "Statement of income" in _page_text(doc, revenue_page)
    assert "Statement of financial position" in _page_text(doc, assets_page)


def test_the_anchor_is_the_first_thing_in_its_page_and_keeps_leading_text():
    content = _filing(INCOME, BALANCE).replace(b"<div><p>ACME annual", b"<div>lead-in <p>ACME annual", 1)
    doc = lxml_html.fromstring(add_page_anchors(content))
    page = doc.get_element_by_id(f"{ANCHOR_PREFIX}1").getparent()
    assert page[0].get("id") == f"{ANCHOR_PREFIX}1"
    assert page.text_content().startswith("lead-in")


def test_tags_and_content_survive_and_empty_elements_are_not_self_closed():
    content = _filing(INCOME, BALANCE, extra_pages="<div><p>Notes</p><div/><span/></div>\n")
    served = add_page_anchors(content)
    # HTML serialisation: `<div/>` would be read as an open div in text/html.
    assert b"<div/>" not in served and b"<span/>" not in served
    assert served.count(b"nonFraction") >= content.count(b"nonFraction")
    assert b"8 095.6" in served and b"Statement of financial position" in served
    assert b"aladdin-page-4" in served  # the extra "Notes" page


def test_a_highlight_rule_for_the_landing_page_is_added_to_the_head():
    served = add_page_anchors(_filing(INCOME, BALANCE))
    assert b":target" in served
    doc = lxml_html.fromstring(served)
    assert any(":target" in (s.text or "") for s in doc.xpath("//head/style"))


def test_a_file_without_detectable_pages_is_served_unchanged():
    plain = b"<html><body><p>just one paragraph</p></body></html>"
    assert add_page_anchors(plain) == plain


def test_unreadable_input_never_raises_and_comes_back_unchanged():
    junk = b"\x00\x01\x02 not a document"
    assert add_page_anchors(junk) == junk
    assert add_page_anchors(b"") == b""
