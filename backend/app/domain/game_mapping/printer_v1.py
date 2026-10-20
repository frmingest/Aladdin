"""v1 settings for The Printer (game mode, Royal Mint, 2026-10-20): the lever table.

The Printer is a game of consequences, not a trading signal. Pulling a lever
changes six "channels" (the stock market as a whole, the short rate, the long
rate, expected inflation, the krone against the dollar, credit spreads); each
holding then reacts to those channels through a sensitivity profile. This file
is the fixed, sourced, versioned half: what each lever does to each channel.
The arithmetic lives in `app/services/game/printer.py`; no AI is involved.

How to read a cell. `Effect(low, base, high)` is the change in the channel for
ONE unit of the lever (units are on each Lever), at a 1-year or 3-year horizon.
`confidence` is how sure we are, and the rule everywhere downstream is:
**Low means direction only, never a NOK figure.**

  High    the effect is true by definition (the policy rate IS the Toll Gate).
  Medium  a published estimate anchors the base value; the range is wider than
          the paper's own and the horizon stretch is our judgement.
  Low     no source anchors the number, or the source measures something
          different (another central bank, a shorter horizon). The cell says so.

Sources were opened on 2026-10-20 and only what the page actually said is
quoted. Where this file says "game judgement" nothing was checked: the number
is a placeholder that keeps the sign and the order of magnitude plausible, it
is shown wide, and it can never produce a NOK figure.

Honest gaps (on screen too): no source was found for helicopter money (it has
never been done at scale in a modern economy), nor for the size of FX
intervention effects (the survey page read gave no numbers); the 3-year column
rests on thinner evidence than the 1-year one; stacked pulls are summed with
every uncertainty at its widest and capped (`CHANNEL_CAPS`), so interactions
are simplified.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `printer_v2.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

D = Decimal

HIGH = "high"
MEDIUM = "medium"
LOW = "low"
CONFIDENCE_ORDER = {LOW: 0, MEDIUM: 1, HIGH: 2}

HORIZONS = (1, 3)

EQUITY = "equity_market"  # % change in a broad stock index
SHORT_RATE = "short_rate"  # percentage points
LONG_RATE = "long_rate"  # percentage points
INFLATION = "inflation_expectation"  # percentage points per year
USDNOK = "usd_nok"  # % change in the krone against the dollar; plus = a stronger krone
SPREAD = "credit_spread"  # percentage points (0.5 = 50 basis points)

CHANNELS = (EQUITY, SHORT_RATE, LONG_RATE, INFLATION, USDNOK, SPREAD)

# Stacked pulls are capped per channel so a silly pile of levers cannot print a silly number.
CHANNEL_CAPS: dict[str, Decimal] = {
    EQUITY: D("30"), SHORT_RATE: D("4"), LONG_RATE: D("3"), INFLATION: D("4"), USDNOK: D("20"), SPREAD: D("4"),
}


@dataclass(frozen=True)
class Source:
    key: str
    title: str
    url: str
    checked: str
    says: str  # what the page actually said, quoted or closely paraphrased


SOURCES: dict[str, Source] = {
    "bk2004": Source(
        "bk2004",
        "Bernanke & Kuttner, What Explains the Stock Market's Reaction to Federal Reserve Policy? (FEDS 2004-16)",
        "https://www.federalreserve.gov/pubs/feds/2004/200416/200416abs.html", "2026-10-20",
        'A hypothetical unanticipated 25-basis-point cut in the federal funds rate target is associated with '
        '"about a one percent increase in broad stock indexes." (US data, an announcement-day effect.)',
    ),
    "williams2013": Source(
        "williams2013",
        "J. Hamilton, Econbrowser, on Williams (2013): estimates of the effects of the Fed's large-scale asset purchases",
        "https://econbrowser.com/?p=10815", "2026-10-20",
        'For an additional $600 billion of Fed purchases "most studies would predict a 15- to 25-basis-point decline '
        'in the 10-year yield"; the estimates "vary and are characterized by considerable uncertainty." '
        "(Our per-1%-of-GDP figure divides by roughly 4% of US GDP at the time: our arithmetic, not the paper's.)",
    ),
    "feds2022": Source(
        "feds2022",
        "Federal Reserve FEDS Note (2022-06-03), Substitutability between balance sheet reductions and policy rate hikes",
        "https://www.federalreserve.gov/econres/notes/feds-notes/substitutability-between-balance-sheet-reductions-and-policy-rate-hikes-some-illustrations-20220603.htm",
        "2026-10-20",
        "A one-time permanent cut in Fed Treasury holdings of 1% of GDP raises the 10-year term premium by about "
        "10 basis points; in the model the policy-rate and term-premium effects largely offset, so 10-year yields "
        "are little changed (full runoff: term premium +8 bp, fed funds -9 bp). Only the portfolio-balance channel is modelled.",
    ),
    "nb2025": Source(
        "nb2025",
        "Norges Bank Staff Memo 3/2025, Monetary policy and the exchange rate",
        "https://norges-bank.no/contentassets/1d029c35fd1e44168700ae1c45c8dfd6/staff-memo-3_2025-monetary-policy-exchange-rate.pdf",
        "2026-10-20",
        'A 1 percentage point unexpected rate rise gives a krone appreciation of "approximately 2 percent" against '
        'trading partners\' currencies, but "within about three months, the exchange rate reverts to its pre-shock '
        'level"; the policy rate itself is still as high as the initial increase after almost 2 years. '
        "(A trade-weighted basket, not the dollar, and a surprise, not a plan.)",
    ),
    "judgement": Source(
        "judgement", "Game judgement, no source checked", "", "2026-10-20",
        "A placeholder for sign and order of magnitude. Shown wide and always tagged Low.",
    ),
}


@dataclass(frozen=True)
class Effect:
    low: Decimal
    base: Decimal
    high: Decimal
    confidence: str
    source: str  # key in SOURCES
    basis: str  # one line: how this cell relates to the source

    def __post_init__(self) -> None:
        if not (self.low <= self.base <= self.high):
            raise ValueError(f"low <= base <= high violated: {self.low}, {self.base}, {self.high}")


def E(low: str, base: str, high: str, conf: str, source: str, basis: str) -> Effect:
    return Effect(D(low), D(base), D(high), conf, source, basis)


def _j(low: str, base: str, high: str, basis: str = "Game judgement.") -> Effect:
    return E(low, base, high, LOW, "judgement", basis)


def _zero(conf: str = HIGH, basis: str = "Unchanged by definition.") -> Effect:
    return E("0", "0", "0", conf, "judgement", basis)


@dataclass(frozen=True)
class Lever:
    key: str
    name: str  # the playful name
    real_tool: str
    tide: str  # up | down | indirect | depends
    unit_label: str  # what one unit of size is
    size_min: Decimal
    size_max: Decimal
    size_default: Decimal
    # variant -> {(channel, horizon): Effect per unit}; most levers have only "default".
    variants: dict[str, dict[tuple[str, int], Effect]] = field(default_factory=dict)


def _table(rows: dict[str, tuple[Effect, Effect]]) -> dict[tuple[str, int], Effect]:
    """channel -> (1-year effect, 3-year effect)."""
    return {(ch, h): eff for ch, pair in rows.items() for h, eff in zip(HORIZONS, pair, strict=True)}


TOLL_GATE = Lever(
    "toll_gate", "Toll Gate", "Policy rate (cut or raise)", "indirect",
    "percentage points of rate rise (negative = a cut)", D("-3"), D("3"), D("0"),
    variants={"default": _table({
        EQUITY: (
            E("-6", "-4", "-2", MEDIUM, "bk2004", "25 bp = 1% scaled to 100 bp = 4%; range +/-50% is ours."),
            _j("-8", "-3", "2", "Announcement-day effect stretched to 3 years; no source for that stretch."),
        ),
        SHORT_RATE: (
            E("0.8", "1", "1", HIGH, "judgement", "The policy rate is the lever; pass-through to the short rate is near one for one."),
            E("0.5", "0.8", "1", MEDIUM, "nb2025", "The memo finds the rate still as high after almost 2 years; later policy may differ."),
        ),
        LONG_RATE: (_j("0.2", "0.5", "0.8", "Partial pass-through along the curve."), _j("0", "0.4", "0.8")),
        INFLATION: (_j("-0.3", "-0.1", "0"), _j("-0.5", "-0.2", "0")),
        USDNOK: (
            E("0", "0.5", "2", LOW, "nb2025", "Memo: about +2% against a basket, gone in 3 months; basket is not USD and it was a surprise."),
            _j("-2", "0", "2", "The memo finds the effect fades; sign after 3 years unknown."),
        ),
        SPREAD: (_j("0", "0.1", "0.3"), _j("0", "0.1", "0.4")),
    })},
)

GREAT_PRESS = Lever(
    "great_press", "Great Press", "QE: the bank buys bonds with new money", "up",
    "% of GDP bought", D("0"), D("10"), D("0"),
    variants={"default": _table({
        EQUITY: (_j("0", "1", "2.5"), _j("-1", "1", "3")),
        SHORT_RATE: (_zero(HIGH, "The policy rate is not what QE moves."), _zero(HIGH, "The policy rate is not what QE moves.")),
        LONG_RATE: (
            E("-0.10", "-0.05", "-0.02", MEDIUM, "williams2013", "15-25 bp per $600bn, about 4-6 bp per 1% of GDP; range reaches the FEDS 10 bp."),
            _j("-0.10", "-0.03", "0", "Portfolio-balance effects are thought to fade; no source for the 3-year size."),
        ),
        INFLATION: (_j("0", "0.05", "0.15"), _j("0", "0.1", "0.3")),
        USDNOK: (_j("-1", "-0.4", "0", "A home-bank QE would be expected to weaken the krone."), _j("-1.5", "-0.4", "0.5")),
        SPREAD: (_j("-0.10", "-0.05", "0"), _j("-0.10", "-0.03", "0.05")),
    })},
)

GREAT_MELT = Lever(
    "great_melt", "Great Melt", "QT: bonds run off", "down",
    "% of GDP run off", D("0"), D("10"), D("0"),
    variants={"default": _table({
        EQUITY: (_j("-2", "-0.8", "0"), _j("-2.5", "-0.5", "1")),
        SHORT_RATE: (
            E("-0.06", "-0.03", "0", MEDIUM, "feds2022", "Model: expected policy path falls to offset QT; -9 bp for 2.8% of GDP, about -3 bp per 1%."),
            _j("-0.06", "-0.02", "0.02"),
        ),
        LONG_RATE: (
            E("0", "0.05", "0.10", MEDIUM, "feds2022", "Term premium +10 bp per 1% of GDP, mostly offset by a lower policy path: base halved, floor zero."),
            _j("0", "0.03", "0.10", "Offsets may not last; no source for the 3-year size."),
        ),
        INFLATION: (_j("-0.15", "-0.05", "0"), _j("-0.2", "-0.05", "0.05")),
        USDNOK: (_j("0", "0.4", "1"), _j("-0.5", "0.3", "1.5")),
        SPREAD: (_j("0", "0.05", "0.15"), _j("-0.05", "0.05", "0.2")),
    })},
)

COIN_RAIN = Lever(
    "coin_rain", "Coin Rain", "Helicopter money / monetary financing", "up",
    "% of GDP paid out", D("0"), D("10"), D("0"),
    variants={"default": _table({
        EQUITY: (_j("-1", "1.5", "4", "Never done at scale in a modern economy; no estimate exists."), _j("-5", "0", "4")),
        SHORT_RATE: (_j("-0.10", "0", "0.10"), _j("-0.10", "0", "0.30")),
        LONG_RATE: (_j("-0.1", "0.1", "0.4", "Risk premium would be expected to rise."), _j("-0.1", "0.3", "0.8")),
        INFLATION: (_j("0.1", "0.3", "0.8"), _j("0.2", "0.6", "1.5")),
        USDNOK: (_j("-3", "-1.5", "0"), _j("-5", "-2", "0")),
        SPREAD: (_j("-0.1", "0", "0.3"), _j("-0.1", "0.1", "0.6")),
    })},
)

_NOTHING_ELSE = {ch: (_zero(HIGH, "Sterilised means the money amount is held steady, so these channels are untouched by definition."),) * 2
                 for ch in (EQUITY, SHORT_RATE, LONG_RATE, INFLATION, SPREAD)}

HARBOUR_GUARD = Lever(
    "harbour_guard", "Harbour Guard", "FX intervention: buy or sell krone", "depends",
    "% of GDP of krone bought (negative = sold)", D("-5"), D("5"), D("0"),
    variants={
        "sterilised": _table({
            **_NOTHING_ELSE,
            USDNOK: (_j("-0.5", "0.5", "1.5", "Survey page read gave no numbers; sign contested."), _j("-1", "0", "1")),
        }),
        "unsterilised": _table({
            EQUITY: (_j("-1.5", "-0.5", "0"), _j("-2", "0", "1")),
            SHORT_RATE: (_j("0", "0.05", "0.15", "Buying krone drains krone liquidity."), _j("-0.05", "0.03", "0.15")),
            LONG_RATE: (_zero(LOW, "Not estimated."), _zero(LOW, "Not estimated.")),
            INFLATION: (_j("-0.1", "0", "0"), _j("-0.2", "0", "0.1")),
            USDNOK: (_j("0", "1", "3", "Larger than sterilised, as the money amount moves too; no source."), _j("-1", "0.5", "3")),
            SPREAD: (_zero(LOW, "Not estimated."), _zero(LOW, "Not estimated.")),
        }),
    },
)

LEVERS: dict[str, Lever] = {
    lever.key: lever for lever in (TOLL_GATE, GREAT_PRESS, GREAT_MELT, COIN_RAIN, HARBOUR_GUARD)
}
DEFAULT_VARIANT = "default"

# --- Holding sensitivity profiles -------------------------------------------------------------
# Per sector, how a holding reacts to a unit move in a channel. All sector guesses, so all Low
# until a holding gets its own measured profile (later sprint). The market channel does NOT use
# this table: it uses the holding's own measured beta from the Siege Simulator.


@dataclass(frozen=True)
class SectorProfile:
    long_rate: Decimal  # % price change per +1 pp long rate
    usd_share: Decimal  # share of income in dollars: a stronger krone costs this share of the move
    inflation: Decimal  # % price change per +1 pp expected inflation
    spread: Decimal  # % price change per +1 pp credit spread


def _p(long_rate: str, usd_share: str, inflation: str, spread: str) -> SectorProfile:
    return SectorProfile(D(long_rate), D(usd_share), D(inflation), D(spread))


SECTOR_PROFILES: dict[str, SectorProfile] = {
    "Energy": _p("-2", "0.6", "3", "-3"),
    "Materials": _p("-3", "0.5", "2", "-4"),
    "Industrials": _p("-4", "0.3", "0", "-5"),
    "Consumer Discretionary": _p("-5", "0.3", "-1", "-6"),
    "Consumer Staples": _p("-4", "0.3", "0", "-3"),
    "Health Care": _p("-4", "0.4", "0", "-3"),
    "Financials": _p("1", "0.1", "0", "-8"),
    "Information Technology": _p("-7", "0.5", "-1", "-5"),
    "Communication Services": _p("-5", "0.3", "-1", "-5"),
    "Utilities": _p("-8", "0", "0", "-4"),
    "Real Estate": _p("-10", "0", "1", "-8"),
    "Diversified Fund": _p("-4", "0.3", "0", "-5"),
}
UNKNOWN_SECTOR_PROFILE = SECTOR_PROFILES["Diversified Fund"]

# Result confidence for a holding's market beta, by where the beta came from.
BETA_CONFIDENCE = {"price_history": MEDIUM, "vendor_beta": LOW, "demo": LOW}

# A term lowers a holding's confidence only when its range is at least this share of all terms' ranges.
MATERIAL_SHARE = D("0.25")

# Direction wording: "leans" when the range straddles zero but the base sits clearly on one side.
LEAN_SHARE = D("0.25")

# Temperament meter (decision 4): a wild pull gets a warning line.
WILD_LEVER_COUNT = 3
WILD_SIZE_SHARE = D("0.8")

HORIZON_DEFAULT = 1
VERSION = "v1"
BANNER = "A game of consequences, not a trading signal. Scenario, not forecast."
