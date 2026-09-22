"""SEC EDGAR XBRL company-facts FundamentalsProvider (2026-09-22).

Two official, keyless SEC endpoints
(https://www.sec.gov/search-filings/edgar-application-programming-interfaces):

- ``https://www.sec.gov/files/company_tickers.json`` — ticker -> CIK map.
- ``https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`` — every
  XBRL fact the company has ever filed, each with its filing provenance
  (accession number, form, filed date).

SEC fair-access rules: max 10 requests/second and a descriptive
``User-Agent`` that identifies the requester with a contact email. The
User-Agent is config (``SEC_EDGAR_USER_AGENT``), never hard-coded — a
missing one fails visibly instead of sending an anonymous request the SEC
would block. One import is 1-2 requests, far under the rate limit.

What this module does and doesn't do (CLAUDE.md Rule 1): it *selects*
filer-reported values — the right XBRL concept, the annual duration, the
latest-filed (i.e. restated-if-restated) figure per fiscal year — and hands
them back untouched. It never adds, subtracts or derives a number. Metrics
the filer doesn't report directly (EBITDA, EBIT) are simply absent.

Known approximations (documented, deliberate):
- ``period`` is ``FY{calendar year of the fiscal-year end date}`` — matches
  how app/domain/period_dates.py already treats uploaded-filing periods. A
  retailer whose fiscal year ends in January is labelled with the year the
  period *ends* in.
- ``total_debt`` uses the filer's own total long-term debt tag (current +
  non-current where reported); short-term borrowings/commercial paper are
  not added in, because adding them would be arithmetic.
"""
from __future__ import annotations

import time
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from app.providers.base import (
    CompanyFundamentals,
    FundamentalsProvider,
    FundamentalsUnavailableError,
    ReportedFact,
)

_PROVIDER_NAME = "SEC EDGAR"
TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
FILING_INDEX_URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-K"

ANNUAL_FORMS = frozenset({"10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A", "10-KT"})
_ANNUAL_MIN_DAYS = 350
_ANNUAL_MAX_DAYS = 380
_FY_END_TOLERANCE_DAYS = 3

# Canonical metric -> XBRL concepts in priority order. Per fiscal year the
# first concept that has a value wins, so a company that switched tags
# (e.g. SalesRevenueNet -> RevenueFromContractWithCustomer...) stays covered.
CONCEPT_MAP: dict[str, tuple[str, ...]] = {
    "revenue": (
        "us-gaap:Revenues",
        "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
        "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax",
        "us-gaap:SalesRevenueNet",
        "ifrs-full:Revenue",
        "ifrs-full:RevenueFromContractsWithCustomers",
    ),
    "cost_of_goods_sold": (
        "us-gaap:CostOfRevenue",
        "us-gaap:CostOfGoodsAndServicesSold",
        "us-gaap:CostOfGoodsSold",
        "ifrs-full:CostOfSales",
    ),
    "operating_income": (
        "us-gaap:OperatingIncomeLoss",
        "ifrs-full:ProfitLossFromOperatingActivities",
    ),
    "net_income": (
        "us-gaap:NetIncomeLoss",
        "ifrs-full:ProfitLossAttributableToOwnersOfParent",
        "ifrs-full:ProfitLoss",
    ),
    "depreciation_and_amortization": (
        "us-gaap:DepreciationDepletionAndAmortization",
        "us-gaap:DepreciationAndAmortization",
        "us-gaap:DepreciationAmortizationAndAccretionNet",
        "ifrs-full:DepreciationAndAmortisationExpense",
        "ifrs-full:DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
    ),
    "total_assets": ("us-gaap:Assets", "ifrs-full:Assets"),
    "total_equity": (
        "us-gaap:StockholdersEquity",
        "us-gaap:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        "ifrs-full:EquityAttributableToOwnersOfParent",
        "ifrs-full:Equity",
    ),
    "total_liabilities": ("us-gaap:Liabilities", "ifrs-full:Liabilities"),
    "operating_cash_flow": (
        "us-gaap:NetCashProvidedByUsedInOperatingActivities",
        "ifrs-full:CashFlowsFromUsedInOperatingActivities",
    ),
    "shares_outstanding": (
        "us-gaap:CommonStockSharesOutstanding",
        "us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding",
        "us-gaap:WeightedAverageNumberOfSharesOutstandingBasic",
        "ifrs-full:NumberOfSharesOutstanding",
        "ifrs-full:WeightedAverageShares",
    ),
    "total_debt": (
        "us-gaap:LongTermDebt",
        "us-gaap:DebtLongtermAndShorttermCombinedAmount",
        "us-gaap:LongTermDebtNoncurrent",
        "ifrs-full:Borrowings",
        "ifrs-full:NoncurrentPortionOfNoncurrentBorrowings",
    ),
    "cash_and_equivalents": (
        "us-gaap:CashAndCashEquivalentsAtCarryingValue",
        "us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
        "ifrs-full:CashAndCashEquivalents",
    ),
    "capital_expenditures": (
        "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",
        "ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
    ),
    "interest_expense": (
        "us-gaap:InterestExpense",
        "us-gaap:InterestExpenseNonoperating",
        "us-gaap:InterestExpenseDebt",
        "ifrs-full:InterestExpense",
        "ifrs-full:FinanceCosts",
    ),
}
SHARE_METRICS = frozenset({"shares_outstanding"})


