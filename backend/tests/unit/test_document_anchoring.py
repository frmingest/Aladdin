"""Page anchors added when an XHTML filing is served to the reader.

Uses the synthetic ESEF-style filing from the iXBRL extraction tests, so the
page numbers checked here are the same ones `financial_line_items.source_page`
holds for that file."""
from decimal import Decimal

from lxml import html as lxml_html

from app.services.documents.anchoring import (
    ANCHOR_PREFIX,
    AnchorFact,
    add_page_anchors,
    fact_anchor_id,
)
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


# --- exact-number anchors ---------------------------------------------------


def _anchor_facts(result):
    return [AnchorFact(f.metric, f.period, f.value, f.source_page) for f in result.facts if f.source_page]


def _served_with_facts(content: bytes):
    result = extract_ixbrl(content)
    return result, lxml_html.fromstring(add_page_anchors(content, _anchor_facts(result)))


def test_a_stored_figure_is_wrapped_at_its_tagged_number_and_can_be_a_link_target():
    result, doc = _served_with_facts(_filing(INCOME, BALANCE))
    span = doc.get_element_by_id(fact_anchor_id("revenue", "FY2025"))
    assert span.tag == "span" and span.get("class") == "aladdin-fact"
    assert span.text_content().strip() == "8 095.6"
    # ... and it sits on the page the figure cites
    page = next(f.source_page for f in result.facts if f.metric == "revenue" and f.period == "FY2025")
    assert "Statement of income" in _page_text(doc, page)
    # the prior-year column is a different number with its own target
    assert doc.get_element_by_id(fact_anchor_id("revenue", "FY2024")).text_content().strip() == "7 450.1"


def test_every_stored_figure_with_a_page_gets_some_target_on_its_page():
    result, doc = _served_with_facts(_filing(INCOME, BALANCE))
    assert result.facts
    for fact in result.facts:
        target = doc.get_element_by_id(fact_anchor_id(fact.metric, fact.period))
        page_root = doc.get_element_by_id(f"{ANCHOR_PREFIX}{fact.source_page}").getparent()
        assert target is page_root or page_root in target.iterancestors(), fact.metric


def test_a_derived_figure_falls_back_to_a_page_level_anchor():
    # total_debt is long- plus short-term borrowings: no single tagged number.
    result, doc = _served_with_facts(_filing(INCOME, BALANCE))
    debt = next(f for f in result.facts if f.metric == "total_debt")
    target = doc.get_element_by_id(fact_anchor_id("total_debt", debt.period))
    assert target.tag == "a" and target.get("class") == "aladdin-fact-page"
    assert target.getparent() is doc.get_element_by_id(f"{ANCHOR_PREFIX}{debt.source_page}").getparent()


def test_wrapping_keeps_the_text_around_the_number():
    sentence = (
        "<tr><td>Note: revenue was <ix:nonFraction name='ifrs-full:Revenue' contextRef='fy25' unitRef='usd'"
        " scale='6' decimals='-5' format='ixt:num-dot-decimal'>8 095.6</ix:nonFraction> million in total</td></tr>"
    )
    content = _filing(sentence, BALANCE)  # the only revenue number is inside a sentence
    fact = AnchorFact("revenue", "FY2025", Decimal(8095600000), 2)
    doc = lxml_html.fromstring(add_page_anchors(content, [fact]))
    span = doc.get_element_by_id(fact_anchor_id("revenue", "FY2025"))
    assert span.tag == "span"
    assert span.getparent().text_content() == "Note: revenue was 8 095.6 million in total"
    assert span.tail == " million in total" and span.getparent().text == "Note: revenue was "


def test_two_figures_with_the_same_number_both_get_a_target_around_one_element():
    content = _filing(INCOME, BALANCE)
    value = Decimal(8095600000)
    facts = [AnchorFact("revenue", "FY2025", value, 2), AnchorFact("total_income", "FY2025", value, 2)]
    served = add_page_anchors(content, facts)
    doc = lxml_html.fromstring(served)
    outer = doc.get_element_by_id(fact_anchor_id("total_income", "FY2025"))
    inner = doc.get_element_by_id(fact_anchor_id("revenue", "FY2025"))
    assert inner.getparent() is outer
    assert served.count(b"8 095.6</ix:nonFraction>") == 1  # the number itself is not duplicated


def test_dimensional_and_wrong_year_numbers_are_not_matched():
    content = _filing(INCOME, BALANCE)
    facts = [
        AnchorFact("retained_earnings", "FY2025", Decimal(280000000), 3),  # only tagged with a dimension
        AnchorFact("revenue", "FY2023", Decimal(8095600000), 2),  # right number, wrong year
    ]
    doc = lxml_html.fromstring(add_page_anchors(content, facts))
    for fact in facts:
        target = doc.get_element_by_id(fact_anchor_id(fact.metric, fact.period))
        assert target.tag == "a" and target.get("class") == "aladdin-fact-page"


def test_figures_with_no_page_in_the_file_are_ignored_and_the_highlight_rules_are_present():
    content = _filing(INCOME, BALANCE)
    served = add_page_anchors(content, [AnchorFact("revenue", "FY2025", Decimal(1), 99)])
    doc = lxml_html.fromstring(served)
    assert not doc.xpath("//*[starts-with(@id, 'aladdin-fact-')]")
    css = " ".join(s.text or "" for s in doc.xpath("//head/style"))
    assert "span.aladdin-fact:target" in css and "aladdin-fact-page" in css


def test_fact_anchor_ids_are_fragment_safe():
    assert fact_anchor_id("revenue", "FY2025") == "aladdin-fact-revenue-FY2025"
    assert fact_anchor_id("a b", "FY/2025") == "aladdin-fact-a_b-FY_2025"
