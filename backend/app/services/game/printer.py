"""The Printer (game mode, Royal Mint, 2026-10-20): what a central-bank lever
would do to each holding. Pure: no database, provider, model or clock.

Three steps, all fixed arithmetic over the versioned table in
`app/domain/game_mapping/printer_v1.py`:

  1. Levers to channels. Each pulled lever contributes (size x per-unit effect)
     to six channels. Uncertainty is kept as a low / base / high range and
     summed at its widest (every lever wrong in the same direction at once),
     then each channel is capped. Opposite pulls on one channel are flagged
     as cancelling.
  2. Channels to holdings. A holding's market beta (the Siege Simulator's own,
     measured or vendor) carries the stock-market channel; its sector profile
     carries the rest. Each term is a coefficient times a channel range.
  3. Reading. A range in percent and NOK, a real-terms range (after the
     inflation channel), and a confidence tag. **Low confidence means a
     direction only, never a NOK figure.** A holding with no beta or no value
     is listed as not modelled, never given a default.

It is a scenario, not a forecast. Nothing here is stored and nothing reads
the user's notes. CLAUDE.md Rule 1: every number is computed here, in code.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal

from app.domain.game_mapping import printer_v1 as T

ZERO = Decimal(0)
HUNDRED = Decimal(100)
_Q1 = Decimal(1)
_Q2 = Decimal("0.01")

MODELLED = "modelled"
NOT_MODELLED = "not_modelled"


@dataclass(frozen=True)
class Pull:
    lever: str
    size: Decimal
    variant: str = T.DEFAULT_VARIANT


@dataclass(frozen=True)
class Range:
    low: Decimal
    base: Decimal
    high: Decimal

    def scaled(self, k: Decimal) -> Range:
        a, b = self.low * k, self.high * k
        return Range(min(a, b), self.base * k, max(a, b))

    def plus(self, other: Range) -> Range:
        return Range(self.low + other.low, self.base + other.base, self.high + other.high)

    @property
    def is_zero(self) -> bool:
        return self.low == ZERO and self.base == ZERO and self.high == ZERO


ZERO_RANGE = Range(ZERO, ZERO, ZERO)


def _min_conf(*levels: str) -> str:
    return min(levels, key=lambda c: T.CONFIDENCE_ORDER[c]) if levels else T.HIGH


@dataclass
class Contribution:
    lever: str
    range: Range
    confidence: str
    source: str
    basis: str


@dataclass
class ChannelResult:
    channel: str
    range: Range
    confidence: str
    capped: bool = False
    cancelling: bool = False
    contributions: list[Contribution] = field(default_factory=list)


@dataclass(frozen=True)
class SimHolding:
    holding_id: uuid.UUID
    ticker: str
    name: str
    sector: str | None
    value_nok: Decimal | None
    beta: Decimal | None
    beta_method: str | None = None  # price_history | vendor_beta | demo


@dataclass
class Term:
    channel: str
    coefficient: Decimal
    pct: Range  # contribution to the holding's price change, percent
    confidence: str


@dataclass
class HoldingReading:
    holding: SimHolding
    status: str
    reason: str | None = None
    confidence: str | None = None
    pct: Range | None = None  # nominal, whole percent, widest-safe rounding
    real_pct: Range | None = None
    nok: Range | None = None
    real_nok: Range | None = None
    show_amount: bool = False
    direction: str = "unclear"  # up | leans_up | unclear | leans_down | down
    real_direction: str = "unclear"
    terms: list[Term] = field(default_factory=list)
    why: str = ""


@dataclass
class PrinterResult:
    horizon: int
    pulls: list[Pull]
    channels: dict[str, ChannelResult]
    holdings: list[HoldingReading]
    portfolio_confidence: str | None
    portfolio_pct: Range | None
    portfolio_real_pct: Range | None
    portfolio_nok: Range | None
    portfolio_real_nok: Range | None
    show_portfolio_amount: bool
    portfolio_direction: str
    covered_value_nok: Decimal
    total_value_nok: Decimal
    coverage: Decimal | None
    wild: bool
    warnings: list[str]


def validate_pulls(pulls: list[Pull]) -> None:
    """Raises ValueError with a plain reason for an unknown lever, a repeated lever, an unknown
    variant or a size outside the lever's range."""
    seen: set[str] = set()
    for p in pulls:
        lever = T.LEVERS.get(p.lever)
        if lever is None:
            raise ValueError(f"unknown lever '{p.lever}'; the levers are {', '.join(T.LEVERS)}")
        if p.lever in seen:
            raise ValueError(f"lever '{p.lever}' is pulled twice")
        seen.add(p.lever)
        if p.variant not in lever.variants:
            raise ValueError(f"lever '{p.lever}' has no variant '{p.variant}'; choose from {', '.join(lever.variants)}")
        if not (lever.size_min <= p.size <= lever.size_max):
            raise ValueError(f"lever '{p.lever}' size must be between {lever.size_min} and {lever.size_max}")


