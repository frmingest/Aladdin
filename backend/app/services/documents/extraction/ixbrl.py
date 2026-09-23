"""Inline XBRL (iXBRL) extraction — ESEF annual reports (.xhtml, mandatory
for EU/EEA-listed companies incl. Oslo Børs) and SEC 10-K/20-F .htm files.

This is the most reliable upload format the app accepts: every number in
the primary statements carries a machine-readable tag with its concept
(e.g. ifrs-full:Assets), period (context), unit (iso4217:USD), scale
(10^6) and sign — so nothing is inferred from layout. Facts are promoted
deterministically (CLAUDE.md Rule 1):

* only non-dimensional (group/consolidated total) facts;
* only annual durations (350-380 days) or instants at a fiscal year end
  found in the same filing, stored as "FY<year of period end>";
* concept -> canonical metric via the same priority lists the SEC EDGAR
  import uses (app/providers/sec_edgar_provider.py CONCEPT_MAP), plus a
  short ESEF-specific fallback list below;
* the same concept+period tagged twice with different values is a conflict
  and is not imported.

The document is also kept as page text (one page per rendered report page
where the generator marks pages, else ~4 000-character chunks), plus one
final "Tagged XBRL facts" page listing every tagged number — including the
company's own extension concepts — so the evidence packet can cite exact
tagged values. Security: parsed with entity resolution and network access
disabled (no XXE); scripts/styles/fonts never reach the page text.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

from app.domain.financial_metrics import POSITIVE_MAGNITUDE_METRICS
from app.providers.sec_edgar_provider import CONCEPT_MAP as EDGAR_CONCEPT_MAP
from app.services.documents.extraction.base import (
    ExtractedFact,
    ExtractedPage,
    ExtractionResult,
    quality_for_text,
)

IX_NS = "http://www.xbrl.org/2013/inlineXBRL"
XBRLI_NS = "http://www.xbrl.org/2003/instance"
XBRLDI_NS = "http://xbrl.org/2006/xbrldi"

ANNUAL_MIN_DAYS = 350
ANNUAL_MAX_DAYS = 380
CHUNK_CHARS = 4_000
IXBRL_CONFIDENCE = 1.0
DERIVED_CONFIDENCE = 0.95

# ESEF filers often tag the face of the statement with a broader concept
# than the ones SEC EDGAR's map lists. Appended AFTER the EDGAR priority
# list, so they're used only when none of those is tagged.
_ESEF_FALLBACK_CONCEPTS: dict[str, tuple[str, ...]] = {
    # "Total income" = revenue + other operating income (e.g. Vår Energi).
    "revenue": ("ifrs-full:RevenueAndOperatingIncome",),
    "interest_expense": ("ifrs-full:InterestExpenseOnBorrowings",),
    "shares_outstanding": ("ifrs-full:NumberOfSharesIssuedAndFullyPaid",),
}

# total_debt fallback when no single borrowings total is tagged: the sum of
# the long- and short-term borrowings lines (leases excluded, matching
# us-gaap:LongTermDebt). Computed here, in code.
_DEBT_COMPONENTS = (
    "ifrs-full:LongtermBorrowings",
    "ifrs-full:NoncurrentPortionOfNoncurrentBorrowings",
    "ifrs-full:ShorttermBorrowings",
    "ifrs-full:CurrentPortionOfLongtermBorrowings",
    "ifrs-full:CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings",
)

_SKIP_TEXT_TAGS = {"style", "script", "head", "title", "header", "hidden", "resources", "references"}
_BREAK = "\ue000"  # private-use char: not whitespace, so it survives collapsing
_BLOCK_TAGS = {"div", "p", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table", "br", "section"}


def _concept_map() -> dict[str, tuple[str, ...]]:
    merged: dict[str, tuple[str, ...]] = {}
    for metric, concepts in EDGAR_CONCEPT_MAP.items():
        merged[metric] = tuple(concepts) + _ESEF_FALLBACK_CONCEPTS.get(metric, ())
    return merged


CONCEPT_MAP = _concept_map()


@dataclass(frozen=True)
class _Context:
    start: date | None
    end: date  # instant date for instants
    is_instant: bool
    dimensional: bool


@dataclass
class TaggedFact:
    concept: str
    context_id: str
    value: Decimal
    unit: str | None  # "USD", "shares", "USD/shares", ...
    page: int
    decimals: str | None


def _local(tag: object) -> str:
    return tag.split("}", 1)[1] if isinstance(tag, str) and "}" in tag else str(tag)


def _parse_date(text: str | None) -> date | None:
    if not text:
        return None
    try:
        return date.fromisoformat(text.strip()[:10])
    except ValueError:
        return None


def _parse_contexts(root) -> dict[str, _Context]:
    contexts: dict[str, _Context] = {}
    for ctx in root.iter(f"{{{XBRLI_NS}}}context"):
        cid = ctx.get("id")
        period = ctx.find(f"{{{XBRLI_NS}}}period")
        if cid is None or period is None:
            continue
        dimensional = any(
            _local(el.tag) in {"explicitMember", "typedMember"} for el in ctx.iter()
        )
        instant = _parse_date(period.findtext(f"{{{XBRLI_NS}}}instant"))
        if instant is not None:
            contexts[cid] = _Context(None, instant, True, dimensional)
            continue
        start = _parse_date(period.findtext(f"{{{XBRLI_NS}}}startDate"))
        end = _parse_date(period.findtext(f"{{{XBRLI_NS}}}endDate"))
        if end is not None:
            contexts[cid] = _Context(start, end, False, dimensional)
    return contexts


def _parse_units(root) -> dict[str, str]:
    units: dict[str, str] = {}
    for unit in root.iter(f"{{{XBRLI_NS}}}unit"):
        uid = unit.get("id")
        if uid is None:
            continue
        measures = [m.text.split(":")[-1].strip() for m in unit.iter(f"{{{XBRLI_NS}}}measure") if m.text]
        if not measures:
            continue
        divide = unit.find(f"{{{XBRLI_NS}}}divide")
        units[uid] = "/".join(measures) if divide is not None else measures[0]
    return units


def _ix_number(element) -> Decimal | None:
    """Applies the ixt transformation named in @format, then @scale and
    @sign — the iXBRL spec's rules, nothing inferred."""
    if element.get("{http://www.w3.org/2001/XMLSchema-instance}nil") == "true":
        return None
    raw = "".join(element.itertext()).strip()
    fmt = (element.get("format") or "").split(":")[-1].lower()
    if fmt in {"fixed-zero", "zerodash", "numdash", "fixed-empty"} or re.fullmatch(r"[-–—]+", raw):
        number = Decimal(0)
    else:
        cleaned = re.sub(r"[\s   ']", "", raw)
        if "comma-decimal" in fmt or fmt in {"numcommadecimal", "num-comma-decimal"}:
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:  # num-dot-decimal / numdotdecimal / no format
            cleaned = cleaned.replace(",", "")
        if not re.fullmatch(r"\d+(\.\d+)?", cleaned or ""):
            return None
        try:
            number = Decimal(cleaned)
        except InvalidOperation:
            return None
    try:
        scale = int(element.get("scale") or 0)
    except ValueError:
        return None
    number = Decimal(format(number.scaleb(scale), "f"))  # plain notation, not 7.349E+8
    if element.get("sign") == "-":
        number = -number
    return number


