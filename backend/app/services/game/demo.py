"""Fabricated game state for demo mode (see app/services/settings/demo_mode.py).

Built only from the fixed synthetic demo portfolio plus fixed, invented
balance-sheet figures: the real database is never read, so nothing real can
leak into game mode while demo mode is on.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.domain.game_mapping import get_game_mapping
from app.schemas.game import GameStateOut
from app.services.game.rules import (
    ClusterFact,
    LandFacts,
    RiskFacts,
    ThesisFacts,
    WallFacts,
)
from app.services.game.state import AccountCash, GameInputs, build_game_state
from app.services.game.temperament import (
    DecisionFact,
    PositionStep,
    TemperamentInputs,
    TurnoverFact,
)
from app.services.settings.synthetic_data import (
    demo_accounts,
    demo_journal,
    demo_portfolio_overview,
    demo_thesis_monitor,
    demo_valuation_board,
)

D = Decimal

# Invented figures, one per demo ticker: (net debt, EBITDA, interest cover).
# Net debt -> negative means net cash. Chosen to show every wall material.
_DEMO_WALLS: dict[str, tuple[str, str, str]] = {
    "AAPL": ("-5000", "130000", "40"),
    "MSFT": ("-20000", "120000", "50"),
    "GOOGL": ("-60000", "100000", "80"),
    "JNJ": ("20000", "30000", "20"),
    "PG": ("90000", "20000", "25"),
    "KO": ("30000", "17000", "9"),
    "HD": ("48000", "20000", "2"),
    "XOM": ("5000", "70000", "30"),
}

# Invented betas for the Siege Simulator in demo mode (G13). Illustrative only;
# one demo ticker (V) is left out on purpose so the "not modelled" path shows.
DEMO_BETAS: dict[str, Decimal] = {
    "AAPL": D("1.20"), "MSFT": D("1.05"), "GOOGL": D("1.10"), "JNJ": D("0.55"),
    "PG": D("0.45"), "KO": D("0.55"), "JPM": D("1.15"), "HD": D("1.00"), "XOM": D("0.90"),
}

# Financial-sector demo names are judged on equity / total assets.
_DEMO_FINANCIALS: dict[str, tuple[str, str]] = {
    "JPM": ("320000", "3900000"),
    "V": ("38000", "90000"),
}


# Invented one-in-a-book stress losses (fractions, negative = a loss), chosen
# so the demo shows sheltered, exposed and breach-risk towers.
_DEMO_SHOCKS: dict[str, str] = {
    "AAPL": "-0.18", "MSFT": "-0.15", "GOOGL": "-0.22", "JNJ": "-0.10", "PG": "-0.12",
    "KO": "-0.09", "JPM": "-0.30", "V": "-0.14", "HD": "-0.45", "XOM": "-0.33",
}
_DEMO_CLUSTER = ("AAPL", "MSFT", "GOOGL")
# The invented demo board puts every name in one zone; these overrides make the
# demo show every kind of land. (zone, valuation status). XOM is fog: withheld.
_DEMO_LAND: dict[str, tuple[str, str]] = {
    "KO": ("below_bear", "ok"),
    "MSFT": ("base_to_bull", "ok"),
    "AAPL": ("above_bull", "ok"),
    "XOM": ("below_bear", "implausible"),
}
# Invented thesis states so game mode shows a review mark and a breach.
_DEMO_THESIS: dict[str, tuple[str, int]] = {"PG": ("review", 0), "HD": ("tripwire_fired", 1)}


def _demo_risk(overview, now: datetime) -> RiskFacts:
    by_ticker = {p.ticker: p for p in overview.positions}
    cluster_positions = [by_ticker[t] for t in _DEMO_CLUSTER if t in by_ticker]
    return RiskFacts(
        regime="baseline",
        regime_explanation="Demo data: an invented, calm macro backdrop.",
        regime_data_complete=True,
        portfolio_shock_pct=D("-0.27"),
        portfolio_drawdown_nok=None,
        snapshot_at=now - timedelta(days=1),
        holding_shocks={
            by_ticker[t].holding_id: (D(v), "volatility") for t, v in _DEMO_SHOCKS.items() if t in by_ticker
        },
        clusters=[
            ClusterFact(
                tickers=[p.ticker for p in cluster_positions],
                names=[p.name for p in cluster_positions],
                correlation=D("0.82"),
                combined_weight_pct=sum((p.weight_pct or D(0) for p in cluster_positions), D(0)),
            )
        ]
        if len(cluster_positions) > 1
        else [],
    )


def _demo_temperament(overview, now: datetime) -> TemperamentInputs:
    """The demo journal plus a few invented decisions, so the demo meter shows
    every kind of line (drains and restores) without touching real data."""
    by_ticker = {p.ticker: p for p in overview.positions}
    today = now.date()
    decisions = [
        DecisionFact(
            entry_id=e.id, holding_id=e.holding_id, ticker=e.ticker, name=e.company_name, action=e.action,
            decided_on=e.decided_on, verdict_at_decision=e.verdict_at_decision,
            has_invalidation=bool((e.invalidation or "").strip()),
            review_6m_written=bool((e.review_6m or "").strip()),
            review_12m_written=bool((e.review_12m or "").strip()),
        )
        for e in demo_journal().entries
    ]

    def invented(ticker: str, action: str, days_ago: int, *, verdict: str | None = "Hold", invalidation=True):
        p = by_ticker.get(ticker)
        if p is None:
            return
        decisions.append(
            DecisionFact(
                entry_id=None, holding_id=p.holding_id, ticker=ticker, name=p.name, action=action,
                decided_on=today - timedelta(days=days_ago), verdict_at_decision=verdict,
                has_invalidation=invalidation,
            )
        )

    invented("KO", "buy", 40, verdict="Buy", invalidation=False)  # drain: no invalidation written
    invented("HD", "trim", 20)  # restore: acted after the (invented) tripwire fired
    for days in (70, 45, 15):  # drain: churn
        invented("PG", "add" if days != 45 else "trim", days)
    steps = []
    jnj = by_ticker.get("JNJ")
    if jnj is not None:
        steps.append(
            PositionStep(
                holding_id=jnj.holding_id, name=jnj.name, from_at=now - timedelta(days=120),
                to_at=now - timedelta(days=30), quantity_before=D(40), quantity_after=D(40),
                price_before=D("170"), price_after=D("142"),
            )
        )
    fired = {by_ticker["HD"].holding_id: [now - timedelta(days=30)]} if "HD" in by_ticker else {}
    turnover = [
        TurnoverFact(
            account_name=demo_accounts()[0].name, from_at=now - timedelta(days=30), to_at=now - timedelta(days=2),
            positions_before=10, positions_after=10, added=0, removed=0, resized=2,
        )
    ]
    return TemperamentInputs(decisions=decisions, tripwire_fired_at=fired, steps=steps, turnover=turnover)


def demo_game_state(version: str) -> GameStateOut:
    overview = demo_portfolio_overview()
    walls: dict = {}
    for position in overview.positions:
        if position.ticker in _DEMO_FINANCIALS:
            equity, assets = _DEMO_FINANCIALS[position.ticker]
            walls[position.holding_id] = WallFacts(
                period="FY-DEMO", total_equity=D(equity), total_assets=D(assets)
            )
            continue
        row = _DEMO_WALLS.get(position.ticker)
        if row is None:
            continue
        net_debt, ebitda, cover = (D(x) for x in row)
        walls[position.holding_id] = WallFacts(
            period="FY-DEMO", net_debt=net_debt, ebitda=ebitda, interest_coverage=cover
        )
    now = datetime.now(timezone.utc)
    tickers = {p.holding_id: p.ticker for p in overview.positions}
    # The demo board stores margins as percent; the real board stores fractions.
    land = {}
    for r in demo_valuation_board().rows:
        zone, status = _DEMO_LAND.get(tickers.get(r.holding_id, ""), (r.zone, "ok"))
        land[r.holding_id] = LandFacts(
            zone=zone,
            valuation_status=status,
            margin_of_safety_base=(r.margin_of_safety_base / D(100)) if r.margin_of_safety_base is not None else None,
            unavailable_reason="Demo data: valuation withheld as not reliable." if status != "ok" else None,
        )
    thesis: dict = {}
    for row in demo_thesis_monitor().rows:
        status, fired = _DEMO_THESIS.get(tickers.get(row.holding_id, ""), (row.status, row.firing_count))
        thesis[row.holding_id] = ThesisFacts(status=status, firing_count=fired)
    inputs = GameInputs(
        overview=overview,
        wall_facts=walls,
        risk=_demo_risk(overview, now),
        land=land,
        land_snapshot_at=now - timedelta(days=1),
        thesis=thesis,
        temperament=_demo_temperament(overview, now),
        accounts=[
            AccountCash(
                cash_nok=D("180000"),
                cash_as_of=datetime.now(timezone.utc) - timedelta(days=3),
                account_id=demo_accounts()[0].id,
                name=demo_accounts()[0].name,
            )
        ],
        gold_oz=D("12"),
        silver_oz=D("150"),
        demo=True,
    )
    return build_game_state(inputs, get_game_mapping(version))


# --- Sprint 24 (2026-10-04): invented Chronicle, Ravens and Night Watch ---------


def demo_chronicle(version: str, rules_v) -> ChronicleOut:  # noqa: F821
    """Three invented stored frames built from the demo state, so the replay
    shows towers joining, a wall weakening and the weather turning. Never
    touches the database."""
    from app.services.game.chronicle import build_chronicle_from

    now = datetime.now(timezone.utc)
    today = demo_game_state(version)
    towers = list(today.towers)
    # 60 days ago: two fewer towers, calm weather.
    early = today.model_copy(update={"towers": towers[:-2]})
    # 30 days ago: all towers, one with better walls than today, weather gathering.
    middle_towers = [t.model_copy() for t in towers]
    if middle_towers:
        middle_towers[0] = middle_towers[0].model_copy(update={"wall": "granite", "weight_pct": (middle_towers[0].weight_pct or D(0)) + D(3)})
    siege_mid = today.siege.model_copy(update={"level": "gathering"}) if today.siege is not None else None
    middle = today.model_copy(update={"towers": middle_towers, "siege": siege_mid})
    stored = [
        ((now - timedelta(days=60)).date(), now - timedelta(days=60), early),
        ((now - timedelta(days=30)).date(), now - timedelta(days=30), middle),
        (now.date(), now, today),
    ]
    return build_chronicle_from(stored, [], rules_v, demo=True)


def demo_ravens(version: str, rules_v) -> RavensOut:  # noqa: F821
    from app.schemas.game import RavenLineOut, RavenOut, RavensOut

    now = datetime.now(timezone.utc)
    towers = demo_game_state(version).towers
    ravens: list[RavenOut] = []
    if towers:
        t = towers[0]
        lines = [
            RavenLineOut(metric="roic", label="Return on invested capital", previous=D("0.112"), current=D("0.140"),
                         direction="better", text="Return on invested capital rose from 11.2% to 14.0%."),
            RavenLineOut(metric="net_debt_to_ebitda", label="Net debt / EBITDA", previous=D("1.4"), current=D("2.1"),
                         direction="worse", text="Net debt / EBITDA rose from 1.4x to 2.1x."),
            RavenLineOut(metric="operating_margin", label="Operating margin", previous=D("0.21"), current=D("0.215"),
                         direction="steady", text="Operating margin held steady (21.0% to 21.5%)."),
        ]
        ravens.append(
            RavenOut(id=f"fig:{t.holding_id}:FY-DEMO", kind="figures", holding_id=t.holding_id, ticker=t.ticker,
                     name=t.name, in_portfolio=True, period="FY-DEMO", previous_period="FY-DEMO-1",
                     captured_at=now - timedelta(days=2), age_days=2, document_id=None,
                     summary="Against FY-DEMO-1: 1 better, 1 worse, 1 steady (invented demo figures).",
                     better=1, worse=1, lines=lines)
        )
    if len(towers) > 1:
        t = towers[1]
        ravens.append(
            RavenOut(id=f"doc:demo-{t.holding_id}", kind="text_only", holding_id=t.holding_id, ticker=t.ticker,
                     name=t.name, in_portfolio=True, period=None, previous_period=None,
                     captured_at=now - timedelta(days=5), age_days=5, document_id=None,
                     summary="A new half-year or interim report was captured. No figures were extracted from it "
                             "(it is read as text evidence only), so there is no comparison.",
                     better=0, worse=0, lines=[])
        )
    return RavensOut(rules_version=rules_v.version, demo=True, as_of=now, window_days=rules_v.raven_window_days,
                     ravens=ravens, notes=["Demo data: invented figures."])


def demo_night_watch(version: str, rules_v) -> NightWatchOut:  # noqa: F821
    from app.schemas.game import NightWatchFiredOut
    from app.services.game.night_watch import build_night_watch

    now = datetime.now(timezone.utc)
    towers = demo_game_state(version).towers
    firing = []
    if towers:
        t = towers[min(6, len(towers) - 1)]
        firing.append(NightWatchFiredOut(holding_id=t.holding_id, ticker=t.ticker, name=t.name,
                                         label="Net debt / EBITDA above 2.5x", metric="net_debt_to_ebitda",
                                         fired_at=now - timedelta(hours=5)))
    chronicle = demo_chronicle(version, rules_v)
    return build_night_watch(
        rules_v=rules_v, now=now, watch_last_at=now - timedelta(hours=6),
        watch_summary="Demo: 6 tripwire(s) on 4 holding(s), 1 newly fired, 0 cleared",
        snapshots_last_at=now - timedelta(hours=5), snapshots_summary="Demo: rebuilt risk, performance, board, watchlist",
        firing=firing, frame_days=[f.day for f in chronicle.frames],
        changes=[c for c in chronicle.changes if c.day == chronicle.frames[-1].day],
        ravens_landed=[r.name for r in demo_ravens(version, rules_v).ravens[:1]], demo=True,
    )
