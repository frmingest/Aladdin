"""The Printer read path: the Fortress state plus stored betas, run through the
pure engine in `printer.py`. Database only; no provider, LLM or write."""
from __future__ import annotations

from decimal import Decimal

from app.domain.game_mapping import printer_v1 as T
from app.schemas.game import GameStateOut
from app.schemas.printer import (
    PrinterChannelOut,
    PrinterContributionOut,
    PrinterEffectOut,
    PrinterHoldingOut,
    PrinterLedgerOut,
    PrinterLeverOut,
    PrinterOut,
    PrinterRangeOut,
    PrinterSourceOut,
    PrinterTermOut,
)
from app.services.game import printer as engine
from app.services.game.siege_view import SensitivityLookup

NOTES = [
    "Every number comes from a fixed table (see the Ledger of Truth) run by plain code. No AI computes anything here.",
    "Ranges are the widest case: every pulled lever is assumed wrong in the same direction at once.",
    "Where we are not sure (Low), we show a direction only, never a krone figure.",
    (
        "A holding's reaction to the stock market uses its own measured beta; its reaction to rates, the krone, "
        "inflation and credit comes from a sector guess, so any result that leans on it is Low."
    ),
    "Nothing here is saved and nothing changes a stored rating, wall or portfolio figure.",
]


def _r(r: engine.Range | None) -> PrinterRangeOut | None:
    return None if r is None else PrinterRangeOut(low=r.low, base=r.base, high=r.high)


def ledger() -> PrinterLedgerOut:
    effects: dict[str, dict[str, list[PrinterEffectOut]]] = {}
    for key, lever in T.LEVERS.items():
        effects[key] = {
            variant: [
                PrinterEffectOut(
                    channel=ch, horizon=h, low=e.low, base=e.base, high=e.high,
                    confidence=e.confidence, source=e.source, basis=e.basis,
                )
                for (ch, h), e in sorted(table.items(), key=lambda kv: (kv[0][1], T.CHANNELS.index(kv[0][0])))
            ]
            for variant, table in lever.variants.items()
        }
    return PrinterLedgerOut(
        version=T.VERSION, banner=T.BANNER,
        levers=[
            PrinterLeverOut(
                key=lv.key, name=lv.name, real_tool=lv.real_tool, tide=lv.tide, unit_label=lv.unit_label,
                size_min=lv.size_min, size_max=lv.size_max, size_default=lv.size_default,
                variants=list(lv.variants),
            )
            for lv in T.LEVERS.values()
        ],
        effects=effects,
        sources=[
            PrinterSourceOut(key=s.key, title=s.title, url=s.url, checked=s.checked, says=s.says)
            for s in T.SOURCES.values()
        ],
    )


def build_printer(
    state: GameStateOut, lookup: SensitivityLookup, pulls: list[engine.Pull], horizon: int
) -> PrinterOut:
    holdings = []
    for t in state.towers:
        sens = lookup(t.ticker)
        holdings.append(
            engine.SimHolding(
                holding_id=t.holding_id, ticker=t.ticker, name=t.name, sector=t.sector,
                value_nok=t.value_nok, beta=sens.beta, beta_method=sens.method if sens.beta is not None else None,
            )
        )
    result = engine.run(holdings, pulls, horizon)

    # Biggest swing first (by the widest end of the NOK-equivalent range); not modelled last.
    def swing(r: engine.HoldingReading) -> Decimal:
        if r.status != engine.MODELLED or r.pct is None or r.holding.value_nok is None:
            return Decimal(-1)
        return max(abs(r.pct.low), abs(r.pct.high)) * r.holding.value_nok

    ordered = sorted(result.holdings, key=swing, reverse=True)
    return PrinterOut(
        version=T.VERSION, banner=T.BANNER, demo=state.demo, horizon=result.horizon,
        pulls=[{"lever": p.lever, "size": str(p.size), "variant": p.variant} for p in pulls],
        channels=[
            PrinterChannelOut(
                channel=c.channel, range=_r(c.range), confidence=c.confidence,  # type: ignore[arg-type]
                capped=c.capped, cancelling=c.cancelling,
                contributions=[
                    PrinterContributionOut(
                        lever=x.lever, range=_r(x.range), confidence=x.confidence,  # type: ignore[arg-type]
                        source=x.source, basis=x.basis,
                    )
                    for x in c.contributions
                ],
            )
            for c in result.channels.values()
        ],
        holdings=[
            PrinterHoldingOut(
                holding_id=r.holding.holding_id, ticker=r.holding.ticker, name=r.holding.name,
                sector=r.holding.sector, value_nok=r.holding.value_nok, status=r.status, reason=r.reason,
                confidence=r.confidence, pct=_r(r.pct), real_pct=_r(r.real_pct), show_amount=r.show_amount,
                nok=_r(r.nok), real_nok=_r(r.real_nok), direction=r.direction, real_direction=r.real_direction,
                why=r.why,
                terms=[
                    PrinterTermOut(channel=t.channel, coefficient=t.coefficient, pct=_r(t.pct), confidence=t.confidence)  # type: ignore[arg-type]
                    for t in r.terms
                ],
            )
            for r in ordered
        ],
        portfolio_confidence=result.portfolio_confidence, portfolio_pct=_r(result.portfolio_pct),
        portfolio_real_pct=_r(result.portfolio_real_pct), show_portfolio_amount=result.show_portfolio_amount,
        portfolio_nok=_r(result.portfolio_nok), portfolio_real_nok=_r(result.portfolio_real_nok),
        portfolio_direction=result.portfolio_direction, covered_value_nok=result.covered_value_nok,
        total_value_nok=result.total_value_nok, coverage=result.coverage, wild=result.wild,
        warnings=result.warnings, notes=NOTES,
    )
