"""Anchors for reading a stored XHTML/HTML filing next to its figures.

An extracted figure carries `source_page` — the 1-based index of the rendered
report page it was tagged on (see ixbrl._page_containers). The original file
has no stable way to link to that page, or to the number itself, so when the
file is *served* for reading we add two kinds of target, using the very same
page detection and number parsing the extractor used:

* **page anchor** `<a id="aladdin-page-N">` — first child of each page.
* **figure anchor** `aladdin-fact-<metric>-<period>` for each stored figure:
  - exact: the tagged number on that page with the same period and value is
    wrapped in `<span class="aladdin-fact" id=…>`, which is highlighted when
    it is the link target;
  - fallback (derived figures — sums, EBITDA — or a number that can't be
    matched): an empty `<a class="aladdin-fact-page" id=…>` at the top of the
    figure's page, which outlines the page instead.
So a link to `#aladdin-fact-<metric>-<period>` always lands somewhere sensible.

Nothing stored is changed — only the bytes sent to the reader. The reader's
iframe has an empty sandbox (no scripts), so jumping is a plain URL fragment
and the highlight is CSS `:target` — no script is ever needed (CLAUDE.md
rule 5).
"""
from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from app.services.documents.extraction.ixbrl import (
    ANNUAL_MAX_DAYS,
    ANNUAL_MIN_DAYS,
    _fy_label,
    _ix_number,
    _local,
    _page_containers,
    _parse_contexts,
    parse_ixbrl,
)

logger = logging.getLogger(__name__)

ANCHOR_PREFIX = "aladdin-page-"
FACT_PREFIX = "aladdin-fact-"

_HIGHLIGHT = "outline:3px solid #d97706;outline-offset:-3px;background-color:rgba(217,119,6,.07)"
# `:has()` lets an empty anchor light up its parent page; browsers without it
# skip the outline and still scroll. The exact-number span is highlighted
# directly and scrolls to the middle of the view.
_STYLE = (
    f"*:has(> a[id^='{ANCHOR_PREFIX}']:target),*:has(> a.aladdin-fact-page:target)"
    f"{{{_HIGHLIGHT};scroll-margin-top:12px}}"
    "span.aladdin-fact:target{background-color:#fde68a;color:#000;"
    "outline:2px solid #d97706;border-radius:3px;scroll-margin-top:40vh}"
)


@dataclass(frozen=True)
class AnchorFact:
    """A stored figure, as much of it as is needed to find it in the file."""

    metric: str
    period: str  # "FY2025"
    value: Decimal  # full units, as stored
    page: int  # 1-based source_page


def fact_anchor_id(metric: str, period: str) -> str:
    """The fragment id for one figure. The frontend builds the same string
    (lib/documents.ts factFragment)."""
    return FACT_PREFIX + re.sub(r"[^A-Za-z0-9_-]", "_", f"{metric}-{period}")


def add_page_anchors(content: bytes, facts: Sequence[AnchorFact] = ()) -> bytes:
    """Returns `content` with anchors inserted, or `content` unchanged if the
    file has no detectable pages or cannot be parsed. Never raises."""
    try:
        return _add_anchors(content, facts)
    except Exception:
        logger.warning("could not add anchors; serving the original file", exc_info=True)
        return content


def _add_anchors(content: bytes, facts: Sequence[AnchorFact]) -> bytes:
    from lxml import etree

    root = parse_ixbrl(content)
    body = next((el for el in root.iter() if isinstance(el.tag, str) and _local(el.tag) == "body"), root)
    containers = _page_containers(body)
    if not containers:
        return content

    # Find every figure's number BEFORE changing the tree.
    matches, unmatched = _match_facts(root, containers, facts)

    for number, container in enumerate(containers, start=1):
        anchor = etree.Element("a")
        anchor.set("id", f"{ANCHOR_PREFIX}{number}")
        anchor.tail = container.text  # keep the container's leading text where it was
        container.text = None
        container.insert(0, anchor)

    outermost: dict[int, object] = {}  # id(element) -> the node now wrapping it
    for fact, element in matches:
        node = outermost.get(id(element), element)
        parent = node.getparent()
        if parent is None:
            unmatched.append(fact)
            continue
        span = etree.Element("span")
        span.set("id", fact_anchor_id(fact.metric, fact.period))
        span.set("class", "aladdin-fact")
        parent.insert(parent.index(node), span)
        tail, node.tail = node.tail, None
        span.append(node)
        span.tail = tail
        outermost[id(element)] = span

    for fact in unmatched:
        anchor = etree.Element("a")
        anchor.set("id", fact_anchor_id(fact.metric, fact.period))
        anchor.set("class", "aladdin-fact-page")
        containers[fact.page - 1].insert(1, anchor)  # just after the page anchor

    head = next((el for el in root.iter() if isinstance(el.tag, str) and _local(el.tag) == "head"), None)
    if head is not None:
        style = etree.SubElement(head, "style")
        style.text = _STYLE

    # HTML serialisation on purpose: the file is served as text/html, where
    # an XML-style `<div/>` would be read as an *open* div and swallow the
    # rest of the page.
    return etree.tostring(root.getroottree(), method="html", encoding="utf-8")


def _match_facts(root, containers: list, facts: Sequence[AnchorFact]):
    """(matched [(fact, element)], unmatched [fact]). A figure matches the
    first non-dimensional annual number on its own page with the same fiscal
    year and the same magnitude; derived figures simply don't match."""
    usable = [f for f in facts if 1 <= f.page <= len(containers)]
    if not usable:
        return [], []

    contexts = _parse_contexts(root)
    fiscal_year_ends = {
        (c.end.month, c.end.day)
        for c in contexts.values()
        if not c.is_instant and c.start is not None and ANNUAL_MIN_DAYS <= (c.end - c.start).days <= ANNUAL_MAX_DAYS
    }

    candidates: dict[int, list[tuple[str, Decimal, object]]] = {}
    for page in {f.page for f in usable}:
        found = []
        for el in containers[page - 1].iter():
            if not isinstance(el.tag, str) or _local(el.tag) != "nonFraction":
                continue
            ctx = contexts.get(el.get("contextRef") or "")
            if ctx is None or ctx.dimensional:
                continue
            fy = _fy_label(ctx, fiscal_year_ends)
            value = _ix_number(el)
            if fy is None or value is None:
                continue
            found.append((fy, abs(value), el))
        candidates[page] = found

    matched, unmatched, seen = [], [], set()
    for fact in usable:
        key = fact_anchor_id(fact.metric, fact.period)
        if key in seen:  # one target per figure
            continue
        seen.add(key)
        element = next(
            (el for fy, value, el in candidates[fact.page] if fy == fact.period and value == abs(fact.value)),
            None,
        )
        if element is None:
            unmatched.append(fact)
        else:
            matched.append((fact, element))
    return matched, unmatched
