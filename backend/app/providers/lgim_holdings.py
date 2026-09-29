"""L&G (LGIM) public ETF holdings file — fund look-through data capture.

Confirmed live 2026-09-29 (through the built-in browser; this sandbox has no
route to fundcentres.lgim.com) against the L&G Gold Mining UCITS ETF
(IE00B3CNHG25). The fund page publishes its full basket ("Download full fund
holdings") as a CSV, and both steps below answered 200 with cookies disabled,
so no login or accepted-terms session is needed by the server:

1. Resolve the current file URL from the fund page's own API fragment

       GET https://fundcentres.landg.com/srp/api/part
           ?id=12618&audience=141&route=4233&version=live&languageId=1
           &share_class_id={SHARE_CLASS}&fund_id={FUND}

   which returns an HTML fragment holding a small JSON-ish block
   `"<share_class_id>": [{ name: "Download full fund holdings",
   url: "https://fundcentres.lgim.com/srp/documents-id/<uuid>/Fundholdings.csv",
   type: "csv" }]`. The document UUID is looked up on every fetch — it is a
   per-publication id, never hard-coded. (`audience=141` is the Norway /
   private-investor audience; `route=4233` is the ETF fund-page template.)

2. GET that CSV:

       sep=,
       Basket Name<fund name>
       ETF Trading ID<fund ISIN>
       Basket Trade Date<YYYY-MM-DD>
       Security Description,ISIN,Trading Currency,Constituent Weight (Base)
       NEWMONT CORP USD 1.6,US6516391066,USD,0.162972902934     <- a FRACTION
       ...
       Cash Component is a balancing number. Formula = "1 minus the sum ..."
       Record Count44

Weights are fractions of the fund (0.163 = 16.3%) and add up to ~1; the cash
remainder is not a row (it is 1 minus the sum, and can be a hair negative from
rounding). The file has no country or sector — only the trading currency.

Which fund maps to which `fund_id` / `share_class_id` is a small registry
below (one entry per L&G ETF we track, found from the fund page's network
traffic); an ISIN not in it is refused with a clear message rather than
guessed. The fetched file is validated against the request: the basket's own
"ETF Trading ID" must equal the requested ISIN and the "Record Count" footer
must equal the rows parsed (a truncated download is refused).

This module only fetches and converts. The rows go through the same
deterministic holdings importer as an uploaded CSV
(app/services/funds/holdings_import.py) by way of a generated CSV, so the
fetched data is stored as a real `fund_holdings` document and every figure
stays traceable to it (decision 23, CLAUDE.md Rule 1 — no LLM).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

import httpx

RESOLVER_URL = "https://fundcentres.landg.com/srp/api/part"
_ALLOWED_FILE_HOSTS = ("fundcentres.lgim.com", "fundcentres.landg.com")
_ISIN_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}\d$")
_TIMEOUT = 30.0
_WEIGHT_SUM_RANGE = (Decimal("0.90"), Decimal("1.01"))  # fractions; ~1 with rounding either way


@dataclass(frozen=True)
class LgimFund:
    name: str
    fund_id: int
    share_class_id: int


# Found on the fund page's network traffic (2026-09-29). Add an entry per L&G ETF.
KNOWN_FUNDS: dict[str, LgimFund] = {
    "IE00B3CNHG25": LgimFund("L&G Gold Mining UCITS ETF", fund_id=96, share_class_id=896),
}


class LgimFeedError(RuntimeError):
    """The file could not be fetched or did not look like an L&G basket file."""


@dataclass(frozen=True)
class LgimHolding:
    isin: str
    name: str
    weight_pct: Decimal
    currency: str | None


@dataclass(frozen=True)
class LgimHoldings:
    fund_isin: str
    fund_name: str
    as_of_date: date | None
    holdings: list[LgimHolding]
    cash_weight_pct: Decimal
    url: str


def normalize_isin(value: str) -> str:
    isin = (value or "").strip().upper()
    if not _ISIN_RE.fullmatch(isin):
        raise LgimFeedError(f"'{value}' is not a valid ISIN (2 letters, 9 letters/digits, 1 check digit)")
    return isin


def known_fund(isin: str) -> LgimFund:
    fund = KNOWN_FUNDS.get(isin)
    if fund is None:
        raise LgimFeedError(
            f"{isin} is not a configured L&G ETF (known: {', '.join(sorted(KNOWN_FUNDS))}). "
            "Add it to KNOWN_FUNDS in app/providers/lgim_holdings.py with the fund_id / share_class_id "
            "from its fund page."
        )
    return fund


def resolver_params(fund: LgimFund) -> dict[str, str | int]:
    return {
        "id": 12618,
        "audience": 141,
        "route": 4233,
        "version": "live",
        "languageId": 1,
        "share_class_id": fund.share_class_id,
        "fund_id": fund.fund_id,
    }


def extract_file_url(fragment: str, share_class_id: int) -> str:
    """The 'Download full fund holdings' CSV URL for one share class from the
    resolver's HTML fragment. The URL comes from a third-party response, so
    only https on an L&G host is accepted."""
    for block in re.finditer(rf'"{share_class_id}"\s*:\s*\[(.*?)\]', fragment, re.DOTALL):
        for entry in re.finditer(r"\{[^{}]*\}", block.group(1)):
            url_match = re.search(r'url\s*:\s*"([^"]+)"', entry.group(0))
            if not url_match:
                continue
            url = url_match.group(1)
            if url.lower().endswith("fundholdings.csv"):
                parsed = urlparse(url)
                if parsed.scheme != "https" or parsed.hostname not in _ALLOWED_FILE_HOSTS:
                    raise LgimFeedError(f"refusing holdings URL on an unexpected host: {parsed.hostname}")
                return url
    raise LgimFeedError("the fund page lists no 'Download full fund holdings' CSV for this share class")


_SHARE_SUFFIXES = (
    re.compile(r"\s+NPV$"),
    re.compile(r"\s+NEW$"),
    re.compile(r"\s+(?:USD|CAD|EUR|GBP|AUD|ZAR|NOK|SEK|CHF)\s+\d+(?:\.\d+)?$"),
    re.compile(r"\s+(?:USD|CAD|EUR|GBP|AUD|ZAR|NOK|SEK|CHF)$"),
    re.compile(r"\s+\d+P$"),
)


def clean_name(raw: str) -> str:
    """'NEWMONT CORP USD 1.6' -> 'NEWMONT CORP', 'KINROSS GOLD CORP CAD NPV'
    -> 'KINROSS GOLD CORP': the share-class descriptor L&G appends is noise
    for matching a fund line to a company the app already holds."""
    name = " ".join(raw.split())
    changed = True
    while changed:
        changed = False
        for suffix in _SHARE_SUFFIXES:
            stripped = suffix.sub("", name)
            if stripped != name and stripped:
                name, changed = stripped, True
    return name


def _meta(text: str, label: str) -> str | None:
    """Value of a metadata line whose label may or may not be followed by a
    delimiter ('Basket Trade Date2026-09-29' / 'Basket Trade Date,2026-09-29')."""
    match = re.search(rf"^{re.escape(label)}[\s,;:]*(.+?)\s*$", text, re.MULTILINE)
    return match.group(1).strip().strip('"') if match else None


def parse_holdings_csv(content: bytes | str, *, fund_isin: str, url: str = "") -> LgimHoldings:
    text = content.decode("utf-8-sig", errors="replace") if isinstance(content, bytes) else content
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    trading_id = _meta(text, "ETF Trading ID")
    if trading_id is None or trading_id.upper() != fund_isin:
        raise LgimFeedError(
            f"the file is for '{trading_id}', not {fund_isin} — refusing to import another fund's basket"
        )
    fund_name = _meta(text, "Basket Name") or fund_isin
    as_of: date | None = None
    trade_date = _meta(text, "Basket Trade Date")
    if trade_date:
        try:
            as_of = date.fromisoformat(trade_date[:10])
        except ValueError:
            as_of = None

    lines = text.split("\n")
    header_index = next(
        (i for i, line in enumerate(lines) if line.lower().startswith("security description")), None
    )
    if header_index is None:
        raise LgimFeedError("no 'Security Description,ISIN,…' header row in the file")
    columns = {c.strip().lower(): idx for idx, c in enumerate(next(csv.reader([lines[header_index]])))}
    for needed in ("security description", "isin", "constituent weight (base)"):
        if needed not in columns:
            raise LgimFeedError(f"the holdings table has no '{needed}' column")

    holdings: list[LgimHolding] = []
    weight_sum = Decimal(0)
    for line in lines[header_index + 1 :]:
        if not line.strip():
            break  # the table ends at the first blank line
        row = next(csv.reader([line]))
        try:
            fraction = Decimal(row[columns["constituent weight (base)"]].strip())
        except (InvalidOperation, IndexError) as exc:
            raise LgimFeedError(f"unreadable weight in row: {line[:80]}") from exc
        name = clean_name(row[columns["security description"]])
        if not name or fraction <= 0:
            continue
        weight_sum += fraction
        currency = row[columns["trading currency"]].strip() if "trading currency" in columns and len(row) > columns["trading currency"] else ""
        holdings.append(
            LgimHolding(
                isin=row[columns["isin"]].strip().upper(),
                name=name,
                weight_pct=fraction * 100,
                currency=currency or None,
            )
        )
    if not holdings:
        raise LgimFeedError("the holdings table has no rows")

    record_count = _meta(text, "Record Count")
    if record_count and record_count.isdigit() and int(record_count) != len(holdings):
        raise LgimFeedError(
            f"the file says {record_count} records but {len(holdings)} were read — a truncated download"
        )
    low, high = _WEIGHT_SUM_RANGE
    if not (low <= weight_sum <= high):
        raise LgimFeedError(f"constituent weights add up to {weight_sum * 100:.2f}% — not a full basket")

    return LgimHoldings(
        fund_isin=fund_isin,
        fund_name=fund_name,
        as_of_date=as_of,
        holdings=holdings,
        cash_weight_pct=max(Decimal(0), (1 - weight_sum) * 100),
        url=url,
    )


def to_csv_bytes(feed: LgimHoldings) -> bytes:
    """A provider-style CSV the standard holdings importer reads: a title row
    carrying the as-of date, then ISIN / Name / Weight (%) / Currency (weights
    in percent, so the importer's fraction heuristic is never involved).
    Generated so a fetch is stored as a real, re-importable `fund_holdings`
    document."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    when = feed.as_of_date.strftime("%d.%m.%Y") if feed.as_of_date else "unknown date"
    writer.writerow([f"Holdings as of {when} - source: L&G (fundcentres.landg.com), fund {feed.fund_isin}"])
    writer.writerow([])
    writer.writerow(["ISIN", "Name", "Weight (%)", "Currency"])
    for h in feed.holdings:
        writer.writerow([h.isin, h.name, f"{h.weight_pct:.6f}", h.currency or ""])
    return buffer.getvalue().encode("utf-8")


def _get(client: httpx.Client, url: str, **kwargs) -> httpx.Response:
    try:
        response = client.get(url, **kwargs)
    except httpx.HTTPError as exc:
        raise LgimFeedError(f"could not reach {url}: {exc}") from exc
    if response.status_code != 200:
        raise LgimFeedError(f"{url} answered HTTP {response.status_code}")
    if not response.content:
        raise LgimFeedError(f"{url} returned an empty response")
    return response


def fetch_lgim_holdings(isin: str, *, client: httpx.Client | None = None) -> LgimHoldings:
    isin = normalize_isin(isin)
    fund = known_fund(isin)
    owns_client = client is None
    client = client or httpx.Client(timeout=_TIMEOUT, follow_redirects=True, headers={"User-Agent": "Aladdin/1.0"})
    try:
        fragment = _get(client, RESOLVER_URL, params=resolver_params(fund)).text
        url = extract_file_url(fragment, fund.share_class_id)
        content = _get(client, url).content
    finally:
        if owns_client:
            client.close()
    return parse_holdings_csv(content, fund_isin=isin, url=url)
