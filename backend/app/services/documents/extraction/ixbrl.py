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

from app.domain.financial_metrics import PER_SHARE_METRICS, POSITIVE_MAGNITUDE_METRICS
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
    # Oil & gas producers tag their revenue line with the sector concept
    # (Vår Energi 2025: 7 965.7) — preferred over "Total income" below,
    # which also contains other operating income (130.0).
    # "Total income" = revenue + other operating income — last resort.
    "revenue": (
        "ifrs-full:RevenueFromSaleOfPetroleumAndPetrochemicalProducts",
        "ifrs-full:RevenueAndOperatingIncome",
    ),
    "interest_expense": ("ifrs-full:InterestExpenseOnBorrowings",),
    "shares_outstanding": ("ifrs-full:NumberOfSharesIssuedAndFullyPaid",),
    # Income statement by nature (Salmon Evolution): no cost of sales, but
    # raw materials and consumables used — feeds "materials margin".
    "raw_materials_used": ("ifrs-full:RawMaterialsAndConsumablesUsed",),
    "eps_basic": ("ifrs-full:BasicAndDilutedEarningsLossPerShare",),
}

# Lease liabilities are usually tagged as a current and a non-current line
# (Vår Energi 2024: 70.4 + 141.5) rather than one total.
_LEASE_COMPONENTS = ("ifrs-full:CurrentLeaseLiabilities", "ifrs-full:NoncurrentLeaseLiabilities")

# Inserted BEFORE the generic ifrs-full concepts of the EDGAR list (after
# the us-gaap ones): a stricter concept that, when tagged, is the right one.
_ESEF_PREFERRED_CONCEPTS: dict[str, tuple[str, ...]] = {
    # Profit attributable to ORDINARY shareholders — excludes the coupon
    # owed to holders of hybrid/perpetual capital classified as equity
    # (Vår Energi 2025: 785.2 vs ProfitLoss 846.4). This is the figure EPS
    # is computed from, so it's what an owner of the shares earns.
    "net_income": ("ifrs-full:ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity",),
    # Operating profit is EBIT on an IFRS income statement (finance items
    # and tax come below it). A mapping, not a computation.
    "ebit": ("ifrs-full:ProfitLossFromOperatingActivities",),
}

# Last-resort stand-ins for a metric the filing doesn't tag on the face of
# the statements. Stored with PROXY_CONFIDENCE and labelled "proxy" in the
# mapping, so nothing downstream mistakes them for the accrual figure.
# Interest paid (cash) — used when only net finance income/cost is tagged
# (net of interest income and decommissioning accretion, so not interest
# expense). Cash interest includes capitalised interest, i.e. it is the
# conservative (larger) choice for interest coverage.
_PROXY_CONCEPTS: dict[str, tuple[str, ...]] = {
    "interest_expense": (
        "ifrs-full:InterestPaidClassifiedAsOperatingActivities",
        "ifrs-full:InterestPaidClassifiedAsFinancingActivities",
        "ifrs-full:InterestPaid",
    ),
}
PROXY_CONFIDENCE = 0.9

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

# Capital expenditure = every investing outflow that buys productive
# assets, not only PP&E. For an E&P company capitalised exploration
# (E&E assets) is capex like any other (Vår Energi 2025: PP&E 2 456.6 +
# E&E 363.1). A filer that tags one combined line is taken as-is.
_CAPEX_COMBINED = (
    "ifrs-full:PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets",
)
_CAPEX_COMPONENTS = (
    "ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
    "ifrs-full:PurchaseOfExplorationAndEvaluationAssets",
    "ifrs-full:PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities",
)

# EBITDA inputs (derived in code, never read from a company's own
# "EBITDA" extension tag, whose definition varies by company).
_OPERATING_PROFIT = "ifrs-full:ProfitLossFromOperatingActivities"
_PURE_DA = "ifrs-full:DepreciationAndAmortisationExpense"
_DA_WITH_IMPAIRMENT = (
    "ifrs-full:DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss"
)
_IMPAIRMENT = "ifrs-full:ImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss"

