"""Reading and writing fund facts (Sprint 8, F9): profile, reported
returns and exposures, with the rules that keep them traceable.

Rules enforced here (the API turns FundFactsError into a 422):
- the holding must be tagged Equity ETF or Equity fund
- every row cites a processed document uploaded to *this* fund holding
- weights are 0-100 and one dimension's weights never add up to more
  than 101 % (rounding in provider files; more means a typo)

Linking (`auto_link_exposures`): a fund holding row is matched to the
app's own Holding by ticker first, then by normalised company name
("Equinor ASA" = "EQUINOR"). A link set by hand survives a re-import.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.domain.instrument_types import is_fund_type
from app.models.document import Document
from app.models.fund import FundExposure, FundProfile, FundReturnPeriod
from app.models.holding import Holding

EXPOSURE_DIMENSIONS: tuple[str, ...] = ("holding", "sector", "country", "currency")
MANAGEMENT_STYLES: tuple[str, ...] = ("active", "index")
PERIOD_KINDS: tuple[str, ...] = ("calendar_year", "rolling_12m", "trailing", "since_inception")
REPLICATIONS: tuple[str, ...] = ("physical", "synthetic", "sampling")
DISTRIBUTIONS: tuple[str, ...] = ("accumulating", "distributing")
MAX_DIMENSION_SUM = Decimal("101")

LINK_TICKER = "ticker"
LINK_NAME = "name"
LINK_MANUAL = "manual"

_LEGAL_SUFFIXES = {
    "asa", "as", "ab", "abp", "oyj", "plc", "inc", "incorporated", "corp", "corporation", "co", "company",
    "ltd", "limited", "sa", "nv", "se", "ag", "spa", "holding", "holdings", "group", "the", "class", "a", "b",
    "publ", "de", "cv", "sab", "bhd", "tbk", "pcl",
}


class FundFactsError(ValueError):
    """A fund fact that can't be saved as given; the message says why."""


def normalize_company_name(name: str) -> str:
    """'Equinor ASA' -> 'equinor', 'Agnico-Eagle Mines Ltd' ->
    'agnico eagle mines', 'Sparebank 1 SMN' -> 'sparebank 1 smn'."""
    text = re.sub(r"[^0-9a-zæøåäöüé ]+", " ", name.lower().replace("&", " and "))
    words = [w for w in text.split() if w not in _LEGAL_SUFFIXES]
    return " ".join(words)


def _ticker_root(ticker: str) -> str:
    """'EQNR.OL' / 'EQNR NO' / 'eqnr' -> 'EQNR'."""
    return re.split(r"[.\s:/]", ticker.strip().upper(), maxsplit=1)[0]


def require_fund_holding(holding: Holding) -> None:
    if not is_fund_type(holding.asset_class_raw):
        raise FundFactsError(
            f"'{holding.ticker}' is tagged '{holding.asset_class_raw}'. Fund facts are only kept for "
            "holdings tagged Equity ETF or Equity fund — change Instrument Type on the Holdings page first."
        )


