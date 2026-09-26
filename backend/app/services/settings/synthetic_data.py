"""Fixed, fabricated demo-mode data (2026-09-26).

Every function here builds instances of the ACTUAL Pydantic response
models the real endpoints already return (imported from app/schemas/* and
app/domain/analysis_schema/*), never hand-rolled dicts - so fabricated
output is guaranteed to validate and serialize exactly like a real
response would, and can never silently drift from the real schema.

The data is a fixed set of ~10 well-known US large-cap stocks, fabricated
accounts/positions/valuations/verdicts/etc. built around them, entirely
made up - not read from anywhere. Every qualitative narrative field below
says so explicitly (DEMO_NOTE) so a screenshot can never be mistaken for
real analysis.

Nothing in this module ever touches the database or a live provider - it
is pure, deterministic, in-memory construction. The `db`/`market_data_
provider`/etc. arguments a real endpoint normally needs are simply not
accepted or used by the demo_* functions here; that is the whole point
(the real code path is skipped entirely, per app/api/*.py's demo checks).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.domain.analysis_schema.v1 import (
    BlindPassOutputV1,
    MoatAssessment,
    MoatSourceRating,
    NarrativeAssessment,
    ReconciliationOutputV1,
    VerdictContent,
)
from app.schemas.account import AccountOut
from app.schemas.analysis import (
    AnalysisQueueOut,
    AnalysisReadinessCheckOut,
    AnalysisReadinessOut,
    EquityAnalysisRunOut,
    EquityHoldingNoteOut,
    EvidenceItemOut,
)
from app.schemas.holding import HoldingOut
from app.schemas.journal import JournalEntryOut, JournalOut, JournalOutcomeOut
from app.schemas.macro import MacroIndicatorOut, MacroIndicatorsOut
from app.schemas.metrics import (
    HoldingMetricsOut,
    MarketContextOut,
    ShareCountOut,
)
from app.schemas.performance import (
    DailyValueOut,
    PortfolioPerformanceOut,
)
from app.schemas.portfolio import (
    AllocationSliceOut,
    OverviewAccountOut,
    OverviewConcentrationOut,
    OverviewPositionOut,
    PortfolioOverviewOut,
    RatingSliceOut,
    SummaryPointOut,
)
from app.schemas.precious_metals import (
    HoldingRowOut,
    MetalPriceHistoryOut,
    MetalSpotOut,
    PreciousMetalsOverviewOut,
    PricePointOut,
)
from app.schemas.risk import (
    ClusterFlagOut,
    CorrelationOut,
    CorrelationPairOut,
    HoldingStressOut,
    PortfolioRiskOut,
    RegimeInputOut,
    RegimeOut,
    StressOut,
)
from app.schemas.system import FreshnessItemOut, StatusItemOut, SystemStatusOut
from app.schemas.thesis import (
    HoldingThesisOut,
    MonitorOut,
    MonitorRowOut,
    TimelineEntryOut,
)
from app.schemas.valuation import (
    BoardRowOut,
    DCFOut,
    DCFScenarioOut,
    HoldingValuationOut,
    MarginOfSafetyBoardOut,
    PeriodMultiplesOut,
)
from app.schemas.watchlist import WatchlistOut, WatchlistRowOut

DEMO_NOTE = "Demo data — fabricated for demonstration purposes."

_NOW = datetime.now(timezone.utc)
_TODAY = _NOW.date()
_FX_USD_NOK = Decimal("10.55")


def _uuid(kind: str, n: int) -> uuid.UUID:
    """Deterministic, readable-in-logs fake UUIDs - stable across calls and
    across the whole demo dataset (so /holdings/{id}, /valuation/holdings/
    {id}, /analysis/holdings/{id}, etc. all agree on the same id for the
    same fabricated ticker)."""
    return uuid.UUID(f"{kind}0000000-0000-4000-8000-{n:012d}")


_HOLDING_KIND = "de111111-11"[: -2]  # unused placeholder removed below


def _d(x: str) -> Decimal:
    return Decimal(x)


def _margin(intrinsic: Decimal, price: Decimal) -> Decimal:
    return ((intrinsic - price) / intrinsic * Decimal(100)).quantize(Decimal("0.01"))


def _account_id(i: int) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"aladdin-demo:account:{i}")


def _holding_id(ticker: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"aladdin-demo:holding:{ticker}")


def _other_id(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"aladdin-demo:{kind}:{key}")


_RAW_ACCOUNTS = [
    {"name": "Demo Nordnet ASK", "number": "12340001"},
    {"name": "Demo Nordnet Investment", "number": "12340002"},
]

# Ten well-known US large-cap stocks, entirely fabricated positions/prices/
# verdicts — none of this is read from anywhere real.
_RAW_STOCKS = [
    {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology", "price": "227.50", "quantity": "120",
         "cost_basis": "165.00", "verdict": "Buy", "moat": "Wide", "bear": "190", "base": "260", "bull": "330",
         "discount_rate": "8.5", "account": 0},
    {"ticker": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "price": "430.20", "quantity": "60",
         "cost_basis": "310.00", "verdict": "Strong Buy", "moat": "Wide", "bear": "360", "base": "480", "bull": "600",
         "discount_rate": "8.0", "account": 0},
    {"ticker": "GOOGL", "name": "Alphabet Inc. Class A", "sector": "Technology", "price": "175.30", "quantity": "90",
         "cost_basis": "130.00", "verdict": "Buy", "moat": "Wide", "bear": "150", "base": "205", "bull": "260",
         "discount_rate": "8.5", "account": 0},
    {"ticker": "JNJ", "name": "Johnson & Johnson", "sector": "Health Care", "price": "158.40", "quantity": "80",
         "cost_basis": "150.00", "verdict": "Hold", "moat": "Wide", "bear": "140", "base": "170", "bull": "195",
         "discount_rate": "7.0", "account": 0},
    {"ticker": "PG", "name": "Procter & Gamble Co.", "sector": "Consumer Staples", "price": "167.90", "quantity": "70",
         "cost_basis": "145.00", "verdict": "Hold", "moat": "Wide", "bear": "150", "base": "180", "bull": "205",
         "discount_rate": "6.8", "account": 0},
    {"ticker": "KO", "name": "Coca-Cola Co.", "sector": "Consumer Staples", "price": "63.20", "quantity": "300",
         "cost_basis": "55.00", "verdict": "Buy", "moat": "Wide", "bear": "55", "base": "72", "bull": "85",
         "discount_rate": "6.5", "account": 1},
    {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financials", "price": "215.60", "quantity": "60",
         "cost_basis": "150.00", "verdict": "Buy", "moat": "Narrow", "bear": "180", "base": "240", "bull": "290",
         "discount_rate": "9.0", "account": 1},
    {"ticker": "V", "name": "Visa Inc. Class A", "sector": "Financials", "price": "279.10", "quantity": "50",
         "cost_basis": "220.00", "verdict": "Strong Buy", "moat": "Wide", "bear": "240", "base": "320", "bull": "390",
         "discount_rate": "8.0", "account": 1},
    {"ticker": "HD", "name": "Home Depot Inc.", "sector": "Consumer Discretionary", "price": "385.75", "quantity": "40",
         "cost_basis": "320.00", "verdict": "Hold", "moat": "Narrow", "bear": "330", "base": "400", "bull": "460",
         "discount_rate": "8.2", "account": 1},
    {"ticker": "XOM", "name": "Exxon Mobil Corp.", "sector": "Energy", "price": "118.35", "quantity": "150",
         "cost_basis": "105.00", "verdict": "Hold", "moat": "Narrow", "bear": "100", "base": "125", "bull": "150",
         "discount_rate": "9.5", "account": 1},
]


def _build_rows():
    total_usd = Decimal(0)
    for s in _RAW_STOCKS:
        total_usd += _d(s["price"]) * _d(s["quantity"])

    rows: list[dict] = []
    for s in _RAW_STOCKS:
        price = _d(s["price"])
        qty = _d(s["quantity"])
        value_usd = price * qty
        value_nok = (value_usd * _FX_USD_NOK).quantize(Decimal("0.01"))
        weight_pct = (value_usd / total_usd * Decimal(100)).quantize(Decimal("0.01"))
        account = _RAW_ACCOUNTS[s["account"]]
        rows.append(
            {
                "id": _holding_id(s["ticker"]),
                "ticker": s["ticker"],
                "name": s["name"],
                "sector": s["sector"],
                "price": price,
                "quantity": qty,
                "cost_basis": _d(s["cost_basis"]),
                "value_usd": value_usd,
                "value_nok": value_nok,
                "weight_pct": weight_pct,
                "verdict": s["verdict"],
                "moat": s["moat"],
                "bear": _d(s["bear"]),
                "base": _d(s["base"]),
                "bull": _d(s["bull"]),
                "discount_rate": _d(s["discount_rate"]),
                "account_index": s["account"],
                "account_id": _account_id(s["account"]),
                "account_name": account["name"],
            }
        )
    return rows, (total_usd * _FX_USD_NOK).quantize(Decimal("0.01"))


_ROWS, _TOTAL_VALUE_NOK = _build_rows()
_ROWS_BY_ID: dict[uuid.UUID, dict] = {r["id"]: r for r in _ROWS}
_ROWS_BY_TICKER: dict[str, dict] = {r["ticker"]: r for r in _ROWS}


def _account_row(i: int) -> dict:
    acc = _RAW_ACCOUNTS[i]
    members = [r for r in _ROWS if r["account_index"] == i]
    value_nok = sum((r["value_nok"] for r in members), Decimal(0))
    return {
        "id": _account_id(i),
        "name": acc["name"],
        "number": acc["number"],
        "value_nok": value_nok,
        "position_count": len(members),
    }


_ACCOUNT_ROWS = [_account_row(i) for i in range(len(_RAW_ACCOUNTS))]
_ACCOUNT_ROWS_BY_ID: dict[uuid.UUID, dict] = {a["id"]: a for a in _ACCOUNT_ROWS}


# --- Holdings ---------------------------------------------------------------


def _holding_out(row: dict) -> HoldingOut:
    return HoldingOut(
        id=row["id"],
        ticker=row["ticker"],
        name=row["name"],
        sector=row["sector"],
        trading_currency="USD",
        institution="Demo Broker",
        custody_type="nominee",
        asset_class_raw="stock",
        created_at=_NOW - timedelta(days=200),
        updated_at=_NOW - timedelta(days=1),
        document_count=0,
        position_count=1,
    )


def demo_holdings() -> list[HoldingOut]:
    return [_holding_out(r) for r in sorted(_ROWS, key=lambda r: r["ticker"])]


def demo_holding(holding_id: uuid.UUID) -> HoldingOut | None:
    row = _ROWS_BY_ID.get(holding_id)
    return _holding_out(row) if row else None


def demo_holding_periods(holding_id: uuid.UUID) -> list[str] | None:
    if holding_id not in _ROWS_BY_ID:
        return None
    return ["FY2025", "FY2024"]


def demo_holding_metrics(holding_id: uuid.UUID, period: str) -> HoldingMetricsOut | None:
    row = _ROWS_BY_ID.get(holding_id)
    if row is None:
        return None
    facts = {
        "revenue": _d("120000000000"),
        "net_income": _d("28000000000"),
        "total_equity": _d("70000000000"),
        "invested_capital": _d("95000000000"),
        "shares_outstanding": _d("15500000000"),
    }
    computed = {
        "return_on_equity": _d("18.50"),
        "return_on_invested_capital": _d("15.20"),
        "net_margin": _d("23.30"),
        "price_to_earnings": ((row["price"] * facts["shares_outstanding"]) / facts["net_income"]).quantize(
            Decimal("0.01")
        ),
    }
    market = MarketContextOut(
        price=row["price"],
        price_currency="USD",
        price_as_of=_NOW,
        fx_rate=_FX_USD_NOK,
        price_in_reporting_currency=row["price"],
        reporting_currency="USD",
        shares=ShareCountOut(
            shares=facts["shares_outstanding"],
            source="manual",
            source_label="Demo data",
            as_of=_NOW,
            warnings=[],
        ),
        unavailable_reason=None,
        stale_period=False,
    )
    return HoldingMetricsOut(
        holding_id=holding_id,
        period=period,
        facts=facts,
        computed=computed,
        skipped={},
        currency="USD",
        notes={"info": DEMO_NOTE},
        warnings=[],
        fact_details=[],
        prior_period=None,
        market=market,
    )


def demo_share_count(holding_id: uuid.UUID) -> ShareCountOut | None:
    if holding_id not in _ROWS_BY_ID:
        return None
    return ShareCountOut(
        shares=_d("15500000000"),
        source="manual",
        source_label="Demo data",
        as_of=_NOW,
        reference=None,
        note=DEMO_NOTE,
        override_id=None,
        eps_implied_low=None,
        eps_implied_high=None,
        warnings=[],
        unavailable_reason=None,
    )


# --- Accounts ----------------------------------------------------------------


def _account_out(row: dict) -> AccountOut:
    return AccountOut(
        id=row["id"],
        name=row["name"],
        account_number=row["number"],
        institution="Demo Broker",
        created_at=_NOW - timedelta(days=200),
        updated_at=_NOW - timedelta(days=1),
        position_count=row["position_count"],
        snapshot_count=1,
    )


def demo_accounts() -> list[AccountOut]:
    return [_account_out(a) for a in _ACCOUNT_ROWS]


def demo_account(account_id: uuid.UUID) -> AccountOut | None:
    row = _ACCOUNT_ROWS_BY_ID.get(account_id)
    return _account_out(row) if row else None


# --- Portfolio overview (Sprint 5 dashboard) --------------------------------


def demo_portfolio_overview() -> PortfolioOverviewOut:
    accounts = [
        OverviewAccountOut(
            account_id=a["id"],
            name=a["name"],
            value_nok=a["value_nok"],
            position_count=a["position_count"],
            snapshot_at=_NOW - timedelta(days=1),
            stale=False,
        )
        for a in _ACCOUNT_ROWS
    ]

    by_sector_map: dict[str, list[dict]] = {}
    for r in _ROWS:
        by_sector_map.setdefault(r["sector"], []).append(r)
    by_sector = [
        AllocationSliceOut(
            key=sector,
            label=sector,
            value_nok=sum((r["value_nok"] for r in rs), Decimal(0)),
            weight_pct=sum((r["weight_pct"] for r in rs), Decimal(0)),
            holding_count=len(rs),
        )
        for sector, rs in by_sector_map.items()
    ]

    verdict_map: dict[str, list[dict]] = {}
    moat_map: dict[str, list[dict]] = {}
    for r in _ROWS:
        verdict_map.setdefault(r["verdict"], []).append(r)
        moat_map.setdefault(r["moat"], []).append(r)

    weights_desc = sorted((r["weight_pct"] for r in _ROWS), reverse=True)
    hhi = sum((w * w for w in weights_desc), Decimal(0))

    positions = [
        OverviewPositionOut(
            holding_id=r["id"],
            ticker=r["ticker"],
            name=r["name"],
            instrument_type="stock",
            sector=r["sector"],
            trading_currency="USD",
            value_nok=r["value_nok"],
            weight_pct=r["weight_pct"],
            account_count=1,
            verdict_rating=r["verdict"],
            moat_rating=r["moat"],
            analyzed_at=_NOW - timedelta(days=2),
            analysis_stale=False,
        )
        for r in sorted(_ROWS, key=lambda r: r["weight_pct"], reverse=True)
    ]

    return PortfolioOverviewOut(
        as_of=_NOW,
        total_value_nok=_TOTAL_VALUE_NOK,
        equity_value_nok=_TOTAL_VALUE_NOK,
        holding_count=len(_ROWS),
        position_count=len(_ROWS),
        positions_missing_value=0,
        accounts=accounts,
        by_instrument_type=[
            AllocationSliceOut(
                key="stock", label="Stock", value_nok=_TOTAL_VALUE_NOK,
                weight_pct=Decimal("100.00"), holding_count=len(_ROWS),
            )
        ],
        by_sector=by_sector,
        by_currency=[
            AllocationSliceOut(
                key="USD", label="USD", value_nok=_TOTAL_VALUE_NOK,
                weight_pct=Decimal("100.00"), holding_count=len(_ROWS),
            )
        ],
        concentration=OverviewConcentrationOut(
            hhi=hhi,
            effective_holdings=(Decimal(10000) / hhi).quantize(Decimal("0.01")),
            top1_pct=weights_desc[0],
            top5_pct=sum(weights_desc[:5], Decimal(0)),
            top10_pct=sum(weights_desc[:10], Decimal(0)),
        ),
        verdicts=[
            RatingSliceOut(
                rating=v, holding_count=len(rs),
                value_nok=sum((r["value_nok"] for r in rs), Decimal(0)),
                weight_pct=sum((r["weight_pct"] for r in rs), Decimal(0)),
            )
            for v, rs in verdict_map.items()
        ],
        moats=[
            RatingSliceOut(
                rating=m, holding_count=len(rs),
                value_nok=sum((r["value_nok"] for r in rs), Decimal(0)),
                weight_pct=sum((r["weight_pct"] for r in rs), Decimal(0)),
            )
            for m, rs in moat_map.items()
        ],
        analyzed_equity_count=len(_ROWS),
        equity_count=len(_ROWS),
        analyzed_equity_value_pct=Decimal("100.00"),
        stale_analysis_count=0,
        positions=positions,
        summary=[
            SummaryPointOut(tone="info", text=DEMO_NOTE),
            SummaryPointOut(
                tone="neutral",
                text="Fabricated 10-holding US large-cap demo portfolio — not real brokerage data.",
            ),
        ],
    )


# --- Valuation ----------------------------------------------------------------


def _dcf_out(row: dict) -> DCFOut:
    return DCFOut(
        discount_rate=(row["discount_rate"] / Decimal(100)),
        terminal_growth_rate=Decimal("0.025"),
        scenarios=[
            DCFScenarioOut(
                label="bear", growth_rate=Decimal("0.02"),
                intrinsic_value_per_share=row["bear"], margin_of_safety=_margin(row["bear"], row["price"]),
            ),
            DCFScenarioOut(
                label="base", growth_rate=Decimal("0.05"),
                intrinsic_value_per_share=row["base"], margin_of_safety=_margin(row["base"], row["price"]),
            ),
            DCFScenarioOut(
                label="bull", growth_rate=Decimal("0.08"),
                intrinsic_value_per_share=row["bull"], margin_of_safety=_margin(row["bull"], row["price"]),
            ),
        ],
    )


def demo_valuation(holding_id: uuid.UUID) -> HoldingValuationOut | None:
    row = _ROWS_BY_ID.get(holding_id)
    if row is None:
        return None
    return HoldingValuationOut(
        holding_id=row["id"],
        ticker=row["ticker"],
        valuation_currency="USD",
        as_of=_NOW,
        base_growth_rate=Decimal("0.05"),
        discount_rate=row["discount_rate"] / Decimal(100),
        risk_free_rate_pct=Decimal("4.20"),
        beta=Decimal("1.05"),
        equity_risk_premium=Decimal("4.50"),
        current_price_per_share=row["price"],
        dcf=_dcf_out(row),
        reverse_dcf_implied_growth=Decimal("6.00"),
        multiples=[
            PeriodMultiplesOut(
                period="FY2025",
                matched_price_observed_at=_NOW,
                computed={"price_to_earnings": Decimal("22.50")},
                skipped={},
                notes=[DEMO_NOTE],
            )
        ],
        shares_outstanding=Decimal(15500000000),
        shares_source="manual",
        assumptions_version="demo",
        unavailable_reasons=[],
        base_discount_rate=row["discount_rate"] / Decimal(100),
        regime="neutral",
        regime_discount_rate_addon=Decimal("0.00"),
        regime_adjustments_version="demo",
    )


def demo_valuation_board() -> MarginOfSafetyBoardOut:
    rows: list[BoardRowOut] = []
    zone_counts: dict[str, int] = {}
    for r in sorted(_ROWS, key=lambda r: _margin(r["base"], r["price"]), reverse=True):
        margin_base = _margin(r["base"], r["price"])
        margin_bear = _margin(r["bear"], r["price"])
        zone = "buy_zone" if margin_base >= Decimal(15) else "fair_value" if margin_base >= Decimal(0) else "expensive"
        zone_counts[zone] = zone_counts.get(zone, 0) + 1
        rows.append(
            BoardRowOut(
                holding_id=r["id"], ticker=r["ticker"], name=r["name"], sector=r["sector"],
                market_value_nok=r["value_nok"], weight_pct=r["weight_pct"], valuation_currency="USD",
                price=r["price"], price_as_of=_NOW, bear=r["bear"], base=r["base"], bull=r["bull"],
                margin_of_safety_base=margin_base, margin_of_safety_bear=margin_bear, zone=zone,
                unavailable_reason=None, verdict_rating=r["verdict"], moat_rating=r["moat"],
                analyzed_at=_NOW - timedelta(days=2), regime="neutral",
                regime_discount_rate_addon=Decimal("0.00"),
            )
        )
    return MarginOfSafetyBoardOut(
        rows=rows, total_equity_value_nok=_TOTAL_VALUE_NOK, zone_counts=zone_counts
    )


# --- Analysis -------------------------------------------------------------


def _verdict_content(row: dict) -> VerdictContent:
    return VerdictContent(
        rating=row["verdict"],
        thesis_bullets=[DEMO_NOTE, f"Fabricated demo verdict for {row['ticker']} — not a real analysis."],
        top_risks=[DEMO_NOTE],
        metrics_to_monitor=["revenue_growth", "free_cash_flow"],
        invalidation_triggers=[DEMO_NOTE],
        evidence_ids=["demo-1"],
    )


def demo_analysis_run(holding_id: uuid.UUID) -> EquityAnalysisRunOut | None:
    row = _ROWS_BY_ID.get(holding_id)
    if row is None:
        return None
    verdict = _verdict_content(row)
    blind = BlindPassOutputV1(
        moat=MoatAssessment(
            circle_of_competence_summary=DEMO_NOTE,
            overall_rating=row["moat"],
            sources=[
                MoatSourceRating(source="brand", rating=row["moat"], reasoning=DEMO_NOTE, evidence_ids=["demo-1"]),
            ],
            evidence_ids=["demo-1"],
        ),
        capital_efficiency=NarrativeAssessment(summary=DEMO_NOTE, evidence_ids=["demo-1"]),
        financial_fortress=NarrativeAssessment(summary=DEMO_NOTE, evidence_ids=["demo-1"]),
        macro_stress_test=NarrativeAssessment(summary=DEMO_NOTE, evidence_ids=["demo-1"]),
        valuation_synthesis=NarrativeAssessment(summary=DEMO_NOTE, evidence_ids=["demo-1"]),
        verdict=verdict,
    )
    reconciliation = ReconciliationOutputV1(
        verdict=verdict, reconciliation_narrative=DEMO_NOTE, changed_from_blind=False,
        evidence_ids=["demo-1"],
    )
    return EquityAnalysisRunOut(
        id=_other_id("run", row["ticker"]),
        holding_id=row["id"],
        status="completed",
        schema_version="v1",
        blind_prompt_version="demo",
        reconciliation_prompt_version="demo",
        evidence_packet_version="demo",
        provider="demo",
        model_name="demo-fixture",
        started_at=_NOW - timedelta(hours=2),
        blind_completed_at=_NOW - timedelta(hours=1, minutes=30),
        completed_at=_NOW - timedelta(hours=1),
        error_message=None,
        evidence_unavailable_reasons=[],
        blind_pass=blind,
        blind_pass_citation_warnings=[],
        reconciliation=reconciliation,
        reconciliation_citation_warnings=[],
        price_target_low=row["bear"],
        price_target_high=row["bull"],
        price_target_currency="USD",
        evidence_items=[
            EvidenceItemOut(id="demo-1", category="fabricated", label="Demo evidence", content=DEMO_NOTE, citation=None)
        ],
        user_notes_snapshot=None,
        engine="cloud",
        queued_at=None,
        claimed_by=None,
        attempts=1,
    )


def demo_analysis_readiness(holding_id: uuid.UUID) -> AnalysisReadinessOut | None:
    if holding_id not in _ROWS_BY_ID:
        return None
    return AnalysisReadinessOut(
        holding_id=holding_id,
        ready=False,
        blockers=1,
        warnings=0,
        estimated_gemini_calls=0,
        gemini_calls_remaining_today=0,
        checks=[
            AnalysisReadinessCheckOut(
                key="demo_mode", label="Demo mode", status="block",
                detail="Analysis runs are disabled while demo mode is on.",
            )
        ],
    )


def demo_analysis_note(holding_id: uuid.UUID) -> EquityHoldingNoteOut | None:
    if holding_id not in _ROWS_BY_ID:
        return None
    return EquityHoldingNoteOut(holding_id=holding_id, content="", updated_at=None)


def demo_analysis_queue() -> AnalysisQueueOut:
    return AnalysisQueueOut(workers=[], any_worker_online=False, pending=[], recent=[])


# --- Thesis tracking --------------------------------------------------------


def demo_thesis(holding_id: uuid.UUID) -> HoldingThesisOut | None:
    row = _ROWS_BY_ID.get(holding_id)
    if row is None:
        return None
    return HoldingThesisOut(
        holding_id=row["id"],
        ticker=row["ticker"],
        name=row["name"],
        status="on_track",
        status_label="On track",
        analyzed_at=_NOW - timedelta(days=2),
        change_reasons=[],
        tripwires=[],
        timeline=[
            TimelineEntryOut(
                run_id=_other_id("run", row["ticker"]),
                date=_NOW - timedelta(days=2),
                verdict=row["verdict"],
                verdict_direction=None,
                moat=row["moat"],
                moat_direction=None,
                price=row["price"],
                price_currency="USD",
                dcf_low=row["bear"],
                dcf_high=row["bull"],
                pass_type="reconciliation",
                engine="cloud",
                model_name="demo-fixture",
                thesis_bullets=[DEMO_NOTE],
            )
        ],
        suggestions=[],
    )


def demo_thesis_monitor() -> MonitorOut:
    return MonitorOut(
        rows=[
            MonitorRowOut(
                holding_id=r["id"], ticker=r["ticker"], name=r["name"], status="on_track",
                status_label="On track", firing_count=0, change_reason_count=0,
                analyzed_at=_NOW - timedelta(days=2),
            )
            for r in sorted(_ROWS, key=lambda r: r["ticker"])
        ]
    )


# --- Portfolio risk (Sprint 12) ---------------------------------------------


def demo_risk() -> PortfolioRiskOut:
    tickers = [r["ticker"] for r in _ROWS]
    pairs = []
    fixed_correlations = {
        ("AAPL", "MSFT"): "0.62", ("AAPL", "GOOGL"): "0.58", ("MSFT", "GOOGL"): "0.65",
        ("JNJ", "PG"): "0.55", ("JPM", "V"): "0.60", ("KO", "PG"): "0.48",
    }
    for (a, b), corr in fixed_correlations.items():
        pairs.append(CorrelationPairOut(ticker_a=a, ticker_b=b, correlation=_d(corr), overlap_days=250))

    clusters = [
        ClusterFlagOut(
            tickers=["AAPL", "MSFT", "GOOGL"], names=["Apple Inc.", "Microsoft Corporation", "Alphabet Inc. Class A"],
            correlation=_d("0.62"),
            combined_weight_pct=sum(
                (r["weight_pct"] for r in _ROWS if r["ticker"] in ("AAPL", "MSFT", "GOOGL")), Decimal(0)
            ),
        )
    ]

    stress_holdings = [
        HoldingStressOut(
            holding_id=str(r["id"]), ticker=r["ticker"], name=r["name"], method="dcf_bear",
            value_nok=r["value_nok"], weight_pct=r["weight_pct"], shock_pct=_margin(r["price"], r["bear"]) * -1,
            contribution_nok=(r["value_nok"] * (r["bear"] - r["price"]) / r["price"]).quantize(Decimal("0.01")),
            reason=None,
        )
        for r in _ROWS
    ]
    total_drawdown = sum((h.contribution_nok for h in stress_holdings if h.contribution_nok), Decimal(0))

    return PortfolioRiskOut(
        as_of=_NOW,
        equity_value_nok=_TOTAL_VALUE_NOK,
        lookback_days=252,
        cluster_threshold=Decimal("0.60"),
        correlation=CorrelationOut(lookback_days=252, tickers=tickers, pairs=pairs, excluded=[]),
        clusters=clusters,
        stress=StressOut(
            std_devs=Decimal("2.00"),
            horizon_note=DEMO_NOTE,
            portfolio_shock_pct=(total_drawdown / _TOTAL_VALUE_NOK * Decimal(100)).quantize(Decimal("0.01")),
            portfolio_drawdown_nok=total_drawdown,
            total_value_considered_nok=_TOTAL_VALUE_NOK,
            holdings=stress_holdings,
        ),
        regime=RegimeOut(
            regime="neutral",
            home_market_series_included=True,
            curve_and_credit_are_us_only=True,
            explanation=DEMO_NOTE,
            method_note=DEMO_NOTE,
            inputs=[
                RegimeInputOut(
                    key="us_10y", label="US 10Y Treasury yield", region="US",
                    latest_value=Decimal("4.20"), smoothed_value=Decimal("4.10"), unit="pct",
                )
            ],
            data_complete=True,
            missing=[],
        ),
        price_history_notes=[DEMO_NOTE],
    )


# --- Portfolio performance (Sprint 13) --------------------------------------


def demo_performance() -> PortfolioPerformanceOut:
    days = 60
    series: list[DailyValueOut] = []
    start_value = _TOTAL_VALUE_NOK * Decimal("0.90")
    for i in range(days):
        on = _TODAY - timedelta(days=days - 1 - i)
        # Gentle, deterministic fabricated upward drift — not a real series.
        progress = Decimal(i) / Decimal(days - 1)
        value = (start_value + (_TOTAL_VALUE_NOK - start_value) * progress).quantize(Decimal("0.01"))
        prev = series[-1].portfolio_value_nok if series else None
        series.append(
            DailyValueOut(
                on=on, portfolio_value_nok=value, partial=False,
                portfolio_return_pct=(
                    ((value - prev) / prev * Decimal(100)).quantize(Decimal("0.01")) if prev else None
                ),
                daily_pnl_nok=(value - prev).quantize(Decimal("0.01")) if prev else None,
                benchmark_return_pct=None,
            )
        )
    best_day = max(series[1:], key=lambda d: d.daily_pnl_nok or Decimal(-999999999))
    worst_day = min(series[1:], key=lambda d: d.daily_pnl_nok or Decimal(999999999))
    total_return = ((series[-1].portfolio_value_nok - series[0].portfolio_value_nok) / series[0].portfolio_value_nok
                     * Decimal(100)).quantize(Decimal("0.01"))
    return PortfolioPerformanceOut(
        as_of=_NOW,
        lookback_days=days,
        equity_value_nok=_TOTAL_VALUE_NOK,
        included_value_nok=_TOTAL_VALUE_NOK,
        covered_pct=Decimal("100.00"),
        full_coverage_from=series[0].on,
        starting_value_nok=series[0].portfolio_value_nok,
        ending_value_nok=series[-1].portfolio_value_nok,
        total_return_pct=total_return,
        best_day=best_day,
        worst_day=worst_day,
        benchmark_ticker="^GSPC",
        benchmark_available=False,
        benchmark_reason=DEMO_NOTE,
        excluded=[],
        method_note=DEMO_NOTE,
        series=series,
    )


# --- Precious metals ---------------------------------------------------------


def demo_precious_metals_overview() -> PreciousMetalsOverviewOut:
    gold_price_usd = Decimal("2650.00")
    silver_price_usd = Decimal("31.20")
    gold_price_nok = (gold_price_usd * _FX_USD_NOK).quantize(Decimal("0.01"))
    silver_price_nok = (silver_price_usd * _FX_USD_NOK).quantize(Decimal("0.01"))

    gold_qty = Decimal(5)
    silver_qty = Decimal(50)
    gold_purchase_nok = Decimal("18000.00")
    silver_purchase_nok = Decimal("450.00")

    gold_value = (gold_qty * gold_price_nok).quantize(Decimal("0.01"))
    silver_value = (silver_qty * silver_price_nok).quantize(Decimal("0.01"))

    holdings = [
        HoldingRowOut(
            id=str(_other_id("metal", "gold")), coin_series="american_gold_eagle_1oz",
            coin_series_label="American Gold Eagle (1 oz)", metal="gold", quantity=gold_qty,
            purchase_date=_TODAY - timedelta(days=400), purchase_price_nok=gold_purchase_nok,
            storage_location="Demo safe deposit box", notes=DEMO_NOTE,
            value_nok=gold_value, unrealized_pnl_nok=(gold_value - gold_qty * gold_purchase_nok).quantize(Decimal("0.01")),
        ),
        HoldingRowOut(
            id=str(_other_id("metal", "silver")), coin_series="american_silver_eagle_1oz",
            coin_series_label="American Silver Eagle (1 oz)", metal="silver", quantity=silver_qty,
            purchase_date=_TODAY - timedelta(days=200), purchase_price_nok=silver_purchase_nok,
            storage_location="Demo safe deposit box", notes=DEMO_NOTE,
            value_nok=silver_value, unrealized_pnl_nok=(silver_value - silver_qty * silver_purchase_nok).quantize(Decimal("0.01")),
        ),
    ]
    return PreciousMetalsOverviewOut(
        as_of=_NOW,
        spots=[
            MetalSpotOut(metal="gold", available=True, price_nok_per_oz=gold_price_nok,
                          price_usd_per_oz=gold_price_usd, usd_nok_rate=_FX_USD_NOK, as_of=_NOW, reason=None),
            MetalSpotOut(metal="silver", available=True, price_nok_per_oz=silver_price_nok,
                          price_usd_per_oz=silver_price_usd, usd_nok_rate=_FX_USD_NOK, as_of=_NOW, reason=None),
        ],
        holdings=holdings,
        total_value_nok=(gold_value + silver_value).quantize(Decimal("0.01")),
        total_oz_by_metal={"gold": gold_qty, "silver": silver_qty},
    )


def demo_precious_metals_price_history(metal: str) -> MetalPriceHistoryOut | None:
    if metal not in ("gold", "silver"):
        return None
    base = Decimal("2650.00") if metal == "gold" else Decimal("31.20")
    points = []
    for i in range(30):
        on = _TODAY - timedelta(days=29 - i)
        drift = Decimal(i) * (Decimal("6.00") if metal == "gold" else Decimal("0.08"))
        price_nok = ((base + drift) * _FX_USD_NOK).quantize(Decimal("0.01"))
        points.append(PricePointOut(on=on, price_nok=price_nok))
    return MetalPriceHistoryOut(metal=metal, points=points, method_note=DEMO_NOTE)


# --- Journal -----------------------------------------------------------------


def _journal_outcome(latest_price: Decimal, decision_price: Decimal) -> JournalOutcomeOut:
    return_pct = ((latest_price - decision_price) / decision_price * Decimal(100)).quantize(Decimal("0.01"))
    return JournalOutcomeOut(
        days_since=180, latest_price=latest_price, latest_price_at=_NOW, return_pct=return_pct,
        in_favour=return_pct >= 0, price_6m=None, return_6m_pct=None, price_12m=None, return_12m_pct=None,
        review_6m_due=False, review_12m_due=False, note=DEMO_NOTE,
    )


def demo_journal() -> JournalOut:
    aapl = _ROWS_BY_TICKER["AAPL"]
    msft = _ROWS_BY_TICKER["MSFT"]
    xom = _ROWS_BY_TICKER["XOM"]
    entries = [
        JournalEntryOut(
            id=_other_id("journal", "1"), holding_id=aapl["id"], ticker="AAPL", company_name=aapl["name"],
            action="buy", decided_on=_TODAY - timedelta(days=180), price=Decimal("190.00"), currency="USD",
            quantity=Decimal(50), thesis=f"{DEMO_NOTE} Bought into strength ahead of a new product cycle.",
            invalidation=f"{DEMO_NOTE} Would exit if margins compress materially.", confidence=4,
            verdict_at_decision="Buy", review_6m=None, review_12m=None,
            created_at=_NOW - timedelta(days=180), updated_at=_NOW - timedelta(days=180),
            outcome=_journal_outcome(aapl["price"], Decimal("190.00")),
        ),
        JournalEntryOut(
            id=_other_id("journal", "2"), holding_id=msft["id"], ticker="MSFT", company_name=msft["name"],
            action="add", decided_on=_TODAY - timedelta(days=90), price=Decimal("390.00"), currency="USD",
            quantity=Decimal(20), thesis=f"{DEMO_NOTE} Added on cloud growth reacceleration.",
            invalidation=f"{DEMO_NOTE} Would exit on sustained cloud deceleration.", confidence=5,
            verdict_at_decision="Strong Buy", review_6m=None, review_12m=None,
            created_at=_NOW - timedelta(days=90), updated_at=_NOW - timedelta(days=90),
            outcome=_journal_outcome(msft["price"], Decimal("390.00")),
        ),
        JournalEntryOut(
            id=_other_id("journal", "3"), holding_id=xom["id"], ticker="XOM", company_name=xom["name"],
            action="trim", decided_on=_TODAY - timedelta(days=300), price=Decimal("110.00"), currency="USD",
            quantity=Decimal(30), thesis=f"{DEMO_NOTE} Trimmed after a strong run to rebalance.",
            invalidation=None, confidence=3, verdict_at_decision="Hold", review_6m=DEMO_NOTE, review_12m=None,
            created_at=_NOW - timedelta(days=300), updated_at=_NOW - timedelta(days=120),
            outcome=_journal_outcome(xom["price"], Decimal("110.00")),
        ),
    ]
    return JournalOut(entries=entries, reviews_due=0)


# --- Watchlist -----------------------------------------------------------------


_WATCHLIST_RAW = [
    {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "price": "135.00", "buy_below": "150.00",
         "base": "160.00", "verdict": "Buy", "moat": "Wide", "status": "buy_zone"},
    {"ticker": "COST", "name": "Costco Wholesale Corporation", "sector": "Consumer Staples", "price": "930.00",
         "buy_below": "850.00", "base": "800.00", "verdict": "Hold", "moat": "Wide", "status": "above"},
]


def _watchlist_row(w: dict) -> WatchlistRowOut:
    price = _d(w["price"])
    buy_below = _d(w["buy_below"])
    base = _d(w["base"])
    return WatchlistRowOut(
        id=_other_id("watchlist", w["ticker"]),
        holding_id=_other_id("watchlist-holding", w["ticker"]),
        ticker=w["ticker"], name=w["name"], sector=w["sector"], instrument_type="stock", owned=False,
        buy_below_price=buy_below, buy_below_currency="USD", notes=DEMO_NOTE,
        added_at=_NOW - timedelta(days=60), price=price, price_currency="USD", price_as_of=_NOW,
        distance_to_buy_pct=((price - buy_below) / buy_below * Decimal(100)).quantize(Decimal("0.01")),
        status=w["status"], dcf_base=base, margin_of_safety_base=_margin(base, price),
        verdict_rating=w["verdict"], moat_rating=w["moat"], analyzed_at=_NOW - timedelta(days=3),
        unavailable_reason=None,
    )


def demo_watchlist() -> WatchlistOut:
    rows = [_watchlist_row(w) for w in _WATCHLIST_RAW]
    return WatchlistOut(rows=rows, buy_zone_count=sum(1 for r in rows if r.status == "buy_zone"))


def demo_watchlist_for_holding(holding_id: uuid.UUID) -> WatchlistRowOut | None:
    for w in _WATCHLIST_RAW:
        if _other_id("watchlist-holding", w["ticker"]) == holding_id:
            return _watchlist_row(w)
    return None


# --- Macro ---------------------------------------------------------------


def demo_macro_indicators() -> MacroIndicatorsOut:
    def indicator(key, label, region, group, unit, value, prior) -> MacroIndicatorOut:
        return MacroIndicatorOut(
            key=key, label=label, region=region, group=group, display_unit=unit, frequency="monthly",
            change_kind="level", description=DEMO_NOTE, source_name="Demo data", source_series_id="demo",
            source_url="https://example.com/demo", derived=False, value=_d(value),
            observed_on=_TODAY - timedelta(days=15), value_3m_ago=_d(prior), change_3m=(_d(value) - _d(prior)).quantize(Decimal("0.01")),
            value_12m_ago=_d(prior), change_12m=(_d(value) - _d(prior)).quantize(Decimal("0.01")), stale=False,
            age_days=15, formula=None, last_success_at=_NOW, last_error=None, history=[],
        )

    indicators = [
        indicator("fed_funds_rate", "Fed Funds Rate", "US", "rates", "pct", "4.50", "4.75"),
        indicator("cpi_yoy", "CPI (YoY)", "US", "inflation", "pct", "2.80", "3.10"),
        indicator("us_10y", "US 10Y Treasury Yield", "US", "rates", "pct", "4.20", "4.35"),
        indicator("unemployment", "Unemployment Rate", "US", "labor", "pct", "4.10", "4.00"),
    ]
    return MacroIndicatorsOut(
        series_version="demo", fetching_enabled=False, last_success_at=_NOW,
        indicators=indicators, derived=[],
    )


# --- System status -----------------------------------------------------------


def demo_system_status() -> SystemStatusOut:
    return SystemStatusOut(
        generated_at=_NOW, version="demo", environment="demo", commit=None,
        database_ok=True, database_dialect="demo", migration_current="demo", migration_head="demo",
        providers=[
            StatusItemOut(key="demo_mode", label="Demo mode", status="warn", value="ON", detail=DEMO_NOTE),
        ],
        llm_daily_limit=0, llm_calls_remaining_today=0,
        freshness=[
            FreshnessItemOut(key="demo", label="Demo data", last_at=_NOW, status="off", detail=DEMO_NOTE),
        ],
        analysis=[
            StatusItemOut(key="demo_mode", label="Demo mode", status="warn", value="ON", detail=DEMO_NOTE),
        ],
        counts={"holdings": len(_ROWS), "accounts": len(_ACCOUNT_ROWS)},
        issues=[],
        demo_mode=True,
    )