# Equity instruments that are not ordinary shares (hybrid bonds, perpetual
# notes, AT1) — IFRS classifies them as equity, a shareholder's view says
# they are closer to debt. Detected so the metrics can warn; total_equity
# itself stays the reported figure.
_OTHER_EQUITY_CONCEPTS = ("ifrs-full:OtherEquityInterest",)
_OTHER_EQUITY_NAME = re.compile(r"(Hybrid|Perpetual)", re.IGNORECASE)

# Fair-value changes on living stock (salmon, livestock, crops) are
# unrealised, non-cash gains/losses. Taken out of EBIT and EBITDA the way the
# industry reports "operational EBIT" (Salmon Evolution 2025: +15.6 NOKm).
_BIOLOGICAL_FAIR_VALUE = (
    "ifrs-full:GainsLossesOnFairValueAdjustmentBiologicalAssets",
    "ifrs-full:GainLossArisingFromChangesInFairValueLessCostsToSellOfBiologicalAssets",
)

# Owner's-view cash outflows (decided 2026-09-23, see
# claude/fy2025-uploads-external-validation-2026-09-23.md). IFRS lets a
# company put these outside operating activities, so operating cash flow
# minus capex overstates what is left for the ordinary shareholder. Each is
# extracted as its own positive fact; app/services/metrics.py subtracts it.
# Standard concept first; otherwise every matching company-extension line of
# the cash-flow statement is summed (cash-flow lines are additive).
_OWNER_VIEW_STANDARD: dict[str, tuple[str, ...]] = {
    "interest_paid_financing": ("ifrs-full:InterestPaidClassifiedAsFinancingActivities",),
    "lease_payments_financing": ("ifrs-full:PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities",),
    "decommissioning_payments": (),
    "hybrid_distributions": (),
}
_OWNER_VIEW_EXTENSION: dict[str, re.Pattern] = {
    # Salmon Evolution: FinanceCostsPaid... + InterestPaidOnLeaseLiabilities...
    "interest_paid_financing": re.compile(
        r"(InterestPaid|FinanceCostsPaid)\w*ClassifiedAsFinancingActivities$"
    ),
    "lease_payments_financing": re.compile(
        r"^PaymentsOfLeaseLiabilities\w*ClassifiedAsFinancingActivities$"
    ),
    # Vår Energi: PaymentsForRemovalAndDecommissioningOfOilAndGasFields...
    "decommissioning_payments": re.compile(
        r"(Decommissioning|Abandonment)\w*ClassifiedAs(Investing|Financing)Activities$"
    ),
    # Vår Energi: DividendsPaidToHybridCapitalOwnersClassifiedAsFinancingActivities
    "hybrid_distributions": re.compile(
        r"(Dividend|Distribution|Coupon|Interest)\w*(Hybrid|Perpetual)\w*ClassifiedAsFinancingActivities$"
    ),
}
OWNER_VIEW_METRICS = ("hybrid_capital", *_OWNER_VIEW_STANDARD)

# Arithmetic identities every IFRS statement must satisfy. A failure means
# the filing, or our reading of it, is wrong — flagged, never hidden.
# (lhs, rhs terms as (concept, +1/-1))
_INTEGRITY_CHECKS: tuple[tuple[str, str, tuple[tuple[str, int], ...]], ...] = (
    ("balance sheet balances", "ifrs-full:Assets", (("ifrs-full:EquityAndLiabilities", 1),)),
    (
        "assets = equity + liabilities",
        "ifrs-full:Assets",
        (("ifrs-full:Equity", 1), ("ifrs-full:Liabilities", 1)),
    ),
    (
        "assets = current + non-current",
        "ifrs-full:Assets",
        (("ifrs-full:CurrentAssets", 1), ("ifrs-full:NoncurrentAssets", 1)),
    ),
    (
        "liabilities = current + non-current",
        "ifrs-full:Liabilities",
        (("ifrs-full:CurrentLiabilities", 1), ("ifrs-full:NoncurrentLiabilities", 1)),
    ),
    (
        "profit = pre-tax profit - tax",
        "ifrs-full:ProfitLoss",
        (("ifrs-full:ProfitLossBeforeTax", 1), ("ifrs-full:IncomeTaxExpenseContinuingOperations", -1)),
    ),
)