def require_source_document(db: Session, holding: Holding, document_id: uuid.UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.holding_id != holding.id:
        raise FundFactsError(
            "the source document must be a file uploaded to this fund (Documents section); "
            f"'{document_id}' is not one"
        )
    return document


def _check_weights(dimension: str, weights: list[Decimal]) -> None:
    for weight in weights:
        if weight < 0 or weight > 100:
            raise FundFactsError(f"{dimension} weight {weight} is outside 0-100 %")
    total = sum(weights, Decimal(0))
    if total > MAX_DIMENSION_SUM:
        raise FundFactsError(f"{dimension} weights add up to {total:.2f} %, more than 100 %")


def get_profile(db: Session, holding_id: uuid.UUID) -> FundProfile | None:
    return db.scalar(select(FundProfile).where(FundProfile.holding_id == holding_id))


def upsert_profile(db: Session, holding: Holding, values: dict) -> FundProfile:
    require_fund_holding(holding)
    require_source_document(db, holding, values["source_document_id"])
    if values.get("management_style") not in MANAGEMENT_STYLES:
        raise FundFactsError(f"management_style must be one of {MANAGEMENT_STYLES}")
    if values.get("replication") not in (None, *REPLICATIONS):
        raise FundFactsError(f"replication must be one of {REPLICATIONS} or empty")
    if values.get("distribution") not in (None, *DISTRIBUTIONS):
        raise FundFactsError(f"distribution must be one of {DISTRIBUTIONS} or empty")
    ocf = values.get("ongoing_charge_pct")
    if ocf is not None and not (Decimal(0) <= ocf <= Decimal(10)):
        raise FundFactsError("ongoing_charge_pct must be between 0 and 10 (percent per year)")
    risk = values.get("risk_class")
    if risk is not None and not 1 <= risk <= 7:
        raise FundFactsError("risk_class must be 1-7 (the KID summary risk indicator)")

    profile = get_profile(db, holding.id)
    if profile is None:
        profile = FundProfile(holding_id=holding.id, **values)
        db.add(profile)
    else:
        for key, value in values.items():
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


def list_returns(db: Session, holding_id: uuid.UUID) -> list[FundReturnPeriod]:
    rows = list(db.scalars(select(FundReturnPeriod).where(FundReturnPeriod.holding_id == holding_id)))
    order = {kind: i for i, kind in enumerate(PERIOD_KINDS)}
    rows.sort(key=lambda r: (order.get(r.period_kind, 9), -(r.end_date or date.min).toordinal(), r.period_label))
    return rows


def replace_returns(db: Session, holding: Holding, periods: list[dict]) -> list[FundReturnPeriod]:
    """Replaces the fund's whole list of reported returns (the UI edits it
    as one table)."""
    require_fund_holding(holding)
    for period in periods:
        require_source_document(db, holding, period["source_document_id"])
        if period.get("period_kind") not in PERIOD_KINDS:
            raise FundFactsError(f"period_kind must be one of {PERIOD_KINDS}")
        for key in ("fund_return_pct", "benchmark_return_pct"):
            value = period.get(key)
            if value is not None and not (Decimal(-100) <= value <= Decimal(10000)):
                raise FundFactsError(f"{period.get('period_label')}: {key} {value} is not a plausible return in %")
        years = period.get("years")
        if years is not None and years <= 0:
            raise FundFactsError(f"{period.get('period_label')}: years must be positive")
    db.execute(delete(FundReturnPeriod).where(FundReturnPeriod.holding_id == holding.id))
    for period in periods:
        db.add(FundReturnPeriod(holding_id=holding.id, **period))
    db.commit()
    return list_returns(db, holding.id)


def latest_exposures(db: Session, holding_id: uuid.UUID, dimension: str) -> tuple[date | None, list[FundExposure]]:
    """The most recent as-of snapshot of one dimension, largest weight first."""
    as_of = db.scalar(
        select(FundExposure.as_of_date)
        .where(FundExposure.holding_id == holding_id, FundExposure.dimension == dimension)
        .order_by(FundExposure.as_of_date.desc())
        .limit(1)
    )
    if as_of is None:
        return None, []
    rows = list(
        db.scalars(
            select(FundExposure).where(
                FundExposure.holding_id == holding_id,
                FundExposure.dimension == dimension,
                FundExposure.as_of_date == as_of,
            )
        )
    )
    rows.sort(key=lambda r: (-r.weight_pct, r.label))
    return as_of, rows


@dataclass(frozen=True)
class ExposureInput:
    label: str
    weight_pct: Decimal
    ticker: str | None = None
    isin: str | None = None
    source_page: int | None = None


def replace_exposures(
    db: Session,
    holding: Holding,
    *,
    dimension: str,
    as_of_date: date,
    source_document_id: uuid.UUID,
    rows: list[ExposureInput],
    commit: bool = True,
) -> list[FundExposure]:
    """Replaces one dimension's snapshot for `as_of_date` (other dates are
    kept as history). Holding rows are auto-linked; hand-set links on rows
    with the same name are carried over."""
    require_fund_holding(holding)
    if dimension not in EXPOSURE_DIMENSIONS:
        raise FundFactsError(f"dimension must be one of {EXPOSURE_DIMENSIONS}")
    require_source_document(db, holding, source_document_id)
    labels = [r.label.strip() for r in rows]
    if any(not label for label in labels):
        raise FundFactsError(f"every {dimension} row needs a name")
    _check_weights(dimension, [r.weight_pct for r in rows])

    manual_links: dict[str, uuid.UUID] = {}
    if dimension == "holding":
        for old in db.scalars(
            select(FundExposure).where(
                FundExposure.holding_id == holding.id,
                FundExposure.dimension == "holding",
                FundExposure.link_method == LINK_MANUAL,
            )
        ):
            if old.linked_holding_id is not None:
                manual_links[normalize_company_name(old.label)] = old.linked_holding_id

    db.execute(
        delete(FundExposure).where(
            FundExposure.holding_id == holding.id,
            FundExposure.dimension == dimension,
            FundExposure.as_of_date == as_of_date,
        )
    )
    created: list[FundExposure] = []
    for row, label in zip(rows, labels, strict=True):
        exposure = FundExposure(
            holding_id=holding.id,
            dimension=dimension,
            label=label[:255],
            weight_pct=row.weight_pct,
            ticker=(row.ticker or None) and row.ticker.strip()[:64],
            isin=(row.isin or None) and row.isin.strip().upper()[:12],
            as_of_date=as_of_date,
            source_document_id=source_document_id,
            source_page=row.source_page,
        )
        manual = manual_links.get(normalize_company_name(label))
        if manual is not None:
            exposure.linked_holding_id = manual
            exposure.link_method = LINK_MANUAL
        db.add(exposure)
        created.append(exposure)
    if dimension == "holding":
        auto_link_exposures(db, holding, [e for e in created if e.linked_holding_id is None])
    if commit:
        db.commit()
    else:
        db.flush()
    return created


def auto_link_exposures(db: Session, fund: Holding, exposures: list[FundExposure]) -> int:
    """Links fund holding rows to the app's Holding rows by ticker root, then
    by normalised name. Returns how many were linked."""
    if not exposures:
        return 0
    candidates = [h for h in db.scalars(select(Holding)) if h.id != fund.id]
    by_ticker: dict[str, Holding] = {}
    by_name: dict[str, Holding] = {}
    for h in candidates:
        by_ticker.setdefault(_ticker_root(h.ticker), h)
        by_name.setdefault(normalize_company_name(h.name), h)
    linked = 0
    for exposure in exposures:
        match: Holding | None = None
        method = None
        if exposure.ticker:
            match = by_ticker.get(_ticker_root(exposure.ticker))
            method = LINK_TICKER
        if match is None:
            key = normalize_company_name(exposure.label)
            match = by_name.get(key) if key else None
            method = LINK_NAME
        if match is not None:
            exposure.linked_holding_id = match.id
            exposure.link_method = method
            linked += 1
    return linked


def set_manual_link(
    db: Session, fund: Holding, exposure_id: uuid.UUID, linked_holding_id: uuid.UUID | None
) -> FundExposure:
    exposure = db.get(FundExposure, exposure_id)
    if exposure is None or exposure.holding_id != fund.id or exposure.dimension != "holding":
        raise FundFactsError("not a holding row of this fund")
    if linked_holding_id is not None:
        target = db.get(Holding, linked_holding_id)
        if target is None or target.id == fund.id:
            raise FundFactsError("link target must be another holding in the app")
    exposure.linked_holding_id = linked_holding_id
    exposure.link_method = LINK_MANUAL if linked_holding_id is not None else None
    db.commit()
    db.refresh(exposure)
    return exposure
