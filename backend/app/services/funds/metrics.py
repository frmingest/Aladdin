"""Every fund / ETF number, computed in Python (Sprint 8, F9 — CLAUDE.md
Rule 1). Read-only: no network, market-data or LLM call, so the fund
section of the holding page loads instantly and the evidence packet is
cheap to build.

What is computed, and how:

- Cost: the ongoing charge compounds. Share of ending wealth lost to fees
  over n years = 1 − (1 − fee)^n (10 and 20 years), plus the yearly fee in
  NOK on the position actually held.
- Track record: per reported period, fund minus benchmark in percentage
  points. Cumulative multi-year figures are annualised as
  (1 + r)^(1/years) − 1 when the period length is known. For an index fund
  the gap is the *tracking difference* (the real cost); for an active fund
  it is the manager's *excess return*.
- Concentration of the latest holdings snapshot: number of rows, top-10
  and largest weight, coverage (sum of known weights), HHI on the known
  weights (a lower bound when coverage is partial: the unlisted rest can
  only add to it) and, for a complete list only, the effective number of
  holdings = 10 000 / HHI.
- Exposure splits (sector / country / currency) as given, plus the share
  outside NOK.
- Look-through: for fund holdings linked to a Holding with financial facts
  in the app, the weight-averaged latest ROE, operating margin and
  net debt / EBITDA, each with its coverage (the fund weight it rests
  on); and the moat / verdict mix of linked holdings already analysed.
- Overlap: for linked holdings also owned directly, the NOK exposure held
  through the fund (fund position value × weight) next to the direct one.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal, localcontext

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.period_dates import extract_year
from app.models.financial_line_item import FinancialLineItem
from app.models.fund import FundExposure, FundProfile, FundReturnPeriod
from app.models.holding import Holding
from app.services import calculations
from app.services.analysis.latest import latest_runs_by_holding, run_ratings
from app.services.funds.facts import get_profile, latest_exposures, list_returns
from app.services.metrics import compute_holding_metrics, ordinary_equity

HUNDRED = Decimal(100)
ZERO = Decimal(0)
FEE_DRAG_YEARS = (10, 20)
TOP_N = 10
COMPLETE_COVERAGE_PCT = Decimal(95)
"""A holdings snapshot covering at least this share of the fund counts as
the full list (HHI and effective number are then real, not bounds)."""
ONE_YEAR_KINDS = ("calendar_year", "rolling_12m")
HOME_CURRENCY = "NOK"


def _q(value: Decimal, places: str = "0.01") -> Decimal:
    return value.quantize(Decimal(places))


class CostMetrics(BaseModel):
    ongoing_charge_pct: Decimal | None
    fee_drag_pct: dict[int, Decimal]
    """Years -> % of ending wealth lost to the ongoing charge."""
    yearly_fee_nok: Decimal | None
    """Ongoing charge in NOK per year on the position held (None if not owned)."""


class ReturnRow(BaseModel):
    id: uuid.UUID
    period_kind: str
    period_label: str
    fund_return_pct: Decimal
    benchmark_return_pct: Decimal | None
    benchmark_name: str | None
    difference_pp: Decimal | None
    fund_annualised_pct: Decimal | None
    benchmark_annualised_pct: Decimal | None
    annualised_difference_pp: Decimal | None


class TrackRecord(BaseModel):
    gap_label: str
    """"excess return" (active) or "tracking difference" (index)."""
    rows: list[ReturnRow]
    one_year_periods_compared: int
    one_year_periods_beaten: int
    average_one_year_difference_pp: Decimal | None
    longest_period_label: str | None
    longest_period_annualised_difference_pp: Decimal | None


class WeightRow(BaseModel):
    label: str
    weight_pct: Decimal


class Concentration(BaseModel):
    as_of_date: date | None
    rows_known: int
    stated_holdings_count: int | None
    coverage_pct: Decimal | None
    complete: bool
    top10_pct: Decimal | None
    largest: WeightRow | None
    hhi: Decimal | None
    """Over the known weights; a lower bound unless `complete`."""
    effective_holdings: Decimal | None
    """10 000 / HHI — only for a complete list (a partial one gives no useful bound)."""


class ExposureSplit(BaseModel):
    dimension: str
    as_of_date: date | None
    rows: list[WeightRow]
    total_pct: Decimal


class LookThroughHolding(BaseModel):
    exposure_id: uuid.UUID
    label: str
    weight_pct: Decimal
    linked_holding_id: uuid.UUID | None
    linked_ticker: str | None
    link_method: str | None
    latest_period: str | None
    roe_pct: Decimal | None
    operating_margin_pct: Decimal | None
    net_debt_to_ebitda: Decimal | None
    moat_rating: str | None
    verdict_rating: str | None
    direct_value_nok: Decimal | None
    through_fund_value_nok: Decimal | None


class WeightedMetric(BaseModel):
    key: str
    label: str
    value: Decimal | None
    coverage_pct: Decimal
    """Fund weight the average rests on."""
    holdings_used: int


class LookThrough(BaseModel):
    holdings: list[LookThroughHolding]
    linked_weight_pct: Decimal
    with_financials_weight_pct: Decimal
    metrics: list[WeightedMetric]
    moat_mix: dict[str, Decimal]
    """Moat rating -> fund weight % among linked holdings with an analysis."""
    verdict_mix: dict[str, Decimal]


class Overlap(BaseModel):
    fund_value_nok: Decimal | None
    rows: list[LookThroughHolding]
    total_through_fund_nok: Decimal | None


class FundMetrics(BaseModel):
    cost: CostMetrics
    track_record: TrackRecord
    concentration: Concentration
    exposures: list[ExposureSplit]
    foreign_currency_pct: Decimal | None
    look_through: LookThrough
    overlap: Overlap
    gaps: list[str]
    """What could not be computed and why — shown, never hidden."""


# --- cost -----------------------------------------------------------------


def fee_drag_pct(ongoing_charge_pct: Decimal, years: int) -> Decimal:
    """1 − (1 − fee)^years, in percent."""
    remaining = (Decimal(1) - ongoing_charge_pct / HUNDRED) ** years
    return _q((Decimal(1) - remaining) * HUNDRED)


# --- track record ---------------------------------------------------------


def annualise_pct(cumulative_pct: Decimal, years: Decimal) -> Decimal | None:
    """(1 + r)^(1/years) − 1, in percent. None for a total loss or no length."""
    if years <= 0:
        return None
    growth = Decimal(1) + cumulative_pct / HUNDRED
    if growth <= 0:
        return None
    with localcontext() as ctx:
        ctx.prec = 28
        return _q((growth ** (Decimal(1) / years) - Decimal(1)) * HUNDRED)


def _annualised(row: FundReturnPeriod, value: Decimal | None) -> Decimal | None:
    if value is None:
        return None
    if row.annualised or row.period_kind in ONE_YEAR_KINDS:
        return value
    if row.years is not None:
        return annualise_pct(value, row.years)
    return None


def compute_track_record(profile: FundProfile | None, periods: list[FundReturnPeriod]) -> TrackRecord:
    gap_label = "tracking difference" if profile and profile.management_style == "index" else "excess return"
    rows: list[ReturnRow] = []
    for p in periods:
        fund_ann = _annualised(p, p.fund_return_pct)
        bench_ann = _annualised(p, p.benchmark_return_pct)
        rows.append(
            ReturnRow(
                id=p.id,
                period_kind=p.period_kind,
                period_label=p.period_label,
                fund_return_pct=p.fund_return_pct,
                benchmark_return_pct=p.benchmark_return_pct,
                benchmark_name=p.benchmark_name,
                difference_pp=(
                    _q(p.fund_return_pct - p.benchmark_return_pct) if p.benchmark_return_pct is not None else None
                ),
                fund_annualised_pct=fund_ann,
                benchmark_annualised_pct=bench_ann,
                annualised_difference_pp=(
                    _q(fund_ann - bench_ann) if fund_ann is not None and bench_ann is not None else None
                ),
            )
        )
    yearly = [r for r in rows if r.period_kind in ONE_YEAR_KINDS and r.difference_pp is not None]
    beaten = sum(1 for r in yearly if r.difference_pp is not None and r.difference_pp > 0)
    average = _q(sum((r.difference_pp or ZERO for r in yearly), ZERO) / len(yearly)) if yearly else None

    longest_label = None
    longest_diff = None
    multi = [
        (p, r)
        for p, r in zip(periods, rows, strict=True)
        if r.annualised_difference_pp is not None and p.period_kind in ("trailing", "since_inception")
    ]
    if multi:
        p, r = max(multi, key=lambda pr: (pr[0].years or ZERO, pr[0].period_kind == "since_inception"))
        longest_label, longest_diff = r.period_label, r.annualised_difference_pp
    return TrackRecord(
        gap_label=gap_label,
        rows=rows,
        one_year_periods_compared=len(yearly),
        one_year_periods_beaten=beaten,
        average_one_year_difference_pp=average,
        longest_period_label=longest_label,
        longest_period_annualised_difference_pp=longest_diff,
    )


# --- concentration and splits --------------------------------------------


def compute_concentration(
    as_of: date | None, rows: list[FundExposure], stated_count: int | None
) -> Concentration:
    if not rows:
        return Concentration(
            as_of_date=None, rows_known=0, stated_holdings_count=stated_count, coverage_pct=None,
            complete=False, top10_pct=None, largest=None, hhi=None, effective_holdings=None,
        )
    weights = sorted((r.weight_pct for r in rows), reverse=True)
    coverage = sum(weights, ZERO)
    hhi = calculations.herfindahl_hirschman_index(weights)
    largest = max(rows, key=lambda r: r.weight_pct)
    complete = coverage >= COMPLETE_COVERAGE_PCT
    return Concentration(
        as_of_date=as_of,
        rows_known=len(rows),
        stated_holdings_count=stated_count,
        coverage_pct=_q(coverage),
        complete=complete,
        top10_pct=_q(sum(weights[:TOP_N], ZERO)),
        largest=WeightRow(label=largest.label, weight_pct=largest.weight_pct),
        hhi=_q(hhi, "1"),
        effective_holdings=_q(Decimal(10000) / hhi, "0.1") if complete and hhi > 0 else None,
    )


def _split(dimension: str, as_of: date | None, rows: list[FundExposure]) -> ExposureSplit:
    return ExposureSplit(
        dimension=dimension,
        as_of_date=as_of,
        rows=[WeightRow(label=r.label, weight_pct=r.weight_pct) for r in rows],
        total_pct=_q(sum((r.weight_pct for r in rows), ZERO)),
    )


# --- look-through and overlap --------------------------------------------


def _latest_company_metrics(db: Session, holding_id: uuid.UUID) -> tuple[str | None, dict[str, Decimal]]:
    facts_by_period: dict[str, dict[str, Decimal]] = {}
    for item in db.scalars(select(FinancialLineItem).where(FinancialLineItem.holding_id == holding_id)):
        facts_by_period.setdefault(item.period, {})[item.metric] = item.value
    dated = [(extract_year(p), p) for p in facts_by_period]
    dated = [(y, p) for y, p in dated if y is not None]
    if not dated:
        return None, {}
    _year, period = max(dated)
    facts = facts_by_period[period]
    result = compute_holding_metrics(facts)
    out: dict[str, Decimal] = {}
    for key in ("operating_margin", "net_debt_to_ebitda"):
        if key in result.computed:
            out[key] = result.computed[key]
    equity = ordinary_equity(facts)
    if "net_income" in facts and equity is not None and equity > 0:
        try:
            out["roe"] = calculations.roe(facts["net_income"], equity)
        except ValueError:
            pass
    return period, out


_WEIGHTED = (
    ("roe", "ROE (latest year)", True),
    ("operating_margin", "Operating margin (latest year)", True),
    ("net_debt_to_ebitda", "Net debt / EBITDA (latest year)", False),
)


def _position_values(db: Session) -> dict[uuid.UUID, Decimal]:
    from app.services.valuation.board import current_positions  # avoid an import cycle

    values: dict[uuid.UUID, Decimal] = {}
    for position in current_positions(db):
        if position.market_value_nok is not None:
            values[position.holding_id] = values.get(position.holding_id, ZERO) + position.market_value_nok
    return values


def compute_look_through(
    db: Session, rows: list[FundExposure], fund_value_nok: Decimal | None, position_values: dict[uuid.UUID, Decimal]
) -> LookThrough:
    linked_ids = [r.linked_holding_id for r in rows if r.linked_holding_id is not None]
    linked = {h.id: h for h in db.scalars(select(Holding).where(Holding.id.in_(linked_ids)))} if linked_ids else {}
    runs = latest_runs_by_holding(db, list(linked))
    holdings: list[LookThroughHolding] = []
    for row in rows:
        target = linked.get(row.linked_holding_id) if row.linked_holding_id else None
        period, company = _latest_company_metrics(db, target.id) if target else (None, {})
        verdict = moat = None
        if target and target.id in runs:
            verdict, moat, _at = run_ratings(runs[target.id])
        direct = position_values.get(target.id) if target else None
        holdings.append(
            LookThroughHolding(
                exposure_id=row.id,
                label=row.label,
                weight_pct=row.weight_pct,
                linked_holding_id=target.id if target else None,
                linked_ticker=target.ticker if target else None,
                link_method=row.link_method if target else None,
                latest_period=period,
                roe_pct=_q(company["roe"] * HUNDRED) if "roe" in company else None,
                operating_margin_pct=(
                    _q(company["operating_margin"] * HUNDRED) if "operating_margin" in company else None
                ),
                net_debt_to_ebitda=_q(company["net_debt_to_ebitda"]) if "net_debt_to_ebitda" in company else None,
                moat_rating=moat,
                verdict_rating=verdict,
                direct_value_nok=_q(direct) if direct is not None else None,
                through_fund_value_nok=(
                    _q(fund_value_nok * row.weight_pct / HUNDRED) if fund_value_nok is not None else None
                ),
            )
        )

    metrics: list[WeightedMetric] = []
    for key, label, is_pct in _WEIGHTED:
        attr = {"roe": "roe_pct", "operating_margin": "operating_margin_pct"}.get(key, key)
        used = [(h.weight_pct, getattr(h, attr)) for h in holdings if getattr(h, attr) is not None]
        weight = sum((w for w, _v in used), ZERO)
        value = _q(sum((w * v for w, v in used), ZERO) / weight) if weight > 0 else None
        metrics.append(
            WeightedMetric(
                key=key, label=label + (" %" if is_pct else ""), value=value, coverage_pct=_q(weight),
                holdings_used=len(used),
            )
        )

    moat_mix: dict[str, Decimal] = {}
    verdict_mix: dict[str, Decimal] = {}
    for h in holdings:
        if h.moat_rating:
            moat_mix[h.moat_rating] = _q(moat_mix.get(h.moat_rating, ZERO) + h.weight_pct)
        if h.verdict_rating:
            verdict_mix[h.verdict_rating] = _q(verdict_mix.get(h.verdict_rating, ZERO) + h.weight_pct)

    financial_weight = sum(
        (h.weight_pct for h in holdings if h.roe_pct is not None or h.operating_margin_pct is not None), ZERO
    )
    return LookThrough(
        holdings=holdings,
        linked_weight_pct=_q(sum((h.weight_pct for h in holdings if h.linked_holding_id), ZERO)),
        with_financials_weight_pct=_q(financial_weight),
        metrics=metrics,
        moat_mix=moat_mix,
        verdict_mix=verdict_mix,
    )


# --- everything ------------------------------------------------------------


def compute_fund_metrics(db: Session, fund: Holding) -> FundMetrics:
    profile = get_profile(db, fund.id)
    periods = list_returns(db, fund.id)
    gaps: list[str] = []

    position_values = _position_values(db)
    fund_value = position_values.get(fund.id)

    ocf = profile.ongoing_charge_pct if profile else None
    cost = CostMetrics(
        ongoing_charge_pct=ocf,
        fee_drag_pct={n: fee_drag_pct(ocf, n) for n in FEE_DRAG_YEARS} if ocf is not None else {},
        yearly_fee_nok=_q(fund_value * ocf / HUNDRED) if ocf is not None and fund_value is not None else None,
    )
    if profile is None:
        gaps.append("no fund profile yet: management style, benchmark and ongoing charge unknown")
    elif ocf is None:
        gaps.append("ongoing charge not entered: fee drag not computed")

    track = compute_track_record(profile, periods)
    if not periods:
        gaps.append("no reported returns entered: track record not computed")
    elif not any(r.difference_pp is not None for r in track.rows):
        gaps.append("no benchmark returns entered: excess return / tracking difference not computed")

    as_of, holding_rows = latest_exposures(db, fund.id, "holding")
    concentration = compute_concentration(as_of, holding_rows, profile.holdings_count if profile else None)
    if not holding_rows:
        gaps.append("no holdings entered or imported: no look-through, concentration or overlap")
    elif not concentration.complete:
        gaps.append(
            f"holdings cover {concentration.coverage_pct} % of the fund: HHI is a lower bound, no effective "
            "number of holdings, and the look-through covers only the listed part"
        )

    splits: list[ExposureSplit] = []
    for dimension in ("sector", "country", "currency"):
        dim_as_of, dim_rows = latest_exposures(db, fund.id, dimension)
        if dim_rows:
            splits.append(_split(dimension, dim_as_of, dim_rows))
    currency = next((s for s in splits if s.dimension == "currency"), None)
    foreign = None
    if currency is not None and currency.total_pct > 0:
        home = sum((r.weight_pct for r in currency.rows if r.label.strip().upper() == HOME_CURRENCY), ZERO)
        foreign = _q((currency.total_pct - home) * HUNDRED / currency.total_pct)

    look = compute_look_through(db, holding_rows, fund_value, position_values)
    if holding_rows and look.with_financials_weight_pct == 0:
        gaps.append(
            "no fund holding is linked to a company with financial facts in the app: look-through ROE / "
            "margins not computed (add the largest holdings as holdings and upload their reports)"
        )
    overlap_rows = [h for h in look.holdings if h.direct_value_nok]
    overlap = Overlap(
        fund_value_nok=_q(fund_value) if fund_value is not None else None,
        rows=overlap_rows,
        total_through_fund_nok=(
            _q(sum((h.through_fund_value_nok or ZERO for h in overlap_rows), ZERO)) if fund_value is not None else None
        ),
    )
    return FundMetrics(
        cost=cost,
        track_record=track,
        concentration=concentration,
        exposures=splits,
        foreign_currency_pct=foreign,
        look_through=look,
        overlap=overlap,
        gaps=gaps,
    )