_SKIP_TEXT_TAGS = {"style", "script", "head", "title", "header", "hidden", "resources", "references"}
_BREAK = "\ue000"  # private-use char: not whitespace, so it survives collapsing
_BLOCK_TAGS = {"div", "p", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table", "br", "section"}


def _concept_map() -> dict[str, tuple[str, ...]]:
    merged: dict[str, tuple[str, ...]] = {}
    metrics = list(EDGAR_CONCEPT_MAP) + [
        m for m in (*_ESEF_PREFERRED_CONCEPTS, *_ESEF_FALLBACK_CONCEPTS) if m not in EDGAR_CONCEPT_MAP
    ]
    for metric in metrics:
        concepts = tuple(EDGAR_CONCEPT_MAP.get(metric, ()))
        us_gaap = tuple(c for c in concepts if not c.startswith("ifrs-full:"))
        ifrs = tuple(c for c in concepts if c.startswith("ifrs-full:"))
        merged[metric] = (
            us_gaap
            + _ESEF_PREFERRED_CONCEPTS.get(metric, ())
            + ifrs
            + _ESEF_FALLBACK_CONCEPTS.get(metric, ())
        )
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


def _positive(fact: TaggedFact) -> Decimal:
    return abs(fact.value)


def _resolve_metric(
    metric: str, fy: str, resolved: dict[tuple[str, str], TaggedFact]
) -> tuple[Decimal, float, str, str | None, int | None] | None:
    """(value, confidence, source description, unit, page) for one metric
    and fiscal year, or None. Direct tags win; derived sums/proxies are
    clearly labelled and carry a lower confidence."""

    def get(concept: str) -> TaggedFact | None:
        return resolved.get((concept, fy))

    if metric == "capital_expenditures":
        combined = next((get(c) for c in _CAPEX_COMBINED if get(c) is not None), None)
        if combined is not None:
            return _positive(combined), IXBRL_CONFIDENCE, combined.concept, combined.unit, combined.page or None
        parts = [get(c) for c in _CAPEX_COMPONENTS if get(c) is not None]
        if parts and len({p.unit for p in parts}) == 1:
            if len(parts) == 1:
                only = parts[0]
                return _positive(only), IXBRL_CONFIDENCE, only.concept, only.unit, only.page or None
            total = sum((_positive(p) for p in parts), Decimal(0))
            return (
                total,
                DERIVED_CONFIDENCE,
                "derived: " + " + ".join(p.concept for p in parts),
                parts[0].unit,
                parts[0].page or None,
            )
        # fall through to the generic concept list

    biological = next((get(c) for c in _BIOLOGICAL_FAIR_VALUE if get(c) is not None), None)
    if biological is not None and biological.value == 0:
        biological = None

    if metric == "ebit":
        operating = get(_OPERATING_PROFIT)
        if operating is not None and biological is not None and biological.unit == operating.unit:
            return (
                operating.value - biological.value,
                DERIVED_CONFIDENCE,
                f"derived: {operating.concept} - {biological.concept}",
                operating.unit,
                operating.page or None,
            )
        # fall through to the concept list

    if metric == "hybrid_capital":
        return _hybrid_capital(fy, resolved)

    if metric in _OWNER_VIEW_STANDARD:
        return _owner_view_outflow(metric, fy, resolved)

    if metric == "ebitda":
        operating = get(_OPERATING_PROFIT)
        if operating is None:
            return None
        combined_da = get(_DA_WITH_IMPAIRMENT)
        pure_da = get(_PURE_DA)
        if combined_da is not None:
            addbacks = [combined_da]
            value = operating.value + _positive(combined_da)
        elif pure_da is not None:
            addbacks = [pure_da]
            value = operating.value + _positive(pure_da)
            impairment = get(_IMPAIRMENT)
            if impairment is not None:
                # Signed as tagged: positive = impairment loss (added back),
                # negative = reversal (a non-cash gain, taken out).
                addbacks.append(impairment)
                value += impairment.value
        else:
            return None
        if len({operating.unit, *(a.unit for a in addbacks)}) != 1:
            return None
        source = "derived: " + " + ".join([operating.concept, *(a.concept for a in addbacks)])
        if biological is not None and biological.unit == operating.unit:
            value -= biological.value
            source += f" - {biological.concept}"
        return (value, DERIVED_CONFIDENCE, source, operating.unit, operating.page or None)

    concepts = CONCEPT_MAP.get(metric, ())
    chosen = next((get(c) for c in concepts if get(c) is not None), None)
    if chosen is not None:
        return chosen.value, IXBRL_CONFIDENCE, chosen.concept, chosen.unit, chosen.page or None

    if metric == "lease_liabilities":
        parts = [get(c) for c in _LEASE_COMPONENTS if get(c) is not None]
        if parts and len({p.unit for p in parts}) == 1:
            return (
                sum((_positive(p) for p in parts), Decimal(0)),
                IXBRL_CONFIDENCE if len(parts) == 1 else DERIVED_CONFIDENCE,
                parts[0].concept if len(parts) == 1 else "derived: " + " + ".join(p.concept for p in parts),
                parts[0].unit,
                parts[0].page or None,
            )
        return None

    if metric == "total_debt":
        parts = [get(c) for c in _DEBT_COMPONENTS if get(c) is not None]
        if parts and len({p.unit for p in parts}) == 1:
            return (
                sum((p.value for p in parts), Decimal(0)),
                DERIVED_CONFIDENCE,
                " + ".join(p.concept for p in parts),
                parts[0].unit,
                parts[0].page or None,
            )

    proxy = next((get(c) for c in _PROXY_CONCEPTS.get(metric, ()) if get(c) is not None), None)
    if proxy is not None:
        return proxy.value, PROXY_CONFIDENCE, f"proxy: {proxy.concept}", proxy.unit, proxy.page or None
    return None


def _hybrid_capital(
    fy: str, resolved: dict[tuple[str, str], TaggedFact]
) -> tuple[Decimal, float, str, str | None, int | None] | None:
    """Hybrid/perpetual capital inside total equity (same balance-sheet
    context), summed. Treated as debt by app/services/metrics.py."""
    parts = _other_equity_facts(fy, resolved)
    if not parts:
        return None
    total = sum((_positive(f) for f in parts), Decimal(0))
    confidence = IXBRL_CONFIDENCE if len(parts) == 1 else DERIVED_CONFIDENCE
    source = " + ".join(f.concept for f in parts)
    return total, confidence, source if len(parts) == 1 else f"derived: {source}", parts[0].unit, parts[0].page or None


def _owner_view_outflow(
    metric: str, fy: str, resolved: dict[tuple[str, str], TaggedFact]
) -> tuple[Decimal, float, str, str | None, int | None] | None:
    standard = next(
        (resolved[(c, fy)] for c in _OWNER_VIEW_STANDARD[metric] if (c, fy) in resolved), None
    )
    if standard is not None:
        return _positive(standard), IXBRL_CONFIDENCE, standard.concept, standard.unit, standard.page or None
    pattern = _OWNER_VIEW_EXTENSION[metric]
    parts = sorted(
        (
            fact
            for (concept, year), fact in resolved.items()
            if year == fy
            and not concept.startswith("ifrs-full:")
            and pattern.search(concept.split(":", 1)[-1])
            and not re.search(r"(Proceeds|Repayment|Redemption|Issue)", concept.split(":", 1)[-1])
            and (
                metric == "hybrid_distributions"
                or not _OTHER_EQUITY_NAME.search(concept.split(":", 1)[-1])
            )
            and fact.value != 0
        ),
        key=lambda f: f.concept,
    )
    if not parts or len({p.unit for p in parts}) != 1:
        return None
    total = sum((_positive(p) for p in parts), Decimal(0))
    source = " + ".join(p.concept for p in parts)
    return total, DERIVED_CONFIDENCE, f"derived: {source}", parts[0].unit, parts[0].page or None


def _decimals_tolerance(facts: list[TaggedFact]) -> Decimal:
    """Rounding slack for an identity check: half a unit of the least
    precise term's @decimals, per term (0 when every term is exact)."""
    slack = Decimal(0)
    for fact in facts:
        try:
            decimals = int(fact.decimals) if fact.decimals not in (None, "INF") else None
        except ValueError:
            decimals = None
        if decimals is not None:
            slack += Decimal(10) ** (-decimals) / 2
    return slack


def _integrity_checks(
    resolved: dict[tuple[str, str], TaggedFact], years: list[str]
) -> dict[str, object]:
    passed = 0
    failed: list[str] = []
    for fy in years:
        for label, lhs_concept, terms in _INTEGRITY_CHECKS:
            lhs = resolved.get((lhs_concept, fy))
            rhs = [(resolved.get((c, fy)), sign) for c, sign in terms]
            if lhs is None or any(f is None for f, _ in rhs):
                continue
            total = sum((f.value * sign for f, sign in rhs), Decimal(0))
            used = [lhs, *(f for f, _ in rhs)]
            if abs(lhs.value - total) <= _decimals_tolerance(used):
                passed += 1
            else:
                failed.append(f"{fy} {label}: {_fmt(lhs.value)} vs {_fmt(total)}")
    return {"passed": passed, "failed": failed}


def _other_equity_facts(fy: str, resolved: dict[tuple[str, str], TaggedFact]) -> list[TaggedFact]:
    equity = resolved.get(("ifrs-full:Equity", fy))
    if equity is None:
        return []
    found: list[TaggedFact] = []
    for (concept, year), fact in sorted(resolved.items(), key=lambda item: item[0]):
        # Same balance-sheet context as total equity (an instant at the
        # year end, no dimensions) — never a duration fact like a coupon.
        if year != fy or fact.value == 0 or fact.context_id != equity.context_id:
            continue
        local = concept.split(":", 1)[-1]
        is_other_equity = concept in _OTHER_EQUITY_CONCEPTS or (
            not concept.startswith("ifrs-full:")
            and _OTHER_EQUITY_NAME.search(local)
            and "Dividend" not in local
            and "Paid" not in local
            and "Proceeds" not in local
        )
        if is_other_equity and fact.unit == equity.unit:
            found.append(fact)
    return found


def _other_equity_instruments(
    resolved: dict[tuple[str, str], TaggedFact], years: list[str]
) -> list[str]:
    notes: list[str] = []
    for fy in years:
        equity = resolved.get(("ifrs-full:Equity", fy))
        for fact in _other_equity_facts(fy, resolved):
            notes.append(
                f"{fy}: total equity {_fmt(equity.value)} {equity.unit} includes "
                f"{fact.concept} {_fmt(fact.value)} — equity attributable to ordinary "
                f"shareholders is {_fmt(equity.value - fact.value)}"
            )
    return notes


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
    fact_sources: dict[str, str] = {}
    for metric in (*CONCEPT_MAP, "ebitda", *OWNER_VIEW_METRICS):
        for fy in years:
            picked = _resolve_metric(metric, fy, resolved)
            if picked is None:
                continue
            value, confidence, source, unit_raw, page = picked
            if metric == "shares_outstanding":
                unit, currency = "shares", None
            elif metric in PER_SHARE_METRICS:
                # "USD/shares": the per-share unit must name a currency.
                if not unit_raw or not re.fullmatch(r"[A-Z]{3}/shares", unit_raw):
                    continue
                unit, currency = unit_raw, unit_raw.split("/", 1)[0]
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
            fact_sources[f"{fy} {metric}"] = source

    integrity = _integrity_checks(resolved, years)
    other_equity = _other_equity_instruments(resolved, years)

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
            "fact_sources": fact_sources,
            "integrity_checks": integrity,
        }
        if integrity["failed"]:
            flags.append("integrity_check_failed")
        if other_equity:
            flags.append("equity_includes_hybrid_capital")
            details["equity_includes_hybrid_capital"] = other_equity
    if conflicts:
        flags.append("fact_conflicts")
        details["fact_conflicts"] = conflicts[:20]
    if not pages or not any(p.text.strip() for p in pages):
        flags.append("no_pages_extracted")
    return ExtractionResult(pages=pages, facts=facts_out, quality_flags=flags, details=details)