def _page_containers(body) -> list:
    """Rendered-report pages: the first descendant (walking down through
    single-child wrappers) with 3+ element children that each hold text.
    Generators (ParsePort, Workiva, ...) all render one element per page,
    but under different class names, so this is structural, not by class."""
    node = body
    for _ in range(12):
        children = [c for c in node if isinstance(c.tag, str) and "display:none" not in (c.get("style") or "").replace(" ", "")]
        if len(children) >= 3:
            return children
        if len(children) == 1:
            node = children[0]
            continue
        # two visible children: descend into the bigger one
        if len(children) == 2:
            node = max(children, key=lambda c: len(c))
            continue
        break
    return []


def _element_text(element) -> str:
    parts: list[str] = []

    def walk(el, in_cell: bool = False) -> None:
        if not isinstance(el.tag, str):  # comments / processing instructions
            if el.tail:
                parts.append(el.tail)
            return
        tag = _local(el.tag)
        hidden = "display:none" in (el.get("style") or "").replace(" ", "")
        if tag in _SKIP_TEXT_TAGS or hidden:
            if el.tail:
                parts.append(el.tail)
            return
        is_cell = tag in {"td", "th"}
        # Paragraphs inside a table cell don't break the table row's line.
        breaks = tag in _BLOCK_TAGS and not (in_cell and tag != "tr")
        if breaks:
            parts.append(_BREAK)
        elif is_cell:
            parts.append(" | ")
        if el.text:
            parts.append(el.text)
        for child in el:
            walk(child, in_cell or is_cell)
        if breaks:
            parts.append(_BREAK)
        if el.tail:
            parts.append(el.tail)

    walk(element)
    # HTML whitespace semantics: source newlines/indentation are just
    # spaces; only block elements break lines.
    text = " ".join("".join(parts).split())
    lines = [line.strip(" |") for line in text.split(_BREAK)]
    lines = [" | ".join(p.strip() for p in line.split(" | ") if p.strip()) for line in lines]
    return "\n".join(line for line in lines if line)


