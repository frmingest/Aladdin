"""One-time check that each holding's saved trading currency matches the
currency its price is quoted in (2026-10-14,
claude/price-split-data-fixes-2026-10-14.md). Read-only: it lists what
looks wrong and changes nothing.

A wrong currency usually comes from the Nordnet CSV "Valuta" column. It
shows as a NOK holding with USD/EUR in the Holdings column."""
from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.market import MarketObservation

# Exchange suffix -> the currency stocks listed there trade in.
SUFFIX_CURRENCY = {
    ".OL": "NOK",
    ".ST": "SEK",
    ".CO": "DKK",
    ".HE": "EUR",
    ".DE": "EUR",
    ".PA": "EUR",
    ".AS": "EUR",
    ".MI": "EUR",
}
# Yahoo quotes London in pence; treat the pence codes as the pound.
_EQUIVALENT = {"GBX": "GBP", "GBp": "GBP"}


def _norm(code: str) -> str:
    return _EQUIVALENT.get(code, code).upper()


@dataclass
class CurrencyFinding:
    ticker: str
    name: str
    saved_currency: str
    price_currency: str | None
    issues: list[str] = field(default_factory=list)


@dataclass
class CurrencyCheck:
    checked: int
    findings: list[CurrencyFinding]


def _latest_price_currency(db: Session, holding: Holding) -> str | None:
    row = db.scalar(
        select(MarketObservation)
        .where(MarketObservation.holding_id == holding.id)
        .order_by(MarketObservation.observed_at.desc())
        .limit(1)
    )
    return row.currency if row is not None else None


def check_holding_currencies(db: Session) -> CurrencyCheck:
    findings: list[CurrencyFinding] = []
    holdings = list(db.scalars(select(Holding).order_by(Holding.ticker)))
    for holding in holdings:
        saved = _norm(holding.trading_currency)
        price_currency = _latest_price_currency(db, holding)
        issues: list[str] = []
        if price_currency is not None and _norm(price_currency) != saved:
            issues.append(
                f"saved as {saved} but its latest price is quoted in {_norm(price_currency)}"
            )
        ticker = holding.ticker.upper()
        for suffix, expected in SUFFIX_CURRENCY.items():
            if ticker.endswith(suffix) and saved != expected:
                issues.append(f"{suffix} stocks trade in {expected}, but this one is saved as {saved}")
                break
        if issues:
            findings.append(
                CurrencyFinding(
                    ticker=holding.ticker,
                    name=holding.name,
                    saved_currency=saved,
                    price_currency=_norm(price_currency) if price_currency else None,
                    issues=issues,
                )
            )
    return CurrencyCheck(checked=len(holdings), findings=findings)
