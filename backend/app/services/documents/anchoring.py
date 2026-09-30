"""Page anchors for reading a stored XHTML/HTML filing next to its figures.

An extracted figure carries `source_page` — the 1-based index of the rendered
report page it was tagged on (see ixbrl._page_containers). The original file
has no stable way to link to that page, so when the file is *served* we insert
an empty anchor `<a id="aladdin-page-N">` as the first child of each page
container, using the very same page detection the extractor used, so page N
here is page N in `financial_line_items.source_page`.

Nothing stored is changed — only the bytes sent to the reader. The reader's
iframe has an empty sandbox (no scripts), so jumping is done with a plain
`#aladdin-page-N` fragment and the landing page is highlighted with CSS
`:target` — no script is ever needed (CLAUDE.md rule 5).
"""
from __future__ import annotations

import logging

from app.services.documents.extraction.ixbrl import _local, _page_containers, parse_ixbrl

logger = logging.getLogger(__name__)

ANCHOR_PREFIX = "aladdin-page-"

# Only the page the reader just jumped to is marked. `:has()` lets the
# (empty) anchor light up its parent page; browsers without it simply skip
# the highlight and still scroll.
_STYLE = (
    "*:has(> a[id^='aladdin-page-']:target){"
    "outline:3px solid #d97706;outline-offset:-3px;"
    "background-color:rgba(217,119,6,.07);scroll-margin-top:12px}"
)


def add_page_anchors(content: bytes) -> bytes:
    """Returns `content` with page anchors inserted, or `content` unchanged if
    the file has no detectable pages or cannot be parsed. Never raises."""
    try:
        return _add_page_anchors(content)
    except Exception:  # noqa: BLE001 - a viewing aid must never break viewing
        logger.warning("could not add page anchors; serving the original file", exc_info=True)
        return content


def _add_page_anchors(content: bytes) -> bytes:
    from lxml import etree

    root = parse_ixbrl(content)
    body = next((el for el in root.iter() if isinstance(el.tag, str) and _local(el.tag) == "body"), root)
    containers = _page_containers(body)
    if not containers:
        return content

    for number, container in enumerate(containers, start=1):
        anchor = etree.Element("a")
        anchor.set("id", f"{ANCHOR_PREFIX}{number}")
        anchor.tail = container.text  # keep the container's leading text where it was
        container.text = None
        container.insert(0, anchor)

    head = next((el for el in root.iter() if isinstance(el.tag, str) and _local(el.tag) == "head"), None)
    if head is not None:
        style = etree.SubElement(head, "style")
        style.text = _STYLE

    # HTML serialisation on purpose: the file is served as text/html, where
    # an XML-style `<div/>` would be read as an *open* div and swallow the
    # rest of the page.
    return etree.tostring(root.getroottree(), method="html", encoding="utf-8")