def _chunk(text: str) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    size = 0
    for line in text.split("\n"):
        if size + len(line) > CHUNK_CHARS and current:
            chunks.append("\n".join(current))
            current, size = [], 0
        current.append(line)
        size += len(line) + 1
    if current:
        chunks.append("\n".join(current))
    return chunks


def _fy_label(ctx: _Context, fiscal_year_ends: set[tuple[int, int]]) -> str | None:
    if ctx.is_instant:
        return f"FY{ctx.end.year}" if (ctx.end.month, ctx.end.day) in fiscal_year_ends else None
    if ctx.start is None:
        return None
    days = (ctx.end - ctx.start).days
    return f"FY{ctx.end.year}" if ANNUAL_MIN_DAYS <= days <= ANNUAL_MAX_DAYS else None


def _fmt(value: Decimal) -> str:
    return f"{value.normalize():,f}".replace(",", " ")


def parse_ixbrl(content: bytes):
    from lxml import etree

    parser = etree.XMLParser(
        huge_tree=True, resolve_entities=False, no_network=True, load_dtd=False, recover=False
    )
    try:
        return etree.fromstring(content, parser)
    except etree.XMLSyntaxError:
        # A .htm/.html 10-K is sometimes not well-formed XML; the HTML
        # parser is lenient and still keeps the ix: elements by name.
        from lxml import html as lxml_html

        return lxml_html.fromstring(content)


