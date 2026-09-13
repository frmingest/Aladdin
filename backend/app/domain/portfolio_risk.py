"""
Deterministic portfolio-risk calculations (architecture §15, §15.1, §26
Phase 5): correlation, systemic/state risk (deposit concentration, custody
structure, Norwegian wealth-tax estimate, jurisdictional concentration), and
the risk-band/composite-score blend over whichever dimensions this module
and app.domain.scenarios could actually compute.

Per §15: "The portfolio risk view should prioritize a risk profile over a
single number ... A numeric composite risk score may exist as a secondary
summary, but it must not be the primary representation." `risk_band` is
therefore always populated; `composite_risk_score` is a best-effort blend
over available dimensions (never fabricated for a dimension with no data —
see compute_composite_score) and callers should treat it as exactly that
secondary summary, not the headline.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from functools import lru_cache

import yaml

from app.config.paths import SCORING_DIR
from app.domain.calculations import PERCENT_PLACES, quantize

# --- correlation -------------------------------------------------------


def pearson_correlation(xs: list[Decimal], ys: list[Decimal]) -> Decimal | None:
    """Standard Pearson correlation coefficient. Computed in float — this is
    an inherently approximate statistical estimate, not financial arithmetic
    requiring Decimal exactness (unlike everything in app.domain.calculations).
    Returns None (never a fabricated 0) for fewer than 3 paired observations
    or a zero-variance series, where "correlation" isn't a meaningful
    concept (§21)."""
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    fx = [float(x) for x in xs]
    fy = [float(y) for y in ys]
    n = len(fx)
    mean_x = sum(fx) / n
    mean_y = sum(fy) / n
    cov = sum((a - mean_x) * (b - mean_y) for a, b in zip(fx, fy))
    var_x = sum((a - mean_x) ** 2 for a in fx)
    var_y = sum((b - mean_y) ** 2 for b in fy)
    if var_x == 0 or var_y == 0:
        return None
    r = cov / (var_x**0.5 * var_y**0.5)
    return Decimal(str(round(r, 4)))


@dataclass(frozen=True)
class CorrelationResult:
    pairs: dict[str, Decimal] = field(default_factory=dict)  # "TICKER_A|TICKER_B" -> r
    average_pairwise_correlation: Decimal | None = None
    insufficient_data_pairs: list[str] = field(default_factory=list)


def build_correlation_matrix(
    daily_prices_by_ticker: dict[str, dict[date, Decimal]], min_overlap: int = 5
) -> CorrelationResult:
    """`daily_prices_by_ticker`: one price per calendar day per ticker
    (callers collapse same-day observations before calling this — see
    app.services.portfolio_risk.builder). Only pairs with at least
    `min_overlap` shared observation dates get a correlation; the rest are
    named in `insufficient_data_pairs` so the caller can say why a pair is
    missing rather than silently omitting it."""
    tickers = sorted(daily_prices_by_ticker)
    pairs: dict[str, Decimal] = {}
    insufficient: list[str] = []
    values: list[Decimal] = []

    for i, ticker_a in enumerate(tickers):
        for ticker_b in tickers[i + 1 :]:
            common_dates = sorted(set(daily_prices_by_ticker[ticker_a]) & set(daily_prices_by_ticker[ticker_b]))
            pair_key = f"{ticker_a}|{ticker_b}"
            if len(common_dates) < min_overlap:
                insufficient.append(pair_key)
                continue
            xs = [daily_prices_by_ticker[ticker_a][d] for d in common_dates]
            ys = [daily_prices_by_ticker[ticker_b][d] for d in common_dates]
            r = pearson_correlation(xs, ys)
            if r is None:
                insufficient.append(pair_key)
                continue
            pairs[pair_key] = r
            values.append(r)

    average = quantize(sum(values, Decimal("0")) / len(values), Decimal("0.0001")) if values else None
    return CorrelationResult(pairs=pairs, average_pairwise_correlation=average, insufficient_data_pairs=insufficient)


# --- systemic / state risk (§15.1) --------------------------------------


@dataclass(frozen=True)
class DepositExposure:
    institution: str
    value_reporting_ccy: Decimal
    guarantee_limit: Decimal
    excess_over_guarantee: Decimal


def compute_deposit_concentration(
    cash_positions: list[tuple[str | None, Decimal]], guarantee_limit: Decimal
) -> tuple[list[DepositExposure], Decimal | None]:
    """`cash_positions`: (institution, value_in_reporting_currency) for every
    cash/deposit holding. Groups by institution (an unset institution is its
    own "Unknown institution" bucket — never silently merged into a known
    one) and checks each institution's total against the per-institution
    deposit-guarantee limit (§15.1). Returns (per-institution exposures,
    % of total deposits sitting above the guarantee limit at their own
    institution) — the latter is None when there are no cash positions at
    all, not 0 (§21: no basis for a percentage isn't the same as "none at
    risk")."""
    by_institution: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for institution, value in cash_positions:
        by_institution[institution or "Unknown institution"] += value

    exposures: list[DepositExposure] = []
    total = Decimal("0")
    over_limit = Decimal("0")
    for institution, value in sorted(by_institution.items()):
        excess = max(Decimal("0"), value - guarantee_limit)
        exposures.append(
            DepositExposure(
                institution=institution,
                value_reporting_ccy=quantize(value),
                guarantee_limit=guarantee_limit,
                excess_over_guarantee=quantize(excess),
            )
        )
        total += value
        over_limit += excess

    pct = quantize(over_limit / total * Decimal("100"), PERCENT_PLACES) if total > 0 else None
    return exposures, pct


@dataclass(frozen=True)
class WealthTaxEstimate:
    jurisdiction: str
    taxable_base: Decimal
    bunnfradrag: Decimal
    rate_pct: Decimal
    estimated_tax: Decimal


def estimate_norwegian_wealth_tax(
    *,
    net_portfolio_value_nok: Decimal,
    listed_share_value_nok: Decimal,
    bunnfradrag_nok: Decimal,
    rate_pct: Decimal,
    share_discount_pct: Decimal,
) -> WealthTaxEstimate:
    """Norwegian formuesskatt (§15.1), simplified — see
    app.config.settings.Settings for the documented limitations (single
    bracket, no per-couple splitting). `listed_share_value_nok` gets the
    skjermingsfradrag-style discount (only a `share_discount_pct` fraction
    of market value counts toward the taxable base); every other portfolio
    value counts in full. Never returns None — arithmetic on a known net
    value is always defined, unlike a ratio with a zero denominator
    elsewhere in this module."""
    discounted_share_value = listed_share_value_nok * (Decimal("1") - share_discount_pct / Decimal("100"))
    other_value = net_portfolio_value_nok - listed_share_value_nok
    taxable_base = max(Decimal("0"), other_value + discounted_share_value - bunnfradrag_nok)
    estimated_tax = taxable_base * (rate_pct / Decimal("100"))
    return WealthTaxEstimate(
        jurisdiction="NO",
        taxable_base=quantize(taxable_base),
        bunnfradrag=bunnfradrag_nok,
        rate_pct=rate_pct,
        estimated_tax=quantize(estimated_tax),
    )


# --- risk band / composite score ----------------------------------------


@dataclass(frozen=True)
class RiskDimensionThreshold:
    moderate_at: Decimal
    moderate_high_at: Decimal
    high_at: Decimal
    severity_scale: Decimal  # raw value that maps to severity 100


@dataclass(frozen=True)
class RiskScoringConfig:
    version: str
    dimension_weights: dict[str, Decimal]
    dimension_thresholds: dict[str, RiskDimensionThreshold]
    band_severity_thresholds: dict[str, Decimal]  # band label -> minimum composite severity


class UnknownRiskScoringVersionError(Exception):
    def __init__(self, version: str):
        self.version = version
        super().__init__(f"risk scoring version '{version}' has no config file under scoring/versions/")


@lru_cache
def load_risk_scoring_config(version: str) -> RiskScoringConfig:
    path = SCORING_DIR / f"{version}.yaml"
    if not path.exists():
        raise UnknownRiskScoringVersionError(version)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))

    thresholds = {
        key: RiskDimensionThreshold(
            moderate_at=Decimal(str(entry["moderate_at"])),
            moderate_high_at=Decimal(str(entry["moderate_high_at"])),
            high_at=Decimal(str(entry["high_at"])),
            severity_scale=Decimal(str(entry["severity_scale"])),
        )
        for key, entry in raw["dimension_thresholds"].items()
    }
    return RiskScoringConfig(
        version=raw["version"],
        dimension_weights={k: Decimal(str(v)) for k, v in raw["dimension_weights"].items()},
        dimension_thresholds=thresholds,
        band_severity_thresholds={k: Decimal(str(v)) for k, v in raw["band_severity_thresholds"].items()},
    )


