"""Winter Rehearsal read path (E2): the Fortress state plus stored price
history, run through the pure replay in `winter.py`. Database only; no
provider, LLM or write."""
from __future__ import annotations

from app.domain.game_mapping.winter_v1 import WinterRules
from app.schemas.game import (
    WinterCoverageOut,
    WinterPointOut,
    WinterRehearsalOut,
    WinterWindowOut,
)
from app.services.game.backtest import BacktestHoldingIn
from app.services.game.winter import (
    STATUS_NO_HISTORY,
    STATUS_OK,
    ReplayResult,
    replay_worst_fall,
)

CAPTION = (
    "A replay of today's holdings through the prices on file. It is not what you held, and it says "
    "nothing about the next fall."
)
BACKCAST_NOTE = (
    "Today's weights are held constant. Buying, selling, costs and holdings without stored prices "
    "are left out."
)


def _coverage(result: ReplayResult, total: int) -> WinterCoverageOut:
    return WinterCoverageOut(
        covered_count=result.covered_count,
        total_count=total,
        covered_value_nok=result.covered_value_nok,
        covered_value_share=result.covered_value_share,
        holdings=[
            {"holding_id": r.holding_id, "name": r.name, "covered": r.covered, "reason": r.reason}
            for r in result.coverage
        ],  # type: ignore[arg-type]
    )


def empty(rules: WinterRules, status: str, reason: str, *, demo: bool = False) -> WinterRehearsalOut:
    return WinterRehearsalOut(
        version=rules.version, demo=demo, status=status,  # type: ignore[arg-type]
        status_reason=reason, real_winter_fall=rules.real_winter_fall, caption=CAPTION,
    )


def demo_winter(rules: WinterRules) -> WinterRehearsalOut:
    return empty(rules, "demo", "The sample data has no stored price history, so there is no winter to replay.", demo=True)


def build_winter(
    holdings: list[BacktestHoldingIn], rules: WinterRules, min_days: int
) -> WinterRehearsalOut:
    if not holdings:
        return empty(rules, STATUS_NO_HISTORY, "There are no holdings to replay yet.")
    result = replay_worst_fall(holdings, rules, min_days)
    out = WinterRehearsalOut(
        version=rules.version,
        status=result.status,  # type: ignore[arg-type]
        status_reason=result.reason,
        real_winter_fall=rules.real_winter_fall,
        coverage=_coverage(result, len(holdings)),
        days_on_file=result.days_on_file,
        worst_fall=result.worst_fall,
        caption=CAPTION,
    )
    notes: list[str] = []
    if result.status in (STATUS_OK, "no_winter"):
        notes.append(BACKCAST_NOTE)
    missing = len(holdings) - result.covered_count
    if missing and result.status in (STATUS_OK, "no_winter"):
        notes.append(f"{missing} of {len(holdings)} holdings had no stored prices and are not in this replay.")
    out.notes = notes
    if result.status == STATUS_OK and result.peak_date and result.trough_date:
        out.window = WinterWindowOut(
            peak_date=result.peak_date,
            trough_date=result.trough_date,
            fall=result.worst_fall,  # type: ignore[arg-type]
            trading_days=len(result.points),
            points=[
                WinterPointOut(
                    day=p.day, value_nok=p.value_nok, change_nok=p.change_nok,
                    change=p.change, days_under_water=p.days_under_water,
                )
                for p in result.points
            ],
        )
    return out