def extract_ixbrl(content: bytes) -> ExtractionResult:
    root = parse_ixbrl(content)
    body = next((el for el in root.iter() if isinstance(el.tag, str) and _local(el.tag) == "body"), root)

    # --- pages ---------------------------------------------------------------
    containers = _page_containers(body)
    page_texts: list[str] = []
    # (element, page) for every ix:nonFraction; page 0 = not inside a page
    # container (or the document isn't paged).
    numeric_elements: list[tuple[object, int]] = []
    in_pages: set[str] = set()
    tree = root.getroottree()
    if containers:
        for container in containers:
            page_texts.append(_element_text(container))
            number = len(page_texts)
            for el in container.iter():
                if isinstance(el.tag, str) and _local(el.tag) == "nonFraction":
                    numeric_elements.append((el, number))
                    in_pages.add(tree.getpath(el))
    else:
        page_texts = _chunk(_element_text(body))
    for el in root.iter():
        if isinstance(el.tag, str) and _local(el.tag) == "nonFraction" and tree.getpath(el) not in in_pages:
            numeric_elements.append((el, 0))

    # --- tagged facts -----------------------------------------------------------
    contexts = _parse_contexts(root)
    units = _parse_units(root)
    is_ixbrl = bool(contexts)
    tagged: list[TaggedFact] = []
    unreadable = 0
    for el, page_number in numeric_elements:
        concept = el.get("name")
        context_id = el.get("contextRef")
        if not concept or context_id not in contexts:
            continue
        value = _ix_number(el)
        if value is None:
            unreadable += 1
            continue
        tagged.append(
            TaggedFact(
                concept=concept,
                context_id=context_id,
                value=value,
                unit=units.get(el.get("unitRef") or ""),
                page=page_number,
                decimals=el.get("decimals"),
            )
        )

    fiscal_year_ends = {
        (c.end.month, c.end.day)
        for c in contexts.values()
        if not c.is_instant and c.start is not None
        and ANNUAL_MIN_DAYS <= (c.end - c.start).days <= ANNUAL_MAX_DAYS
    }

    # (concept, FY) -> values seen on non-dimensional annual contexts
    by_concept: dict[tuple[str, str], list[TaggedFact]] = {}
    for fact in tagged:
        ctx = contexts[fact.context_id]
        if ctx.dimensional:
            continue
        fy = _fy_label(ctx, fiscal_year_ends)
        if fy is None:
            continue
        by_concept.setdefault((fact.concept, fy), []).append(fact)

    conflicts: list[str] = []
    resolved: dict[tuple[str, str], TaggedFact] = {}
    for key, facts in by_concept.items():
        if len({f.value for f in facts}) > 1:
            conflicts.append(
                f"{key[1]} {key[0]}: " + ", ".join(sorted({_fmt(f.value) for f in facts}))
            )
            continue
        resolved[key] = facts[0]

    years = sorted({fy for (_, fy) in resolved}, reverse=True)
    facts_out: list[ExtractedFact] = []
    mapping_lines: list[str] = []
    for metric, concepts in CONCEPT_MAP.items():
        for fy in years:
            chosen: TaggedFact | None = next(
                (resolved[(c, fy)] for c in concepts if (c, fy) in resolved), None
            )
            value: Decimal | None = None
            confidence = IXBRL_CONFIDENCE
            source = ""
            unit_raw: str | None = None
            page: int | None = None
            if chosen is not None:
                value = chosen.value
                source = chosen.concept
                unit_raw = chosen.unit
                page = chosen.page or None
            elif metric == "total_debt":
                parts = [resolved[(c, fy)] for c in _DEBT_COMPONENTS if (c, fy) in resolved]
                if parts and len({p.unit for p in parts}) == 1:
                    value = sum((p.value for p in parts), Decimal(0))
                    confidence = DERIVED_CONFIDENCE
                    source = " + ".join(p.concept for p in parts)
                    unit_raw = parts[0].unit
                    page = parts[0].page or None
            if value is None:
                continue
            if metric == "shares_outstanding":
                unit, currency = "shares", None
            else:
                if not unit_raw or not re.fullmatch(r"[A-Z]{3}", unit_raw):
                    continue  # a monetary metric without a currency unit is not trusted
                unit, currency = unit_raw, unit_raw
            if metric in POSITIVE_MAGNITUDE_METRICS:
                value = abs(value)
            facts_out.append(
                ExtractedFact(
                    metric=metric,
                    value=value,
                    unit=unit,
                    currency=currency,
                    period=fy,
                    source_page=page,
                    confidence=confidence,
                )
            )
            mapping_lines.append(f"{fy} {metric} = {_fmt(value)} {unit} <- {source}")

    # --- the "Tagged XBRL facts" evidence page -------------------------------
    if tagged:
        lines = [
            "Tagged XBRL facts (machine-readable values from this filing; group totals only)",
            "Mapped to Aladdin metrics:",
            *mapping_lines,
            "",
            "All tagged numbers (concept | period | value | unit | page):",
        ]
        seen: set[tuple[str, str, Decimal]] = set()
        for fact in tagged:
            ctx = contexts[fact.context_id]
            if ctx.dimensional:
                continue
            period = (
                f"at {ctx.end.isoformat()}"
                if ctx.is_instant
                else f"{ctx.start.isoformat() if ctx.start else '?'}..{ctx.end.isoformat()}"
            )
            key = (fact.concept, period, fact.value)
            if key in seen:
                continue
            seen.add(key)
            lines.append(f"{fact.concept} | {period} | {_fmt(fact.value)} | {fact.unit or ''} | p{fact.page or '?'}")
        page_texts.append("\n".join(lines))

    pages = [
        ExtractedPage(page_number=i, text=text, quality=quality_for_text(text))
        for i, text in enumerate(page_texts, start=1)
    ]
    flags: list[str] = []
    details: dict[str, object] = {}
    if not is_ixbrl:
        flags.append("no_ixbrl_tags")  # plain HTML page: text only, no facts
    else:
        details["ixbrl"] = {
            "tagged_numbers": len(tagged),
            "fiscal_years": years,
            "facts_mapped": len(facts_out),
            "unreadable_numbers": unreadable,
        }
    if conflicts:
        flags.append("fact_conflicts")
        details["fact_conflicts"] = conflicts[:20]
    if not pages or not any(p.text.strip() for p in pages):
        flags.append("no_pages_extracted")
    return ExtractionResult(pages=pages, facts=facts_out, quality_flags=flags, details=details)
