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
from dataclasses import dataclass, field
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
    # Profit walk: a sold business is in the reported profit once, so the
    # measures an owner values the company on must leave it out.
    # Signed as tagged: positive = impairment loss, negative = reversal.
    "impairment_loss": ("ifrs-full:ImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",),
    "profit_continuing_operations": (
        "us-gaap:IncomeLossFromContinuingOperations",
        "ifrs-full:ProfitLossFromContinuingOperations",
    ),
    "profit_discontinued_operations": (
        "us-gaap:IncomeLossFromDiscontinuedOperationsNetOfTax",
        "ifrs-full:ProfitLossFromDiscontinuedOperations",
    ),
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
    # D&A for filers with no "DepreciationAndAmortisationExpense" line
    # (found 2026-10-04 in the real FY2025 filings): the cash-flow add-back
    # (Subsea 7), then depreciation alone (Aker BP tags DepreciationExpense;
    # any amortisation is then not included, hence "proxy").
    "depreciation_and_amortization": (
        "ifrs-full:AdjustmentsForDepreciationAndAmortisationExpense",
        "ifrs-full:DepreciationExpense",
        "ifrs-full:AdjustmentsForDepreciationExpense",
    ),
    # Subsea 7 tags its "net cash flows from operating activities" total with
    # CashFlowsFromUsedInOperations and no "...OperatingActivities" concept
    # (checked 2026-10-05: 1 470.7 = the printed total, AFTER tax paid). A
    # filer that really tags cash generated from operations (before tax and
    # interest) with it would be overstated, hence "proxy" — and the cash
    # tie below (OCF + investing + financing = change in cash) catches it.
    "operating_cash_flow": ("ifrs-full:CashFlowsFromUsedInOperations",),
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
# Company-extension capex lines (Subsea 7: subsea7sa:PurchasesOfPropertyPlantAnd
# EquipmentAndIntangibleAssets..., Orkla: ORK:PurchaseOfPropertyPlantAnd
# EquipmentAndPurchaseOfIntangibleAssets...). A name pattern, like the
# owner's-view lines below, because the prefix and exact wording are the
# company's own.
_CAPEX_EXTENSION = re.compile(
    r"^Purchases?Of\w*(PropertyPlantAndEquipment|IntangibleAssets)\w*ClassifiedAsInvestingActivities$"
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
        r"|^(?=\w*Lease)(?=\w*Interest)\w*ClassifiedAsFinancingActivities$"
    ),
    # Principal of lease liabilities paid in the financing section. The verb
    # varies by company (Payments / Repayments / Principal ...): Subsea 7's
    # lease line was missed by the old "PaymentsOf..." only pattern. Interest
    # on leases has its own pattern below and is excluded here.
    "lease_payments_financing": re.compile(
        r"^(?!\w*Interest)(Payments?|Repayments?|Principal)\w*Lease\w*ClassifiedAsFinancingActivities$"
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
# A company-extension financing line for the interest part of lease payments.
_LEASE_INTEREST = re.compile(r"^(?=\w*Lease)(?=\w*Interest)\w*ClassifiedAsFinancingActivities$")

# Names that are not an outflow to the owner even though the pattern above
# matches (issues, redemptions, borrowings repaid). "Repayment" is allowed for
# leases: that IS how many companies name the principal of a lease payment.
_OWNER_VIEW_EXCLUDE: dict[str, str] = {
    "interest_paid_financing": r"(Proceeds|Repayment|Redemption|Issue)",
    "lease_payments_financing": r"(Proceeds|Redemption|Issue|Borrowing|Bond)",
    "decommissioning_payments": r"(Proceeds|Repayment|Redemption|Issue)",
    "hybrid_distributions": r"(Proceeds|Repayment|Redemption|Issue)",
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

# Inputs every annual report is expected to give (G4 completeness manifest).
# Each entry is the set of metrics any one of which satisfies it. Optional
# inputs (hybrid capital, decommissioning, lease lines, minorities ...) are
# left out on purpose: absent for most companies, so "missing" would be noise.
CORE_INPUTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("revenue", ("revenue",)),
    ("operating profit (EBIT)", ("ebit", "operating_income")),
    ("net income", ("net_income",)),
    ("depreciation and amortisation", ("depreciation_and_amortization",)),
    ("EBITDA", ("ebitda",)),
    ("cost of sales or materials", ("cost_of_goods_sold", "raw_materials_used")),
    ("profit before tax", ("income_before_tax",)),
    ("income tax", ("income_tax_expense",)),
    ("total assets", ("total_assets",)),
    ("total equity", ("total_equity",)),
    ("total liabilities", ("total_liabilities",)),
    ("total debt", ("total_debt",)),
    ("cash", ("cash_and_equivalents",)),
    ("operating cash flow", ("operating_cash_flow",)),
    ("capital expenditure", ("capital_expenditures",)),
    ("interest expense", ("interest_expense",)),
    ("earnings per share", ("eps_basic",)),
)
# A bank has no debt or EBITDA in the industrial sense: not missing, not applicable.
_BANK_NOT_APPLICABLE = frozenset({"total debt", "EBITDA", "cost of sales or materials", "capital expenditure", "interest expense"})


def coverage_manifest(
    years: list[str], extracted: set[tuple[str, str]], reporting_bank: bool
) -> dict[str, dict[str, list[str]]]:
    """Per fiscal year: which expected inputs were extracted, which are not
    applicable (a bank), and which are MISSING. A missing input is reported,
    never silently dropped — the person sees what the filing did not give."""
    manifest: dict[str, dict[str, list[str]]] = {}
    for fy in years:
        have, missing, na = [], [], []
        for label, metrics in CORE_INPUTS:
            if any((m, fy) in extracted for m in metrics):
                have.append(label)
            elif reporting_bank and label in _BANK_NOT_APPLICABLE:
                na.append(label)
            else:
                missing.append(label)
        manifest[fy] = {"extracted": have, "not_applicable": na, "missing": missing}
    return manifest


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
    # True for a balance-sheet (instant) fact. Filled in by
    # map_tagged_facts from the fact's context; both importers share it.
    instant: bool = False


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


# UTF-8 text that was decoded as Latin-1/Windows-1252 shows "Ã¸", "Ã¥", "â€™"
# for "ø", "å", "’". Norwegian company names and notes make this the most
# likely silent corruption of the stored text (Salmon Evolution, 2026-10-05).
_MOJIBAKE = re.compile("Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|â€")
MOJIBAKE_THRESHOLD = 3


def looks_mojibake(texts: list[str]) -> bool:
    """True when the extracted text carries the typical double-encoding
    sequences at least MOJIBAKE_THRESHOLD times — a corrupt copy, not a quirk."""
    return sum(len(_MOJIBAKE.findall(text)) for text in texts) >= MOJIBAKE_THRESHOLD


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


# ---------------------------------------------------------------------------
# Total debt: structure first, names second (2026-10-05)
#
# ESEF only requires the primary statements to be tagged, so debt has to be
# read off the face of the balance sheet, where each filer picks its own
# concept: borrowings (Subsea 7, Telenor, Mowi, Vår Energi), bonds (Aker BP),
# or a company line that also contains leases (Orkla). Instead of a closed
# list, the balance-sheet lines are classified by what they ARE, and the
# result is checked against the filing's own subtotals.
# ---------------------------------------------------------------------------

# Lines that are interest-bearing borrowing, current or non-current.
_DEBT_INCLUDE = re.compile(
    r"(Borrowing|Bonds?(Issued|Payable|Loan)?\b|Bonds?[A-Z]|Debentures?|CommercialPaper|NotesIssued|"
    r"NotesAndDebentures|LoansReceived|LoansPayable|ConvertibleLoan|ConvertibleBond|"
    r"InterestBearing(Debt|Liabilit|Loan|Borrowing)|DebtInstrumentsIssued)",
    re.IGNORECASE,
)
# What looks like debt but is not: leases (kept separate), derivatives,
# deposits, assets held, costs and cash flows, off-balance-sheet items.
_DEBT_EXCLUDE = re.compile(
    r"(Lease|Derivative|Deposit|Receivable|Held|Hedg|Guarantee|Undrawn|Facilit|Collateral|Pledge|"
    r"Fair|Accrued|Provision|Equity|Reserve|Covenant|Investment|Intangible|Interest(Paid|Expense|Income)|"
    r"Cost|Gain|Loss|Proceeds|Repayment|Adjustments|IncreaseDecrease|Payments)",
    re.IGNORECASE,
)
# A company line that bundles borrowings with lease liabilities (Orkla).
_DEBT_WITH_LEASES = re.compile(
    r"(Borrowings?\w*And\w*Lease|Lease\w*And\w*Borrowings?|DebtAndLease|InterestBearingDebtInclLease)",
    re.IGNORECASE,
)
# When a filer tags both a total and its parts, take the total only.
_DEBT_TOTAL_FORMS = frozenset(
    {"Borrowings", "BondsIssued", "LoansReceived", "NotesAndDebenturesIssued", "DebtInstrumentsIssued"}
)
# Concepts the earlier fixed list already accepted: a sum of these keeps the
# confidence it always had even if the balance sheet cannot be reconciled.
_DEBT_STANDARD_PARTS = frozenset(c.split(":", 1)[-1] for c in _DEBT_COMPONENTS)
DEBT_UNRECONCILED_CONFIDENCE = 0.85
LEASES_INCLUDED_NOTE = (
    "includes lease liabilities — this filing's balance sheet does not split them out"
)

# Boundaries when walking back from a liabilities subtotal to its lines.
_LIABILITY_BOUNDARY = frozenset(
    {
        "ifrs-full:Equity",
        "ifrs-full:EquityAttributableToOwnersOfParent",
        "ifrs-full:NoncontrollingInterests",
        "ifrs-full:NoncurrentLiabilities",
        "ifrs-full:CurrentLiabilities",
        "ifrs-full:Liabilities",
        "ifrs-full:EquityAndLiabilities",
        "ifrs-full:Assets",
    }
)


def _local_name(concept: str) -> str:
    return concept.split(":", 1)[-1]


def _balance_sheet_facts(fy: str, resolved: dict[tuple[str, str], TaggedFact]) -> list[TaggedFact]:
    """The year-end balance-sheet facts, in document order (dicts keep the
    order the facts were read in)."""
    return [fact for (_, year), fact in resolved.items() if year == fy and fact.instant]


def is_bank_balance_sheet(resolved: dict[tuple[str, str], TaggedFact]) -> bool:
    """Deposits from customers AND loans to customers on the face of the
    balance sheet: a bank's funding model, where deposits are the business
    and 'net debt' or 'debt / equity' mean nothing."""
    names = {_local_name(c) for (c, _), f in resolved.items() if f.instant}
    return any(n.startswith("DepositsFromCustomers") for n in names) and any(
        n.startswith("LoansAndAdvancesToCustomers") for n in names
    )


def _liability_reconciliation(fy: str, resolved: dict[tuple[str, str], TaggedFact]) -> dict[str, str]:
    """Does the filing's own liabilities side add up? For each of
    NoncurrentLiabilities and CurrentLiabilities, the lines printed directly
    above it (same balance-sheet context) must sum to it within the rounding
    the filing declares. 'ok' / 'mismatch' / 'unchecked' per side."""
    sequence = _balance_sheet_facts(fy, resolved)
    verdict: dict[str, str] = {}
    for side, subtotal_concept in (
        ("noncurrent", "ifrs-full:NoncurrentLiabilities"),
        ("current", "ifrs-full:CurrentLiabilities"),
    ):
        index = next((i for i, f in enumerate(sequence) if f.concept == subtotal_concept), None)
        if index is None:
            verdict[side] = "unchecked"
            continue
        subtotal = sequence[index]
        kids: list[TaggedFact] = []
        for fact in reversed(sequence[:index]):
            if fact.concept in _LIABILITY_BOUNDARY:
                break
            if fact.context_id == subtotal.context_id:
                kids.append(fact)
        if not kids:
            verdict[side] = "unchecked"
            continue
        total = sum((f.value for f in kids), Decimal(0))
        tolerance = max(_decimals_tolerance([subtotal, *kids]), abs(subtotal.value) * Decimal("0.0005"))
        verdict[side] = "ok" if abs(total - subtotal.value) <= tolerance else "mismatch"
    return verdict


def _resolve_total_debt(
    fy: str, resolved: dict[tuple[str, str], TaggedFact]
) -> tuple[Decimal, float, str, str | None, int | None] | None:
    """Interest-bearing debt from the balance sheet, leases excluded (they
    have their own metric). None for a bank. A line that bundles borrowings
    with leases is accepted with a plain note, since the filing gives no way
    to split it."""
    if is_bank_balance_sheet(resolved):
        return None
    liabilities = resolved.get(("ifrs-full:Liabilities", fy))

    def plausible(total: Decimal) -> bool:
        return liabilities is None or total <= liabilities.value * Decimal("1.0001")

    candidates = [
        f
        for f in _balance_sheet_facts(fy, resolved)
        if _DEBT_INCLUDE.search(_local_name(f.concept))
        and not _DEBT_EXCLUDE.search(_local_name(f.concept))
        and not _DEBT_WITH_LEASES.search(_local_name(f.concept))
        and f.value >= 0
    ]
    totals = [f for f in candidates if _local_name(f.concept) in _DEBT_TOTAL_FORMS]
    parts = totals or candidates
    if parts and len({p.unit for p in parts}) == 1:
        total = sum((p.value for p in parts), Decimal(0))
        if not plausible(total):
            return None
        recon = _liability_reconciliation(fy, resolved)
        all_standard = all(_local_name(p.concept) in _DEBT_STANDARD_PARTS for p in parts)
        reconciled = "ok" in recon.values() and "mismatch" not in recon.values()
        confidence = DERIVED_CONFIDENCE if (reconciled or all_standard) else DEBT_UNRECONCILED_CONFIDENCE
        source = " + ".join(p.concept for p in parts)
        if not reconciled and not all_standard:
            source += " (balance sheet could not be reconciled to the filing's own subtotals)"
        return total, confidence, source, parts[0].unit, parts[0].page or None

    bundled = [
        f
        for f in _balance_sheet_facts(fy, resolved)
        if _DEBT_WITH_LEASES.search(_local_name(f.concept)) and f.value >= 0
    ]
    if bundled and len({p.unit for p in bundled}) == 1:
        total = sum((p.value for p in bundled), Decimal(0))
        if not plausible(total):
            return None
        return (
            total,
            DEBT_UNRECONCILED_CONFIDENCE,
            "derived: " + " + ".join(p.concept for p in bundled) + f" ({LEASES_INCLUDED_NOTE})",
            bundled[0].unit,
            bundled[0].page or None,
        )
    return None


# Closest-tag search for a core metric the extractor could not fill.
_CANDIDATE_PATTERNS: dict[str, tuple[re.Pattern[str], bool]] = {
    # (name pattern, balance-sheet instants only?)
    "total_debt": (re.compile(r"Borrow|Bond|Loan|Debt|Debenture|Notes|Lease|InterestBearing", re.IGNORECASE), True),
    "depreciation_and_amortization": (re.compile(r"Deprec|Amorti", re.IGNORECASE), False),
    "capital_expenditures": (re.compile(r"Purchase|Acquisition|CapitalExpend|PropertyPlant", re.IGNORECASE), False),
    "cash_and_equivalents": (re.compile(r"Cash", re.IGNORECASE), True),
}
_CANDIDATES_PER_METRIC = 8


def _unmapped_candidates(
    years: list[str], resolved: dict[tuple[str, str], TaggedFact], extracted: set[tuple[str, str]]
) -> dict[str, dict[str, list[dict[str, str]]]]:
    """For the latest year only: metrics with no extracted value, and the
    tagged concepts whose names look closest. Nothing is guessed or stored
    as a fact; this is the pointer to what a person (or the next mapping
    change) should look at."""
    if not years:
        return {}
    fy = years[0]
    bank = is_bank_balance_sheet(resolved)
    found: dict[str, list[dict[str, str]]] = {}
    for metric, (pattern, instant_only) in _CANDIDATE_PATTERNS.items():
        if (metric, fy) in extracted or (bank and metric == "total_debt"):
            continue
        rows = [
            {"concept": f.concept, "value": _fmt(f.value), "unit": f.unit or ""}
            for (concept, year), f in resolved.items()
            if year == fy
            and pattern.search(_local_name(concept))
            and (f.instant or not instant_only)
            and f.value != 0
        ]
        if rows:
            found[metric] = rows[:_CANDIDATES_PER_METRIC]
    return {fy: found} if found else {}


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
        # Only reached when no standard capex concept is tagged, so a filer
        # that already extracts correctly is never changed by this.
        extension = _capex_extension(fy, resolved)
        if extension is not None:
            return extension[:3] + (extension[4], extension[5])
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

    if metric == "total_equity":
        return _owners_equity(fy, resolved)

    if metric in _OWNER_VIEW_STANDARD:
        return _owner_view_outflow(metric, fy, resolved)

    if metric == "ebitda":
        operating = get(_OPERATING_PROFIT)
        if operating is None:
            return None
        combined_da = get(_DA_WITH_IMPAIRMENT)
        pure_da = get(_PURE_DA)
        proxy_da = None
        if combined_da is not None:
            addbacks = [combined_da]
            value = operating.value + _positive(combined_da)
        elif pure_da is not None or (
            pure_da := next((get(c) for c in _PROXY_CONCEPTS["depreciation_and_amortization"] if get(c)), None)
        ) is not None:
            proxy_da = pure_da if get(_PURE_DA) is None else None
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
        if proxy_da is not None:
            # D&A itself is a stand-in (cash-flow add-back, depreciation alone).
            return (value, PROXY_CONFIDENCE, "proxy: " + source.removeprefix("derived: "), operating.unit, operating.page or None)
        return (value, DERIVED_CONFIDENCE, source, operating.unit, operating.page or None)

    if metric == "total_debt":
        # A bank's funding is deposits, not debt: nothing is extracted.
        if is_bank_balance_sheet(resolved):
            return None
        # A lone non-current borrowings line is only half the debt when a
        # current line exists, so it is left to the classifier below, which
        # sums both sides.
        concepts = tuple(
            c for c in CONCEPT_MAP.get(metric, ()) if c != "ifrs-full:NoncurrentPortionOfNoncurrentBorrowings"
        )
        direct = next((get(c) for c in concepts if get(c) is not None), None)
        if direct is not None:
            return direct.value, IXBRL_CONFIDENCE, direct.concept, direct.unit, direct.page or None
        return _resolve_total_debt(fy, resolved)

    concepts = CONCEPT_MAP.get(metric, ())
    chosen = next((get(c) for c in concepts if get(c) is not None), None)
    if chosen is not None:
        if metric == "shares_outstanding" and "WeightedAverage" in chosen.concept:
            # Not the year-end count: labelled so nothing mistakes it for one.
            return chosen.value, PROXY_CONFIDENCE, f"proxy: {chosen.concept}", chosen.unit, chosen.page or None
        return chosen.value, IXBRL_CONFIDENCE, chosen.concept, chosen.unit, chosen.page or None

    if metric == "income_before_tax":
        # Orkla tags profit before tax only as a company-extension line.
        ext = _tagged_by_local_name(fy, resolved, ("ProfitLossBeforeTaxContinuingOperations",))
        if ext is not None:
            return ext.value, DERIVED_CONFIDENCE, ext.concept, ext.unit, ext.page or None

    if metric == "total_liabilities":
        # Not tagged (Orkla): the balance sheet identity gives it exactly.
        assets, equity = get("ifrs-full:Assets"), get("ifrs-full:Equity")
        if assets is not None and equity is not None and assets.unit == equity.unit:
            return (
                assets.value - equity.value,
                DERIVED_CONFIDENCE,
                "derived: ifrs-full:Assets - ifrs-full:Equity",
                assets.unit,
                assets.page or None,
            )

    if metric == "cost_of_goods_sold":
        # No cost-of-sales line (Subsea 7 tags operating expense and a gross
        # profit): revenue less the tagged gross profit IS the cost of sales.
        gross = get("ifrs-full:GrossProfit") or _tagged_by_local_name(
            fy, resolved, (), prefix="GrossProfit"
        )
        revenue = _resolve_metric("revenue", fy, resolved)
        if gross is not None and revenue is not None and revenue[3] == gross.unit and revenue[0] >= gross.value:
            return (
                revenue[0] - gross.value,
                DERIVED_CONFIDENCE,
                f"derived: revenue - {gross.concept}",
                gross.unit,
                gross.page or None,
            )

    if metric == "profit_continuing_operations":
        # No continuing-operations line tagged: total profit less the
        # discontinued result is, by definition, the continuing profit.
        total = get("ifrs-full:ProfitLoss")
        discontinued = next((get(c) for c in CONCEPT_MAP["profit_discontinued_operations"] if get(c)), None)
        if total is not None and discontinued is not None and total.unit == discontinued.unit:
            return (
                total.value - discontinued.value,
                DERIVED_CONFIDENCE,
                f"derived: {total.concept} - {discontinued.concept}",
                total.unit,
                total.page or None,
            )
        return None

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

    proxy = next((get(c) for c in _PROXY_CONCEPTS.get(metric, ()) if get(c) is not None), None)
    if proxy is not None:
        return proxy.value, PROXY_CONFIDENCE, f"proxy: {proxy.concept}", proxy.unit, proxy.page or None
    return None


def _tagged_by_local_name(
    fy: str, resolved: dict[tuple[str, str], TaggedFact], names: tuple[str, ...], *, prefix: str = ""
) -> TaggedFact | None:
    """A company-extension (non ifrs-full) fact by its local name, or by a
    name prefix; None when absent or when two different values compete."""
    found = [
        fact
        for (concept, year), fact in sorted(resolved.items())
        if year == fy
        and not concept.startswith("ifrs-full:")
        and (concept.split(":", 1)[-1] in names or (prefix and concept.split(":", 1)[-1].startswith(prefix)))
    ]
    return found[0] if found and len({f.value for f in found}) == 1 else None


def _capex_extension(
    fy: str, resolved: dict[tuple[str, str], TaggedFact]
) -> tuple[Decimal, float, str, str, str | None, int | None] | None:
    """Capex from company-extension cash-flow lines. (value, confidence,
    source, kind, unit, page) or None. kind is "combined" when one line buys
    both PP&E and intangibles (taken as-is, never added to its own parts),
    else "parts". Ambiguous (several combined lines) is not resolved."""
    found = sorted(
        (
            fact
            for (concept, year), fact in resolved.items()
            if year == fy
            and not concept.startswith("ifrs-full:")
            and _CAPEX_EXTENSION.match(concept.split(":", 1)[-1])
            and fact.value != 0
        ),
        key=lambda f: f.concept,
    )
    if not found or len({f.unit for f in found}) != 1:
        return None

    def both(fact: TaggedFact) -> bool:
        name = fact.concept.split(":", 1)[-1]
        return "PropertyPlantAndEquipment" in name and "IntangibleAssets" in name

    combined = [f for f in found if both(f)]
    if len(combined) == 1:
        only = combined[0]
        return _positive(only), IXBRL_CONFIDENCE, only.concept, "combined", only.unit, only.page or None
    if combined:
        return None
    total = sum((_positive(f) for f in found), Decimal(0))
    source = found[0].concept if len(found) == 1 else "derived: " + " + ".join(f.concept for f in found)
    confidence = IXBRL_CONFIDENCE if len(found) == 1 else DERIVED_CONFIDENCE
    return total, confidence, source, "parts", found[0].unit, found[0].page or None


# Equity concepts that include the minority (non-controlling) holders, and
# the concepts that hold the minority's share. app/services/metrics.py treats
# total_equity as the OWNERS' equity and adds minority interests on top for
# invested capital and EV, so a figure that already includes them would be
# counted twice (Orkla 2025: 52 147 including 3 483 of minorities).
_EQUITY_INCLUDING_MINORITIES = (
    "us-gaap:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    "ifrs-full:Equity",
)
_MINORITY_CONCEPTS = ("us-gaap:MinorityInterest", "ifrs-full:NoncontrollingInterests")


def _owners_equity(
    fy: str, resolved: dict[tuple[str, str], TaggedFact]
) -> tuple[Decimal, float, str, str | None, int | None] | None:
    """Equity attributable to the owners of the parent. Taken from the
    owners' concept when tagged; when only total equity is tagged, the
    minorities' share is subtracted (derived, labelled) instead of silently
    returning a figure that includes it."""
    chosen = next(
        (resolved[(c, fy)] for c in CONCEPT_MAP["total_equity"] if (c, fy) in resolved), None
    )
    if chosen is None:
        return None
    if chosen.concept in _EQUITY_INCLUDING_MINORITIES:
        minority = next(
            (
                resolved[(c, fy)]
                for c in _MINORITY_CONCEPTS
                if (c, fy) in resolved
                and resolved[(c, fy)].unit == chosen.unit
                and resolved[(c, fy)].value != 0
            ),
            None,
        )
        if minority is not None:
            return (
                chosen.value - minority.value,
                DERIVED_CONFIDENCE,
                f"derived: {chosen.concept} - {minority.concept}",
                chosen.unit,
                chosen.page or None,
            )
    return chosen.value, IXBRL_CONFIDENCE, chosen.concept, chosen.unit, chosen.page or None


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
        value, source, unit, page = _positive(standard), standard.concept, standard.unit, standard.page or None
        confidence = IXBRL_CONFIDENCE
        if metric == "interest_paid_financing":
            # Interest on leases is its own financing line next to the standard
            # "interest paid" one (Subsea 7: 66.3 + 25.1): both leave the company.
            extra = [
                f
                for (concept, year), f in sorted(resolved.items())
                if year == fy
                and not concept.startswith("ifrs-full:")
                and _LEASE_INTEREST.search(concept.split(":", 1)[-1])
                and f.unit == standard.unit
                and f.value != 0
            ]
            if extra:
                value += sum((_positive(f) for f in extra), Decimal(0))
                source = "derived: " + " + ".join([standard.concept, *(f.concept for f in extra)])
                confidence = DERIVED_CONFIDENCE
        return value, confidence, source, unit, page
    pattern = _OWNER_VIEW_EXTENSION[metric]
    parts = sorted(
        (
            fact
            for (concept, year), fact in resolved.items()
            if year == fy
            and not concept.startswith("ifrs-full:")
            and pattern.search(concept.split(":", 1)[-1])
            and not re.search(_OWNER_VIEW_EXCLUDE[metric], concept.split(":", 1)[-1])
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
        outcome = _cash_tie(fy, resolved)
        if outcome is True:
            passed += 1
        elif outcome:
            failed.append(outcome)
    return {"passed": passed, "failed": failed}


_CASH_FLOW_TOTALS = (
    ("operating", ("ifrs-full:CashFlowsFromUsedInOperatingActivities", "ifrs-full:CashFlowsFromUsedInOperations")),
    ("investing", ("ifrs-full:CashFlowsFromUsedInInvestingActivities",)),
    ("financing", ("ifrs-full:CashFlowsFromUsedInFinancingActivities",)),
)
_FX_ON_CASH = "ifrs-full:EffectOfExchangeRateChangesOnCashAndCashEquivalents"
_CASH = "ifrs-full:CashAndCashEquivalents"
_CASH_CHANGE_BEFORE_FX = "ifrs-full:IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges"


def _cash_tie(fy: str, resolved: dict[tuple[str, str], TaggedFact]) -> bool | str | None:
    """The cash-flow statement must add up. True when it does, a message when
    it does not, None when an input is not tagged.

    1. Operating + investing + financing = the statement's own "increase
       (decrease) in cash before currency effect", when that line is tagged:
       exact, no balance sheet involved. A failure means a total is
       mis-tagged (cash generated from operations used as the operating
       total, say).
    2. Otherwise the three totals (+ currency effect) are compared with the
       change in balance-sheet cash. Companies define cash a little
       differently on the two statements (overdrafts, restricted cash:
       Subsea 7 differs by under 1%), so only a gap above 2% of the change
       is reported."""
    totals: list[TaggedFact] = []
    for _label, concepts in _CASH_FLOW_TOTALS:
        found = next((resolved[(c, fy)] for c in concepts if (c, fy) in resolved), None)
        if found is None:
            return None
        totals.append(found)
    flows = sum((f.value for f in totals), Decimal(0))
    stated = resolved.get((_CASH_CHANGE_BEFORE_FX, fy))
    if stated is not None and stated.unit == totals[0].unit:
        used = [*totals, stated]
        if abs(flows - stated.value) <= _decimals_tolerance(used) * 2:
            return True
        return (
            f"{fy} cash flow adds up: operating + investing + financing = {_fmt(flows)} vs the "
            f"statement's own change in cash {_fmt(stated.value)}"
        )
    try:
        prior = f"FY{int(fy.removeprefix('FY')) - 1}"
    except ValueError:
        return None
    cash_end, cash_start = resolved.get((_CASH, fy)), resolved.get((_CASH, prior))
    if cash_end is None or cash_start is None:
        return None
    fx = resolved.get((_FX_ON_CASH, fy))
    used = [*totals, cash_end, cash_start, *([fx] if fx else [])]
    if len({f.unit for f in used}) != 1:
        return None
    flows += fx.value if fx else Decimal(0)
    change = cash_end.value - cash_start.value
    if abs(flows - change) <= _decimals_tolerance(used) * 2 + abs(change) * Decimal("0.02"):
        return True
    return (
        f"{fy} cash flow ties to the change in cash: operating + investing + financing"
        f"{' + currency effect' if fx else ''} = {_fmt(flows)} vs balance-sheet change {_fmt(change)}"
    )


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
        minority = next(
            (
                resolved[(c, fy)].value
                for c in _MINORITY_CONCEPTS
                if (c, fy) in resolved and resolved[(c, fy)].unit == equity.unit
            ),
            Decimal(0),
        )
        for fact in _other_equity_facts(fy, resolved):
            notes.append(
                f"{fy}: total equity {_fmt(equity.value)} {equity.unit} includes "
                f"{fact.concept} {_fmt(fact.value)} — equity attributable to ordinary "
                f"shareholders is {_fmt(equity.value - minority - fact.value)}"
            )
    return notes


@dataclass
class MappedFacts:
    """Canonical metrics mapped from a filing's tagged facts — the result is
    the same whether the facts came from the .xhtml (ix: tags) or from the
    filing's xBRL-JSON (app/services/filings/esef_index.py)."""

    facts: list[ExtractedFact]
    mapping_lines: list[str]
    fact_sources: dict[str, str]
    years: list[str]
    integrity: dict[str, object]
    other_equity: list[str]
    conflicts: list[str]
    # Plain-language notes about how a number was built (e.g. Orkla's debt
    # line that also contains lease liabilities); shown next to the figure.
    notes: list[str] = field(default_factory=list)
    # True when the balance sheet is a bank's (deposits from customers and
    # loans to customers on the face): debt-based measures do not apply.
    reporting_bank: bool = False
    # fiscal year -> metric -> closest tagged concepts, for a core metric
    # that could not be extracted. Makes every gap self-diagnosing.
    unmapped_candidates: dict[str, dict[str, list[dict[str, str]]]] = field(default_factory=dict)
    # fiscal year -> {"extracted": [...], "not_applicable": [...], "missing": [...]}
    coverage: dict[str, dict[str, list[str]]] = field(default_factory=dict)
    # Tag review (PR 1): gaps with ranked candidate tags and the largest
    # tagged-but-unused numbers, for the latest year. Read-only pointer.
    tag_review: dict[str, object] = field(default_factory=dict)


def map_tagged_facts(tagged: list[TaggedFact], contexts: dict[str, _Context]) -> MappedFacts:
    """Group totals on annual periods -> canonical metrics (CLAUDE.md Rule 1:
    deterministic, no inference). Shared by the upload parser and the
    ESEF-index history import."""
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
        fact.instant = ctx.is_instant
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
    notes = [
        f"{fy}: total debt {LEASES_INCLUDED_NOTE}"
        for fy in years
        if LEASES_INCLUDED_NOTE in fact_sources.get(f"{fy} total_debt", "")
    ]
    extracted = {(f.metric, f.period) for f in facts_out}
    # Imported here: tag_review reads this module's helpers (no import cycle).
    from app.services.documents.extraction.tag_review import build_tag_review

    return MappedFacts(
        facts=facts_out,
        mapping_lines=mapping_lines,
        fact_sources=fact_sources,
        years=years,
        integrity=integrity,
        other_equity=other_equity,
        conflicts=conflicts,
        notes=notes,
        reporting_bank=is_bank_balance_sheet(resolved),
        unmapped_candidates=_unmapped_candidates(years, resolved, extracted),
        coverage=coverage_manifest(years, extracted, is_bank_balance_sheet(resolved)),
        tag_review=build_tag_review(
            years, resolved, extracted, fact_sources, is_bank_balance_sheet(resolved)
        ),
    )


_LEI = re.compile(r"^[A-Z0-9]{18}[0-9]{2}$")


def entity_lei(root) -> str | None:
    """The reporting entity's LEI from the filing's contexts (ESEF requires
    the ISO 17442 scheme), or None."""
    for identifier in root.iter(f"{{{XBRLI_NS}}}identifier"):
        value = (identifier.text or "").strip().upper()
        if _LEI.match(value):
            return value
    return None


_STYLE_OR_SCRIPT = re.compile(rb"(<(style|script)\b[^>]*>)(.*?)(</\2\s*>)", re.DOTALL | re.IGNORECASE)
_BARE_AMPERSAND = re.compile(rb"&(?!(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);)")


def _repair_xhtml(content: bytes) -> bytes:
    """Fixes the two things that make an otherwise valid ESEF .xhtml fail XML
    parsing, without touching any tagged value: a '<' or '&' inside embedded
    CSS/JS (Salmon Evolution 2025: a '<=' in a media query) and bare '&'."""

    def escape(match: re.Match[bytes]) -> bytes:
        body = match.group(3).replace(b"&", b"&amp;").replace(b"<", b"&lt;")
        return match.group(1) + body + match.group(4)

    repaired = _STYLE_OR_SCRIPT.sub(escape, content)
    return _BARE_AMPERSAND.sub(b"&amp;", repaired)


def parse_ixbrl(content: bytes):
    """Strict XML first (the spec). A file that is almost XML is repaired and
    retried, then read leniently as XML (namespaces and attribute case kept).
    Only a file with no inline-XBRL elements at all falls to the HTML parser
    (an old SEC .htm), where tags are matched by name."""
    from lxml import etree

    def parser(recover: bool):
        return etree.XMLParser(
            huge_tree=True, resolve_entities=False, no_network=True, load_dtd=False, recover=recover
        )

    try:
        return etree.fromstring(content, parser(False))
    except etree.XMLSyntaxError:
        pass
    repaired = _repair_xhtml(content)
    try:
        return etree.fromstring(repaired, parser(False))
    except etree.XMLSyntaxError:
        pass
    try:
        lenient = etree.fromstring(repaired, parser(True))
    except etree.XMLSyntaxError:
        lenient = None
    if lenient is not None and any(
        isinstance(el.tag, str) and _local(el.tag) == "nonFraction" for el in lenient.iter()
    ):
        return lenient
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

    mapped = map_tagged_facts(tagged, contexts)
    facts_out, mapping_lines, fact_sources = mapped.facts, mapped.mapping_lines, mapped.fact_sources
    years, integrity, other_equity, conflicts = mapped.years, mapped.integrity, mapped.other_equity, mapped.conflicts
    lei = entity_lei(root)

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
        if numeric_elements:
            # Tagged numbers exist but their contexts could not be read:
            # a broken file, not an untagged one. Say so.
            flags.append("ixbrl_tags_unreadable")
        else:
            flags.append("no_ixbrl_tags")  # plain HTML page: text only, no facts
    else:
        details["ixbrl"] = {
            "entity_lei": lei,
            "tagged_numbers": len(tagged),
            "fiscal_years": years,
            "facts_mapped": len(facts_out),
            "unreadable_numbers": unreadable,
            "fact_sources": fact_sources,
            "integrity_checks": integrity,
            "reporting_bank": mapped.reporting_bank,
            "notes": mapped.notes,
            "unmapped_candidates": mapped.unmapped_candidates,
            "coverage": mapped.coverage,
            "tag_review": mapped.tag_review,
        }
        if mapped.reporting_bank:
            flags.append("reporting_bank")
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
    if looks_mojibake(page_texts):
        flags.append("text_encoding_suspect")
    return ExtractionResult(pages=pages, facts=facts_out, quality_flags=flags, details=details)
