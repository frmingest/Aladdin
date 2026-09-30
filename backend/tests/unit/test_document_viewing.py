from app.services.documents.viewing import describe_viewing


def test_pdf_and_html_are_inline():
    assert describe_viewing("Q2.PDF", None).inline is True
    xhtml = describe_viewing("kog-2021.xhtml", "application/octet-stream")
    assert xhtml.inline and xhtml.is_html and xhtml.media_type.startswith("text/html")


def test_office_and_csv_are_downloads_and_mime_comes_from_extension_not_client():
    assert describe_viewing("deck.pptx", "application/x-foo").inline is False
    csv = describe_viewing("export.csv", "text/html")  # lying client mime
    assert csv.inline is False and csv.is_html is False