@dataclass(frozen=True)
class DimensionScore:
    band: str  # LOW | MODERATE | MODERATE-HIGH | HIGH
    severity: Decimal  # 0-100, only meaningful for the composite blend


def score_dimension(value: Decimal | None, config: RiskScoringConfig, dimension: str) -> DimensionScore | None:
    """Maps one raw metric (an HHI, a percentage, an absolute correlation)
    onto a qualitative band plus a 0-100 severity for the composite blend,
    per that dimension's thresholds in scoring/versions/{risk_version}.yaml.
    Returns None — never a fabricated LOW — when there's no value to score
    (§21); callers surface that as "insufficient data", matching every
    other None-means-no-basis convention in this codebase."""
    if value is None:
        return None
    threshold = config.dimension_thresholds[dimension]
    magnitude = abs(value)
    if magnitude <= threshold.moderate_at:
        band = "LOW"
    elif magnitude <= threshold.moderate_high_at:
        band = "MODERATE"
    elif magnitude <= threshold.high_at:
        band = "MODERATE-HIGH"
    else:
        band = "HIGH"
    severity = min(Decimal("100"), magnitude / threshold.severity_scale * Decimal("100"))
    return DimensionScore(band=band, severity=severity)


def compute_composite_score(
    dimension_scores: dict[str, DimensionScore], config: RiskScoringConfig
) -> Decimal | None:
    """Weighted average of severity over whichever dimensions actually have
    a score, with weights renormalized to what's available — unlike
    app.domain.scoring's holding-factor blend (which requires every factor
    to be present), a partial composite risk score is still meaningful here
    because §15 already treats it as a secondary summary, not the primary
    representation callers rely on. Returns None only when nothing at all
    could be scored."""
    available = {k: v for k, v in dimension_scores.items() if k in config.dimension_weights}
    if not available:
        return None
    total_weight = sum(config.dimension_weights[k] for k in available)
    if total_weight == 0:
        return None
    weighted_sum = sum((available[k].severity * config.dimension_weights[k] for k in available), Decimal("0"))
    return quantize(weighted_sum / total_weight, Decimal("0.01"))


def derive_risk_band(composite_score: Decimal | None, config: RiskScoringConfig) -> str:
    """Composite-score-driven band, used only as a fallback: prefer the
    worst individual dimension band when the caller has one (see
    app.services.portfolio_risk.builder), since a single severely
    concentrated dimension is a real risk-profile fact a blended average
    can mask (§15's own reasoning for a profile over a single number)."""
    if composite_score is None:
        return "INSUFFICIENT DATA"
    ordered = sorted(config.band_severity_thresholds.items(), key=lambda kv: kv[1], reverse=True)
    for band, minimum in ordered:
        if composite_score >= minimum:
            return band
    return "LOW"


_BAND_ORDER = ["LOW", "MODERATE", "MODERATE-HIGH", "HIGH"]


def worst_band(bands: list[str]) -> str:
    """The most severe band among a set of per-dimension bands — see
    derive_risk_band's docstring for why this is preferred over the
    composite-score-derived band as the headline risk_band."""
    known = [b for b in bands if b in _BAND_ORDER]
    if not known:
        return "INSUFFICIENT DATA"
    return max(known, key=_BAND_ORDER.index)
