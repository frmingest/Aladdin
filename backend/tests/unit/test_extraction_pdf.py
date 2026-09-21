import pymupdf

from app.services.documents.extraction.pdf import extract_pdf


def _make_pdf(pages_text: list[str]) -> bytes:
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page()
        page.insert_text((72, 72), text)
    content = doc.tobytes()
    doc.close()
    return content


def test_extracts_text_and_page_numbers():
    content = _make_pdf(["Revenue grew 12% year over year.", "Risk factors: FX exposure."])
    result = extract_pdf(content)

    assert len(result.pages) == 2
    assert result.pages[0].page_number == 1
    assert "Revenue grew" in result.pages[0].text
    assert result.pages[1].page_number == 2
    assert "Risk factors" in result.pages[1].text
    assert result.facts == []  # PDF never yields structured facts, by design


def test_low_text_page_is_flagged():
    content = _make_pdf([""])
    result = extract_pdf(content)
    assert result.pages[0].quality == "low_text"


def test_pdf_with_real_text_is_flagged_ok():
    content = _make_pdf(["A" * 50])
    result = extract_pdf(content)
    assert result.pages[0].quality == "ok"