def channel_results(pulls: list[Pull], horizon: int) -> dict[str, ChannelResult]:
    if horizon not in T.HORIZONS:
        raise ValueError(f"horizon must be one of {', '.join(str(h) for h in T.HORIZONS)} (years)")
    out = {ch: ChannelResult(ch, ZERO_RANGE, T.HIGH) for ch in T.CHANNELS}
    for p in pulls:
        if p.size == ZERO:
            continue
        table = T.LEVERS[p.lever].variants[p.variant]
        for ch in T.CHANNELS:
            eff = table[(ch, horizon)]
            if eff.low == eff.base == eff.high == ZERO:
                continue  # a true zero says nothing and lowers nobody's confidence
            part = Range(eff.low, eff.base, eff.high).scaled(p.size)
            res = out[ch]
            res.range = res.range.plus(part)
            res.confidence = _min_conf(res.confidence, eff.confidence)
            res.contributions.append(Contribution(p.lever, part, eff.confidence, eff.source, eff.basis))
    for ch, res in out.items():
        cap = T.CHANNEL_CAPS[ch]
        r = res.range
        clamped = Range(max(-cap, r.low), max(-cap, min(cap, r.base)), min(cap, r.high))
        if clamped != r:
            res.capped = True
            res.range = clamped
        signs = {c.range.base > 0 for c in res.contributions if c.range.base != ZERO}
        res.cancelling = len(signs) == 2
    return out


def _direction(r: Range) -> str:
    if r.low > ZERO:
        return "up"
    if r.high < ZERO:
        return "down"
    if r.low == r.base == r.high == ZERO:
        return "unclear"
    width = r.high - r.low
    if width > ZERO and abs(r.base) >= T.LEAN_SHARE * width:
        return "leans_up" if r.base > ZERO else "leans_down"
    return "unclear"


def _whole(r: Range) -> Range:
    return Range(
        r.low.to_integral_value(rounding=ROUND_FLOOR),
        r.base.quantize(_Q1),
        r.high.to_integral_value(rounding=ROUND_CEILING),
    )


def _nok(value: Decimal, pct: Range) -> Range:
    f = value / HUNDRED
    return Range(
        (pct.low * f).to_integral_value(rounding=ROUND_FLOOR),
        (pct.base * f).quantize(_Q1),
        (pct.high * f).to_integral_value(rounding=ROUND_CEILING),
    )


def read_holding(h: SimHolding, channels: dict[str, ChannelResult], horizon: int) -> HoldingReading:
    if h.value_nok is None or h.value_nok <= 0:
        return HoldingReading(h, NOT_MODELLED, reason="no value stored for this holding")
    if h.beta is None:
        return HoldingReading(h, NOT_MODELLED, reason="no beta stored, so its reaction to the market is unknown")

    profile = T.SECTOR_PROFILES.get(h.sector or "", T.UNKNOWN_SECTOR_PROFILE)
    beta_conf = T.BETA_CONFIDENCE.get(h.beta_method or "", T.LOW)
    coefficients = {
        T.EQUITY: (h.beta, beta_conf),
        T.LONG_RATE: (profile.long_rate, T.LOW),
        T.USDNOK: (-profile.usd_share, T.LOW),
        T.INFLATION: (profile.inflation, T.LOW),
        T.SPREAD: (profile.spread, T.LOW),
    }
    terms: list[Term] = []
    for ch, (coef, coef_conf) in coefficients.items():
        chan = channels[ch]
        if chan.range.is_zero or coef == ZERO:
            continue
        terms.append(Term(ch, coef, chan.range.scaled(coef), _min_conf(coef_conf, chan.confidence)))
    # The short rate has no sector coefficient in v1: it acts through the market and long-rate terms.

    total = ZERO_RANGE
    for t in terms:
        total = total.plus(t.pct)
    # A guessed term only drags the whole reading down to Low when it carries a real share of the
    # uncertainty; a sliver of Low does not tarnish a measured, dominant term.
    widths = [t.pct.high - t.pct.low for t in terms]
    spread_total = sum(widths, ZERO)
    material = [
        t for t, w in zip(terms, widths, strict=True)
        if spread_total == ZERO or w >= T.MATERIAL_SHARE * spread_total
    ]
    conf = _min_conf(*(t.confidence for t in material)) if material else T.HIGH

    infl = channels[T.INFLATION]
    cumulative = infl.range.scaled(Decimal(horizon))  # pp a year, held for `horizon` years = % on the price level
    real = Range(total.low - cumulative.high, total.base - cumulative.base, total.high - cumulative.low)
    real_conf = _min_conf(conf, infl.confidence) if not infl.range.is_zero else conf

    pct = _whole(total)
    real_pct = _whole(real)
    reading = HoldingReading(
        h, MODELLED, confidence=conf, pct=pct, real_pct=real_pct, terms=terms,
        direction=_direction(total), real_direction=_direction(real),
    )
    reading.show_amount = bool(terms) and conf != T.LOW
    if reading.show_amount:
        reading.nok = _nok(h.value_nok, pct)
        reading.real_nok = _nok(h.value_nok, real_pct) if real_conf != T.LOW else None
    reading.why = _why(reading)
    return reading


