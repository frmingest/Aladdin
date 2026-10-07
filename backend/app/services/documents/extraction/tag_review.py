"""Tag review: what a filing tagged that the extractor did not use (PR 1).

After a filing is mapped, this answers two questions without anyone having to
open the .xhtml:

1. **Gaps.** For every expected input the extractor did not fill, which tagged
   concepts look closest, ranked, each with a trial check against the
   filing's own identities (cash tie, assets = equity + liabilities).
2. **Tagged but unused.** The largest monetary numbers on the face of the
   statements that no mapping reads (Orkla's discontinued profit would have
   shown up here).

Read-only and deterministic (CLAUDE.md Rule 1): nothing here is stored as a
financial fact and nothing is guessed into a metric. It is a pointer for a
person, and later (PR 2) for an accepted mapping rule. The result is plain
JSON kept in the document's quality flags.
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from app.services.documents.extraction import ixbrl as ix

TAG_REVIEW_VERSION = 1
CANDIDATES_PER_GAP = 6
UNUSED_LIMIT = 10
# A tagged number must be at least this share of revenue (or total assets
# when no revenue was read) to be listed as "tagged but unused".
UNUSED_MIN_SHARE = Decimal("0.02")

STANDARD_PREFIXES = frozenset({"ifrs-full", "us-gaap", "ifrs", "dei", "srt", "esef_cor"})

# (name pattern, kind, exclude pattern); kind: instant | duration | either
_Spec = tuple[re.Pattern[str], str, re.Pattern[str] | None]


def _spec(pattern: str, kind: str, exclude: str | None = None) -> _Spec:
    return re.compile(pattern, re.IGNORECASE), kind, re.compile(exclude, re.IGNORECASE) if exclude else None


SPECS: dict[str, _Spec] = {
    "revenue": _spec(r"Revenue|Sales|Turnover", "duration", r"CostOf|Deferred|Tax|Proceeds|Increase|Receivable|Contract"),
    "operating profit (EBIT)": _spec(
        r"OperatingProfit|OperatingIncome|OperatingResult|ProfitLossFromOperating|Ebit", "duration",
        r"Cash|Adjustments|Discontinued",
    ),
    "net income": _spec(
        r"ProfitLoss|NetIncome|NetProfit|ProfitFor|Profit\w*(Owners|Parent|Equity)", "duration",
        r"Before|Operating|Discontinued|Continuing|Adjustments|Tax|Comprehensive|Other|Cash",
    ),
    "depreciation and amortisation": _spec(r"Deprec|Amorti", "duration", r"Accumulated|Impairment|Rate|Liabilit"),
    "cost of sales or materials": _spec(
        r"CostOf(Sales|Goods|Materials|Revenue)|CostsOfGoods|RawMaterials", "duration", None
    ),
    "profit before tax": _spec(r"BeforeTax", "duration", r"Adjustments"),
    "income tax": _spec(
        r"IncomeTax|TaxExpense", "duration",
        r"Before|Deferred|Paid|Payable|Receivable|Liabilit|Asset|Rate|Reconcil|Adjustments",
    ),
    "total assets": _spec(r"Assets", "instant", r"Current|Noncurrent|Other|Financial|Intangible|Net|Deferred|Held|Right|Biological|Contract"),
    "total equity": _spec(r"Equity", "instant", r"Liabilit|Instruments|Reserve|Other|Share|Issued|Component|Hedg|Treasury"),
    "total liabilities": _spec(
        r"Liabilit", "instant",
        r"Current|Noncurrent|Lease|Deferred|Contract|Tax|Provision|Held|Other|Financial|Trade|Derivative|Equity",
    ),
    "total debt": _spec(r"Borrow|Bond|Loan|Debt|Debenture|Notes|InterestBearing", "instant", r"Receivable|Derivative|Held|Proceeds|Repayment"),
    "cash": _spec(
        r"Cash", "instant",
        r"CashFlows|Increase|Decrease|Effect|Paid|Received|Proceeds|Payments|Generated|Restricted",
    ),
    "operating cash flow": _spec(
        r"OperatingActivities|FromUsedInOperations|CashGenerated|CashFlowsFrom", "duration",
        r"Adjustments|Increase|Decrease|Interest|Tax|Dividend|Working|Changes|Discontinued|Other|Proceeds|Payments|Purchase|Investing|Financing",
    ),
    "capital expenditure": _spec(
        r"Purchase|Acquisition|CapitalExpend|PropertyPlant", "duration",
        r"Treasury|Shares|Subsidiar|Business|Financial|Securities|Investment|Proceeds|Sale|Disposal|Depreciation|Increase|Accumulated|Liabilit",
    ),
    "interest expense": _spec(
        r"Interest|FinanceCost", "duration",
        r"Income|Receiv|Paid|Payable|Capitaliz|Rate|Revenue|Accrued|Liabilit",
    ),
    "earnings per share": _spec(r"EarningsLossPerShare|EarningsPerShare|PerShare", "duration", None),
    # Beyond the core inputs
    "share count": _spec(
        r"Shares|NumberOf", "either",
        r"Treasury|Authori|Option|Warrant|Dividend|Repurchase|Price|Per(Share|Cent)",
    ),
    "lease payments": _spec(
        r"Lease", "duration",
        r"Interest|Liabilit|Asset|Right|Expense|Income|Depreciation|Receivable",
    ),
}

# Expected inputs beyond ix.CORE_INPUTS: label -> metric keys that satisfy it.
EXTRA_INPUTS: dict[str, tuple[str, ...]] = {
    "share count": ("shares_outstanding",),
    "lease payments": ("lease_payments_financing",),
}
_NOT_REVIEWED = frozenset({"EBITDA"})  # derived in code from EBIT + D&A

_CONCEPT_IN_TEXT = re.compile(r"[A-Za-z][\w\-]*:[A-Za-z]\w*")
_STRUCTURAL = {c for _, _, terms in ix._INTEGRITY_CHECKS for c in (_, *[t[0] for t in terms])} | {
    "ifrs-full:EquityAndLiabilities",
    "ifrs-full:CurrentAssets",
    "ifrs-full:NoncurrentAssets",
    "ifrs-full:CurrentLiabilities",
    "ifrs-full:NoncurrentLiabilities",
}


def _prior(fy: str) -> str | None:
    try:
        return f"FY{int(fy.removeprefix('FY')) - 1}"
    except ValueError:
        return None


def _prefix(concept: str) -> str:
    return concept.split(":", 1)[0] if ":" in concept else ""


def _is_extension(concept: str) -> bool:
    return _prefix(concept) not in STANDARD_PREFIXES


def _ties(a: Decimal, b: Decimal, facts: list[Any]) -> bool:
    base = max(abs(a), abs(b), Decimal(1))
    return abs(a - b) <= ix._decimals_tolerance(facts) * 2 + base * Decimal("0.001")


def _check(label: str, fact: Any, fy: str, resolved: dict[tuple[str, str], Any]) -> tuple[str, str]:
    """Trial check of one candidate against the filing's own identities.
    (status, detail); status: ties | plausible | does_not_tie | no_check."""
    get = lambda c: resolved.get((c, fy))
    assets, equity, liabilities = get("ifrs-full:Assets"), get("ifrs-full:Equity"), get("ifrs-full:Liabilities")
    if label == "operating cash flow":
        trial = dict(resolved)
        for concept in ix._CASH_FLOW_TOTALS[0][1]:
            trial.pop((concept, fy), None)
        trial[(ix._CASH_FLOW_TOTALS[0][1][0], fy)] = fact
        result = ix._cash_tie(fy, trial)
        if result is True:
            return "ties", "operating + investing + financing adds up to the change in cash with this as the operating total"
        if isinstance(result, str):
            return "does_not_tie", result
        return "no_check", "the cash-flow totals needed for the tie are not all tagged"
    if label == "total liabilities" and assets and equity and len({assets.unit, equity.unit, fact.unit}) == 1:
        if _ties(assets.value - equity.value, fact.value, [assets, equity, fact]):
            return "ties", "total assets − total equity equals this line"
        return "does_not_tie", f"assets − equity = {ix._fmt(assets.value - equity.value)}, this line = {ix._fmt(fact.value)}"
    if label == "total equity" and assets and liabilities and len({assets.unit, liabilities.unit, fact.unit}) == 1:
        if _ties(assets.value - liabilities.value, fact.value, [assets, liabilities, fact]):
            return "ties", "total assets − total liabilities equals this line"
        return "does_not_tie", f"assets − liabilities = {ix._fmt(assets.value - liabilities.value)}, this line = {ix._fmt(fact.value)}"
    if label == "total debt" and liabilities and liabilities.unit == fact.unit:
        if abs(fact.value) <= liabilities.value:
            return "plausible", "not above total liabilities (a plausibility check, not a tie)"
        return "does_not_tie", "larger than total liabilities"
    return "no_check", "no identity in the filing can verify this one"


def _kind_ok(kind: str, fact: Any) -> bool:
    return kind == "either" or (kind == "instant") == bool(fact.instant)


def _score(candidate: dict[str, Any], status: str, magnitude_reason: str | None) -> int:
    score = 0
    if not candidate["extension"]:
        score += 1
    if candidate["prior_year_value"] is not None:
        score += 2
    if status == "ties":
        score += 3
    elif status == "does_not_tie":
        score -= 3
    if magnitude_reason:
        score -= 2
    return score


def _gap_candidates(
    label: str, fy: str, resolved: dict[tuple[str, str], Any], assets: Any, revenue: Any
) -> list[dict[str, Any]]:
    pattern, kind, exclude = SPECS[label]
    prior = _prior(fy)
    rows: list[tuple[dict[str, Any], Decimal]] = []
    for (concept, year), fact in resolved.items():
        if year != fy or fact.value == 0 or not _kind_ok(kind, fact):
            continue
        local = ix._local_name(concept)
        if not pattern.search(local) or (exclude and exclude.search(local)):
            continue
        if label == "share count":
            if fact.unit and "/" in fact.unit:
                continue
        elif not fact.unit or not re.fullmatch(r"[A-Z]{3}(/shares)?", fact.unit):
            continue
        status, detail = _check(label, fact, fy, resolved)
        magnitude = None
        if label != "share count":
            if assets is not None and assets.unit == fact.unit and abs(fact.value) > 3 * assets.value:
                magnitude = "larger than three times total assets"
            elif (
                revenue is not None and revenue.unit == fact.unit and kind == "duration"
                and abs(fact.value) > 2 * revenue.value and label not in ("revenue", "earnings per share")
            ):
                magnitude = "larger than twice revenue"
        before = resolved.get((concept, prior)) if prior else None
        row = {
            "concept": concept,
            "prefix": _prefix(concept),
            "extension": _is_extension(concept),
            "suggested_scope": "company" if _is_extension(concept) else "all",
            "value": ix._fmt(fact.value),
            "unit": fact.unit or "",
            "prior_year_value": ix._fmt(before.value) if before is not None else None,
            "check": status,
            "check_detail": detail,
            "warning": magnitude,
        }
        row["score"] = _score(row, status, magnitude)
        rows.append((row, abs(fact.value)))
    rows.sort(key=lambda pair: (-pair[0]["score"], -pair[1]))
    return [row for row, _ in rows[:CANDIDATES_PER_GAP]]


def _consumed(fact_sources: dict[str, str]) -> set[str]:
    used: set[str] = set(_STRUCTURAL)
    for source in fact_sources.values():
        used.update(_CONCEPT_IN_TEXT.findall(source))
    return used


def _unused(
    fy: str, resolved: dict[tuple[str, str], Any], fact_sources: dict[str, str], base: Decimal | None
) -> list[dict[str, Any]]:
    if not base or base <= 0:
        return []
    used = _consumed({k: v for k, v in fact_sources.items() if k.startswith(f"{fy} ")})
    prior = _prior(fy)
    rows = []
    for (concept, year), fact in resolved.items():
        if year != fy or concept in used or not fact.unit or not re.fullmatch(r"[A-Z]{3}", fact.unit):
            continue
        share = abs(fact.value) / base
        if share < UNUSED_MIN_SHARE:
            continue
        before = resolved.get((concept, prior)) if prior else None
        rows.append(
            {
                "concept": concept,
                "extension": _is_extension(concept),
                "statement": "balance sheet" if fact.instant else "income or cash flow",
                "value": ix._fmt(fact.value),
                "unit": fact.unit,
                "share_of_base": f"{share:.1%}",
                "prior_year_value": ix._fmt(before.value) if before is not None else None,
                "_share": share,
            }
        )
    rows.sort(key=lambda r: -r["_share"])
    for r in rows:
        del r["_share"]
    return rows[:UNUSED_LIMIT]


def build_tag_review(
    years: list[str],
    resolved: dict[tuple[str, str], Any],
    extracted: set[tuple[str, str]],
    fact_sources: dict[str, str],
    reporting_bank: bool,
) -> dict[str, Any]:
    """Review of the latest fiscal year only; older years are comparatives."""
    if not years:
        return {}
    fy = years[0]
    assets = resolved.get(("ifrs-full:Assets", fy)) or resolved.get(("us-gaap:Assets", fy))
    revenue = next((resolved[(c, fy)] for c in ("ifrs-full:Revenue", "us-gaap:Revenues") if (c, fy) in resolved), None)

    expected: list[tuple[str, tuple[str, ...]]] = [(label, m) for label, m in ix.CORE_INPUTS if label not in _NOT_REVIEWED]
    expected += list(EXTRA_INPUTS.items())
    has_lease_liability = any(
        year == fy and re.search(r"Lease\w*Liabilit", ix._local_name(c)) and f.value != 0
        for (c, year), f in resolved.items()
    )
    gaps: list[dict[str, Any]] = []
    for label, metrics in expected:
        if any((m, fy) in extracted for m in metrics):
            continue
        if reporting_bank and label in ix._BANK_NOT_APPLICABLE:
            continue
        if label == "lease payments" and not has_lease_liability:
            continue  # no leases tagged: nothing to pay
        candidates = _gap_candidates(label, fy, resolved, assets, revenue)
        gaps.append({"metric": label, "fiscal_year": fy, "candidates": candidates})

    base_fact = revenue or assets
    return {
        "version": TAG_REVIEW_VERSION,
        "fiscal_year": fy,
        "gaps": gaps,
        "unused": _unused(fy, resolved, fact_sources, base_fact.value if base_fact else None),
    }