def normalize_ticker(ticker: str) -> str:
    """'eqnr.ol' -> 'EQNR'; 'brk-b' -> 'BRK-B'. SEC's map uses bare
    US-style symbols; yfinance exchange suffixes (.OL, .ST, ...) are dropped."""
    base = ticker.strip().upper()
    if "." in base:
        base = base.split(".", 1)[0]
    return base


def _parse_date(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _concept_units(payload: dict, concept: str) -> dict[str, list[dict]]:
    taxonomy, _, name = concept.partition(":")
    node = payload.get("facts", {}).get(taxonomy, {}).get(name)
    if not isinstance(node, dict):
        return {}
    units = node.get("units")
    return units if isinstance(units, dict) else {}


def _is_annual_duration(entry: dict) -> bool:
    start, end = _parse_date(entry.get("start")), _parse_date(entry.get("end"))
    if start is None or end is None:
        return False
    return _ANNUAL_MIN_DAYS <= (end - start).days <= _ANNUAL_MAX_DAYS


def _annual_entries(payload: dict) -> list[dict]:
    """Every entry from an annual form, across the mapped concepts."""
    out = []
    for concepts in CONCEPT_MAP.values():
        for concept in concepts:
            for entries in _concept_units(payload, concept).values():
                out.extend(e for e in entries if isinstance(e, dict) and e.get("form") in ANNUAL_FORMS)
    return out


def _fiscal_year_ends(payload: dict) -> list[date]:
    ends = {
        _parse_date(e.get("end"))
        for e in _annual_entries(payload)
        if _is_annual_duration(e)
    }
    return sorted(d for d in ends if d is not None)


def _matching_fy_end(end: date, fy_ends: list[date]) -> date | None:
    for fy_end in fy_ends:
        if abs((fy_end - end).days) <= _FY_END_TOLERANCE_DAYS:
            return fy_end
    return None


def _pick_currency(payload: dict) -> str | None:
    """The currency the filer reports most of its mapped monetary facts in."""
    counts: dict[str, int] = {}
    for metric, concepts in CONCEPT_MAP.items():
        if metric in SHARE_METRICS:
            continue
        for concept in concepts:
            for unit, entries in _concept_units(payload, concept).items():
                if len(unit) == 3 and unit.isalpha() and unit.isupper():
                    counts[unit] = counts.get(unit, 0) + len(entries)
    if not counts:
        return None
    return max(counts.items(), key=lambda kv: kv[1])[0]


def extract_annual_facts(payload: dict, *, max_years: int = 10) -> list[ReportedFact]:
    """Pure selection logic over a companyfacts payload — no network, so it
    is unit-tested directly against fixture payloads."""
    fy_ends = _fiscal_year_ends(payload)
    if not fy_ends:
        return []
    # One fiscal year per calendar year label; if a fiscal-year change put
    # two year-ends in one calendar year, the later one wins.
    by_label: dict[str, date] = {}
    for fy_end in fy_ends:
        by_label[f"FY{fy_end.year}"] = fy_end
    kept_ends = sorted(by_label.values())[-max_years:]
    currency = _pick_currency(payload)

    facts: list[ReportedFact] = []
    for metric, concepts in CONCEPT_MAP.items():
        wanted_unit = "shares" if metric in SHARE_METRICS else currency
        if wanted_unit is None:
            continue
        chosen: dict[date, ReportedFact] = {}
        for concept in concepts:
            entries = _concept_units(payload, concept).get(wanted_unit, [])
            best: dict[date, dict] = {}
            for entry in entries:
                if not isinstance(entry, dict) or entry.get("form") not in ANNUAL_FORMS:
                    continue
                end = _parse_date(entry.get("end"))
                if end is None:
                    continue
                if entry.get("start") is not None and not _is_annual_duration(entry):
                    continue
                fy_end = _matching_fy_end(end, kept_ends)
                if fy_end is None or fy_end in chosen:
                    continue
                if _to_decimal(entry.get("val")) is None:
                    continue
                # Latest-filed wins: a later 10-K/A or the next year's 10-K
                # carries the restated figure if there was a restatement.
                current = best.get(fy_end)
                if current is None or str(entry.get("filed", "")) > str(current.get("filed", "")):
                    best[fy_end] = entry
            for fy_end, entry in best.items():
                chosen[fy_end] = ReportedFact(
                    metric=metric,
                    value=_to_decimal(entry["val"]),  # type: ignore[arg-type]
                    unit=wanted_unit,
                    currency=None if metric in SHARE_METRICS else wanted_unit,
                    period=f"FY{fy_end.year}",
                    period_end=fy_end.isoformat(),
                    concept=concept,
                    form=str(entry.get("form")),
                    accession_number=str(entry.get("accn", "")),
                    filed=str(entry.get("filed", "")),
                )
        facts.extend(chosen[k] for k in sorted(chosen))
    return facts


class SecEdgarFundamentalsProvider(FundamentalsProvider):
    name = _PROVIDER_NAME
    _TICKER_MAP_TTL_SECONDS = 24 * 3600

    def __init__(
        self,
        *,
        user_agent: str | None,
        max_years: int = 10,
        timeout_seconds: float = 30.0,
        client: httpx.Client | None = None,
    ) -> None:
        self._user_agent = (user_agent or "").strip()
        self._max_years = max_years
        self._timeout = timeout_seconds
        self._client = client
        self._ticker_map: dict[str, tuple[str, str]] | None = None
        self._ticker_map_loaded_at = 0.0

    def _get_json(self, url: str) -> tuple[Any, bytes]:
        if not self._user_agent or "@" not in self._user_agent:
            raise FundamentalsUnavailableError(
                "SEC_EDGAR_USER_AGENT is not set (or has no contact email) — the SEC requires a "
                "descriptive User-Agent like 'Aladdin portfolio app you@example.com'"
            )
        headers = {"User-Agent": self._user_agent, "Accept-Encoding": "gzip, deflate"}
        client = self._client or httpx.Client(timeout=self._timeout)
        try:
            for attempt in range(2):
                try:
                    response = client.get(url, headers=headers)
                except httpx.HTTPError as exc:
                    raise FundamentalsUnavailableError(f"SEC EDGAR request failed: {exc}") from exc
                if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    time.sleep(1.0)
                    continue
                break
            if response.status_code == 404:
                raise FundamentalsUnavailableError(f"SEC EDGAR has no data at {url}")
            if response.status_code != 200:
                raise FundamentalsUnavailableError(
                    f"SEC EDGAR returned HTTP {response.status_code} for {url}"
                )
            try:
                return response.json(), response.content
            except ValueError as exc:
                raise FundamentalsUnavailableError(f"SEC EDGAR returned non-JSON for {url}") from exc
        finally:
            if self._client is None:
                client.close()

    def _load_ticker_map(self) -> dict[str, tuple[str, str]]:
        fresh = time.monotonic() - self._ticker_map_loaded_at < self._TICKER_MAP_TTL_SECONDS
        if self._ticker_map is not None and fresh:
            return self._ticker_map
        data, _raw = self._get_json(TICKER_MAP_URL)
        mapping: dict[str, tuple[str, str]] = {}
        rows = data.values() if isinstance(data, dict) else []
        for row in rows:
            if not isinstance(row, dict):
                continue
            ticker, cik, title = row.get("ticker"), row.get("cik_str"), row.get("title")
            if ticker and cik is not None:
                mapping[str(ticker).upper()] = (f"{int(cik):010d}", str(title or ""))
        self._ticker_map = mapping
        self._ticker_map_loaded_at = time.monotonic()
        return mapping

    def resolve_company(self, ticker: str) -> tuple[str, str] | None:
        return self._load_ticker_map().get(normalize_ticker(ticker))

    def get_annual_fundamentals(self, company_id: str) -> CompanyFundamentals:
        cik = f"{int(company_id):010d}"
        payload, raw = self._get_json(COMPANY_FACTS_URL.format(cik=cik))
        if not isinstance(payload, dict):
            raise FundamentalsUnavailableError("SEC EDGAR company-facts payload was not a JSON object")
        facts = extract_annual_facts(payload, max_years=self._max_years)
        if not facts:
            raise FundamentalsUnavailableError(
                f"SEC EDGAR has no usable annual (10-K/20-F/40-F) facts for CIK {cik}"
            )
        return CompanyFundamentals(
            source_name=_PROVIDER_NAME,
            source_url=FILING_INDEX_URL.format(cik=cik),
            company_id=cik,
            entity_name=str(payload.get("entityName") or ""),
            facts=facts,
            raw_payload=raw,
            retrieved_at=datetime.now(timezone.utc),
        )
