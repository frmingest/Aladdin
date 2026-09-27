"""Stores and reads the World Bank / WGI inputs for the SSI, and turns them
into an SSIResult per country (Epic F22, story 22.10).

Refresh is per country, best effort, and only for the handful of countries
the portfolio actually touches (plan §4a #2). A country whose newest
stored fetch is younger than `country_indicators_stale_after_days` isn't
re-fetched. One failing indicator never stops the others; its error is
returned, not swallowed.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.country_risk_assumptions import (
    get_country_risk_assumptions,
    wgi_to_score,
)
from app.models.country_risk import CountryIndicator
from app.providers.world_bank import CountryIndicatorProvider, WorldBankUnavailableError
from app.services.country_risk.domicile import (
    COUNTRY_CURRENCY,
    COUNTRY_NAMES,
    SDR_BASKET_CURRENCIES,
)
from app.services.country_risk.ssi import SSIInputs, SSIResult, compute_ssi

logger = logging.getLogger(__name__)

_HUNDRED = Decimal(100)


@dataclass
class CountryRefreshResult:
    country: str
    status: str  # "updated" | "fresh" | "partial" | "failed"
    inserted: int = 0
    errors: list[str] = field(default_factory=list)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _newest_fetch(db: Session, country: str) -> datetime | None:
    return db.scalar(
        select(func.max(CountryIndicator.fetched_at)).where(CountryIndicator.country_code == country)
    )


def refresh_country(
    db: Session,
    provider: CountryIndicatorProvider,
    country: str,
    *,
    only_stale: bool = True,
    now: datetime | None = None,
) -> CountryRefreshResult:
    settings = get_settings()
    assumptions = get_country_risk_assumptions(settings.active_country_risk_assumptions_version)
    now = now or datetime.now(timezone.utc)
    newest = _newest_fetch(db, country)
    if only_stale and newest is not None and now - _aware(newest) < timedelta(
        days=settings.country_indicators_stale_after_days
    ):
        return CountryRefreshResult(country, "fresh")

    existing = {
        (row.indicator_code, row.data_year): row.value
        for row in db.scalars(select(CountryIndicator).where(CountryIndicator.country_code == country))
    }
    result = CountryRefreshResult(country, "updated")
    ok = 0
    for spec in assumptions.indicators:
        try:
            points = provider.fetch(
                country,
                spec.code,
                start_year=now.year - assumptions.history_years,
                end_year=now.year,
                source_id=spec.wb_source_id,
            )
        except WorldBankUnavailableError as exc:
            result.errors.append(str(exc))
            continue
        ok += 1
        for point in points:
            if existing.get((spec.code, point.year)) == point.value:
                continue
            db.add(
                CountryIndicator(
                    country_code=country,
                    indicator_code=spec.code,
                    data_year=point.year,
                    value=point.value,
                    source=spec.source,
                    fetched_at=now,
                )
            )
            result.inserted += 1
    if ok == 0:
        result.status = "failed"
    elif result.errors:
        result.status = "partial"
    if ok and result.inserted == 0:
        # Record that a successful fetch happened even though nothing
        # changed, so the next analysis doesn't re-fetch within the window.
        spec = assumptions.indicators[0]
        row = db.scalar(
            select(CountryIndicator)
            .where(CountryIndicator.country_code == country, CountryIndicator.indicator_code == spec.code)
            .order_by(CountryIndicator.data_year.desc())
            .limit(1)
        )
        if row is not None:
            row.fetched_at = now
    db.commit()
    return result


def refresh_countries(
    db: Session, provider: CountryIndicatorProvider | None, countries: list[str], *, only_stale: bool = True
) -> list[CountryRefreshResult]:
    if provider is None:
        return []
    results = []
    for country in countries:
        try:
            results.append(refresh_country(db, provider, country, only_stale=only_stale))
        except Exception as exc:  # best effort — never break an analysis over this
            logger.exception("country indicator refresh failed for %s", country)
            db.rollback()
            results.append(CountryRefreshResult(country, "failed", errors=[str(exc)]))
    return results


def _series(db: Session, country: str, code: str) -> dict[int, Decimal]:
    """{data_year: value}, newest fetch wins for a year."""
    rows = db.scalars(
        select(CountryIndicator)
        .where(CountryIndicator.country_code == country, CountryIndicator.indicator_code == code)
        .order_by(CountryIndicator.fetched_at.asc())
    )
    out: dict[int, Decimal] = {}
    for row in rows:
        out[row.data_year] = Decimal(row.value)
    return out


@dataclass
class InputFigure:
    label: str
    value: Decimal | None
    data_year: int | None
    note: str = ""


@dataclass
class CountryRisk:
    country: str
    name: str
    currency: str | None
    sdr_basket_currency: bool
    ssi: SSIResult
    figures: list[InputFigure] = field(default_factory=list)
    wgi_estimate: Decimal | None = None
    wgi_year: int | None = None
    fetched_at: datetime | None = None

    @property
    def any_data(self) -> bool:
        return any(f.value is not None for f in self.figures)


def _latest(series: dict[int, Decimal]) -> tuple[int | None, Decimal | None]:
    if not series:
        return None, None
    year = max(series)
    return year, series[year]


def _avg_last(series: dict[int, Decimal], n: int = 3) -> Decimal | None:
    years = sorted(series)[-n:]
    if len(years) < n:
        return None
    return sum(series[y] for y in years) / n


def get_country_risk(db: Session, country: str) -> CountryRisk:
    settings = get_settings()
    assumptions = get_country_risk_assumptions(settings.active_country_risk_assumptions_version)
    debt = _series(db, country, "GC.DOD.TOTL.GD.ZS")
    balance = _series(db, country, "GC.NLD.TOTL.GD.ZS")
    ca = _series(db, country, "BN.CAB.XOKA.GD.ZS")
    months = _series(db, country, "FI.RES.TOTL.MO")
    ext_debt = _series(db, country, "DT.DOD.DECT.CD")
    reserves = _series(db, country, "FI.RES.TOTL.CD")
    growth = _series(db, country, "NY.GDP.MKTP.KD.ZG")
    wgi = _series(db, country, "PV.EST")

    debt_year, debt_value = _latest(debt)
    bal_year, bal_value = _latest(balance)
    bal_change = None
    if bal_year is not None and (bal_year - 2) in balance:
        bal_change = bal_value - balance[bal_year - 2]
    ca_year, ca_value = _latest(ca)
    mo_year, mo_value = _latest(months)
    ext_ratio = None
    ext_year = None
    common = sorted(set(ext_debt) & set(reserves))
    if common and reserves[common[-1]] != 0:
        ext_year = common[-1]
        ext_ratio = ext_debt[ext_year] / reserves[ext_year] * _HUNDRED
    g_year, g_value = _latest(growth)
    w_year, w_value = _latest(wgi)
    stability = wgi_to_score(w_value) if w_value is not None else None

    inputs = SSIInputs(
        debt_to_gdp=debt_value,
        debt_to_gdp_3y_avg=_avg_last(debt),
        fiscal_balance_gdp=bal_value,
        fiscal_balance_change=bal_change,
        current_account_gdp=ca_value,
        reserves_months_imports=mo_value,
        external_debt_to_reserves_pct=ext_ratio,
        political_stability_score=stability,
        gdp_growth_latest=g_value,
        gdp_growth_3y_avg=_avg_last(growth),
    )
    ssi = compute_ssi(inputs, assumptions)
    currency = COUNTRY_CURRENCY.get(country)
    figures = [
        InputFigure("Central government debt, % of GDP", debt_value, debt_year),
        InputFigure(
            "Government net lending (+) / borrowing (-), % of GDP", bal_value, bal_year,
            f"change over 2 years: {bal_change:+.1f} pp" if bal_change is not None else "",
        ),
        InputFigure("Current account balance, % of GDP", ca_value, ca_year),
        InputFigure("Reserves, months of imports", mo_value, mo_year),
        InputFigure(
            "External debt / reserves, %", ext_ratio, ext_year,
            "" if ext_ratio is not None else "World Bank publishes external debt stocks for low/middle-income reporters only",
        ),
        InputFigure("Real GDP growth, % (latest actual, not a forecast)", g_value, g_year),
        InputFigure(
            "WGI political stability (estimate, -2.5..+2.5)", w_value, w_year,
            f"= {stability:.1f} on a 1-10 scale" if stability is not None else "",
        ),
    ]
    return CountryRisk(
        country=country,
        name=COUNTRY_NAMES.get(country, country),
        currency=currency,
        sdr_basket_currency=currency in SDR_BASKET_CURRENCIES,
        ssi=ssi,
        figures=figures,
        wgi_estimate=w_value,
        wgi_year=w_year,
        fetched_at=_newest_fetch(db, country),
    )


def describe_country_risk(risk: CountryRisk) -> str:
    """One evidence-item body. Every figure carries its data year."""
    parts: list[str] = []
    if risk.ssi.score is not None:
        parts.append(
            f"Sovereign Stress Index {risk.ssi.score}/100 ({risk.ssi.band}; higher = more stress; "
            f"{len(risk.ssi.components)} of 6 components, data quality {risk.ssi.data_quality}; "
            f"assumptions {risk.ssi.assumptions_version}; no crisis probability is estimated)."
        )
        comps = ", ".join(f"{k.replace('_', ' ')} {v:.0f}" for k, v in risk.ssi.components.items())
        parts.append(f"Component stress scores (0-100): {comps}.")
        if risk.ssi.missing:
            parts.append(f"Missing components: {', '.join(m.replace('_', ' ') for m in risk.ssi.missing)}.")
    else:
        parts.append("Sovereign Stress Index not computable: no World Bank inputs stored yet.")
    for fig in risk.figures:
        if fig.value is None:
            continue
        note = f"; {fig.note}" if fig.note else ""
        parts.append(f"{fig.label}: {fig.value:.2f} ({fig.data_year}{note}).")
    if risk.currency:
        basket = "is" if risk.sdr_basket_currency else "is not"
        parts.append(f"Currency {risk.currency} {basket} one of the IMF SDR basket reserve currencies.")
    return " ".join(parts)