def _why(r: HoldingReading) -> str:
    if not r.terms:
        return "None of the pulled levers reaches this holding."
    biggest = max(r.terms, key=lambda t: max(abs(t.pct.low), abs(t.pct.high)))
    names = {
        T.EQUITY: "the stock market as a whole", T.LONG_RATE: "long rates", T.USDNOK: "the krone against the dollar",
        T.INFLATION: "expected inflation", T.SPREAD: "credit spreads",
    }
    return f"Mostly {names[biggest.channel]}."


def run(holdings: list[SimHolding], pulls: list[Pull], horizon: int = T.HORIZON_DEFAULT) -> PrinterResult:
    validate_pulls(pulls)
    channels = channel_results(pulls, horizon)
    readings = [read_holding(h, channels, horizon) for h in holdings]

    total_value = sum((h.value_nok for h in holdings if h.value_nok and h.value_nok > 0), ZERO)
    modelled = [r for r in readings if r.status == MODELLED]
    covered = sum((r.holding.value_nok for r in modelled), ZERO)  # type: ignore[misc]
    coverage = (covered / total_value).quantize(Decimal("0.0001")) if total_value > 0 else None

    warnings: list[str] = []
    active = [p for p in pulls if p.size != ZERO]
    wild = len(active) >= T.WILD_LEVER_COUNT or any(
        abs(p.size) >= T.WILD_SIZE_SHARE * max(abs(T.LEVERS[p.lever].size_min), abs(T.LEVERS[p.lever].size_max))
        for p in active
    )
    if wild:
        warnings.append("A wild pull: the more levers and the bigger the pull, the less this simple model can be trusted.")
    for res in channels.values():
        if res.cancelling:
            warnings.append(f"Pulls on {res.channel.replace('_', ' ')} point opposite ways and partly cancel.")
        if res.capped:
            warnings.append(f"The {res.channel.replace('_', ' ')} move hit its cap; stacked pulls are simplified.")

    p_pct = p_real = p_nok = p_real_nok = None
    p_conf: str | None = None
    show = False
    direction = "unclear"
    if modelled and coverage is not None and coverage > 0:
        p_pct = ZERO_RANGE
        p_real = ZERO_RANGE
        for r in modelled:
            w = r.holding.value_nok / covered  # type: ignore[operator]
            assert r.pct is not None and r.real_pct is not None
            p_pct = p_pct.plus(r.pct.scaled(w))
            p_real = p_real.plus(r.real_pct.scaled(w))
        p_pct, p_real = _whole(p_pct), _whole(p_real)
        p_conf = _min_conf(*(r.confidence or T.LOW for r in modelled))
        direction = _direction(p_pct)
        show = p_conf != T.LOW
        if show:
            p_nok = _nok(covered, p_pct)
            p_real_nok = _nok(covered, p_real)
    return PrinterResult(
        horizon, pulls, channels, readings, p_conf, p_pct, p_real, p_nok, p_real_nok, show, direction,
        covered, total_value, coverage, wild, warnings,
    )
