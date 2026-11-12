"""Fabricated game state for demo mode (see app/services/settings/demo_mode.py).

Built only from the fixed synthetic demo portfolio plus fixed, invented
balance-sheet figures: the real database is never read, so nothing real can
leak into game mode while demo mode is on.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.domain.game_mapping import get_game_mapping
from app.schemas.game import GameStateOut, NightWatchOut, RavensOut
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
    demo_ticker_slots,
    demo_valuation_board,
)

D = Decimal

# Invented per-stock facts are attached to a SLOT (the stock's position, 0-6, in the demo portfolio), not to a
# ticker: the demo stocks are drawn at random from the watchlist each time demo mode is switched on, so any
# ticker can sit in any slot. The slots are chosen so the demo still shows every kind of tower.

# (net debt, EBITDA, interest cover) per slot. Negative net debt means net cash. Slot 6 is judged as a
# financial instead (below). Chosen to show every wall material.
_DEMO_WALLS: dict[int, tuple[str, str, str]] = {
    0: ("-5000", "130000", "40"),
    1: ("20000", "30000", "20"),
    2: ("-60000", "100000", "80"),
    3: ("48000", "20000", "2"),
    4: ("90000", "20000", "25"),
    5: ("30000", "17000", "9"),
}

# Invented betas for the Siege Simulator in demo mode (G13). Illustrative only; slot 6 is left out on
# purpose so the "not modelled" path shows.
_DEMO_BETAS: dict[int, Decimal] = {
    0: D("1.20"), 1: D("1.05"), 2: D("1.10"), 3: D("1.00"), 4: D("0.45"), 5: D("0.55"),
}


def demo_beta(ticker: str) -> Decimal | None:
    slot = demo_ticker_slots().get(ticker)
    return _DEMO_BETAS.get(slot) if slot is not None else None


# Financial-sector demo names are judged on equity / total assets.
_DEMO_FINANCIALS: dict[int, tuple[str, str]] = {6: ("320000", "3900000")}


# Invented one-in-a-book stress losses (fractions, negative = a loss), chosen
# so the demo shows sheltered, exposed and breach-risk towers.
_DEMO_SHOCKS: dict[int, str] = {0: "-0.18", 1: "-0.15", 2: "-0.22", 3: "-0.45", 4: "-0.12", 5: "-0.09", 6: "-0.30"}
_DEMO_CLUSTER = (0, 1, 2)
# The invented demo board puts every name in one zone; these overrides make the
# demo show every kind of land. (zone, valuation status). Slot 6 is fog: withheld.
_DEMO_LAND: dict[int, tuple[str, str]] = {
    5: ("below_bear", "ok"),
    1: ("base_to_bull", "ok"),
    0: ("above_bull", "ok"),
    6: ("below_bear", "implausible"),
}
# Invented thesis states so game mode shows a review mark and a breach.
_DEMO_THESIS: dict[int, tuple[str, int]] = {4: ("review", 0), 3: ("tripwire_fired", 1)}


def _demo_risk(overview, now: datetime) -> RiskFacts:
    slots = demo_ticker_slots()
    by_slot = {slots[p.ticker]: p for p in overview.positions if p.ticker in slots}
    cluster_positions = [by_slot[i] for i in _DEMO_CLUSTER if i in by_slot]
    return RiskFacts(
        regime="baseline",
        regime_explanation="Demo data: an invented, calm macro backdrop.",
        regime_data_complete=True,
        portfolio_shock_pct=D("-0.27"),
        portfolio_drawdown_nok=None,
        snapshot_at=now - timedelta(days=1),
        holding_shocks={
            by_slot[i].holding_id: (D(v), "volatility") for i, v in _DEMO_SHOCKS.items() if i in by_slot
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
    slots = demo_ticker_slots()
    by_slot = {slots[p.ticker]: p for p in overview.positions if p.ticker in slots}
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

    def invented(slot: int, action: str, days_ago: int, *, verdict: str | None = "Hold", invalidation=True):
        p = by_slot.get(slot)
        if p is None:
            return
        decisions.append(
            DecisionFact(
                entry_id=None, holding_id=p.holding_id, ticker=p.ticker, name=p.name, action=action,
                decided_on=today - timedelta(days=days_ago), verdict_at_decision=verdict,
                has_invalidation=invalidation,
            )
        )

    invented(5, "buy", 40, verdict="Buy", invalidation=False)  # drain: no invalidation written
    invented(3, "trim", 20)  # restore: acted after the (invented) tripwire fired
    for days in (70, 45, 15):  # drain: churn
        invented(4, "add" if days != 45 else "trim", days)
    steps = []
    jnj = by_slot.get(2)
    if jnj is not None:
        steps.append(
            PositionStep(
                holding_id=jnj.holding_id, name=jnj.name, from_at=now - timedelta(days=120),
                to_at=now - timedelta(days=30), quantity_before=D(40), quantity_after=D(40),
                price_before=D("170"), price_after=D("142"),
            )
        )
    fired = {by_slot[3].holding_id: [now - timedelta(days=30)]} if 3 in by_slot else {}
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
    slots = demo_ticker_slots()
    for position in overview.positions:
        slot = slots.get(position.ticker)
        if slot in _DEMO_FINANCIALS:
            equity, assets = _DEMO_FINANCIALS[slot]
            walls[position.holding_id] = WallFacts(
                period="FY-DEMO", total_equity=D(equity), total_assets=D(assets)
            )
            continue
        row = _DEMO_WALLS.get(slot)
        if row is None:
            continue
        net_debt, ebitda, cover = (D(x) for x in row)
        walls[position.holding_id] = WallFacts(
            period="FY-DEMO", net_debt=net_debt, ebitda=ebitda, interest_coverage=cover
        )
    now = datetime.now(timezone.utc)
    slot_of = {p.holding_id: slots.get(p.ticker) for p in overview.positions}
    # The demo board stores margins as percent; the real board stores fractions.
    land = {}
    for r in demo_valuation_board().rows:
        zone, status = _DEMO_LAND.get(slot_of.get(r.holding_id), (r.zone, "ok"))
        land[r.holding_id] = LandFacts(
            zone=zone,
            valuation_status=status,
            margin_of_safety_base=(r.margin_of_safety_base / D(100)) if r.margin_of_safety_base is not None else None,
            unavailable_reason="Demo data: valuation withheld as not reliable." if status != "ok" else None,
        )
    thesis: dict = {}
    for row in demo_thesis_monitor().rows:
        status, fired = _DEMO_THESIS.get(slot_of.get(row.holding_id), (row.status, row.firing_count))
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


# --- Sprint 24 (2026-10-04): invented Ravens and Night Watch ---------


def _demo_frames(version: str):
    """Three invented stored frames built from the demo state (towers joining, a wall weakening, the
    weather turning), so the Night Watch has something to compare. Never touches the database."""
    from app.services.game.frame_diff import frame_from_state

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
    return [
        frame_from_state((now - timedelta(days=60)).date(), now - timedelta(days=60), early),
        frame_from_state((now - timedelta(days=30)).date(), now - timedelta(days=30), middle),
        frame_from_state(now.date(), now, today),
    ]


def demo_ravens(version: str, rules_v) -> RavensOut:
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


def demo_night_watch(version: str, rules_v) -> NightWatchOut:
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
    frames = _demo_frames(version)
    from app.services.game.frame_diff import diff_frames

    changes = diff_frames(frames[-2], frames[-1], rules_v)
    return build_night_watch(
        rules_v=rules_v, now=now, watch_last_at=now - timedelta(hours=6),
        watch_summary="Demo: 6 tripwire(s) on 4 holding(s), 1 newly fired, 0 cleared",
        snapshots_last_at=now - timedelta(hours=5), snapshots_summary="Demo: rebuilt risk, performance, board, watchlist",
        firing=firing, frame_days=[f.day for f in frames],
        changes=changes,
        ravens_landed=[r.name for r in demo_ravens(version, rules_v).ravens[:1]], demo=True,
    )
