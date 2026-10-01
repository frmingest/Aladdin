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
from app.services.game.rules import WallFacts
from app.services.game.state import AccountCash, GameInputs, build_game_state
from app.services.settings.synthetic_data import demo_portfolio_overview

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

# Financial-sector demo names are judged on equity / total assets.
_DEMO_FINANCIALS: dict[str, tuple[str, str]] = {
    "JPM": ("320000", "3900000"),
    "V": ("38000", "90000"),
}


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
    inputs = GameInputs(
        overview=overview,
        wall_facts=walls,
        accounts=[AccountCash(cash_nok=D("180000"), cash_as_of=datetime.now(timezone.utc) - timedelta(days=3))],
        gold_oz=D("12"),
        silver_oz=D("150"),
        demo=True,
    )
    return build_game_state(inputs, get_game_mapping(version))
