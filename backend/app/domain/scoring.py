"""
Deterministic scoring aggregation (architecture §13.1/§13.2, §26 Phase 3;
regime-conditional weighting is the ECON-002 fix, docs/decisions/
0014-macro-economic-review.md).

The LLM assigns each factor's score/confidence/reasoning — that is
qualitative judgment, the one place §2.2 explicitly allows it. This module
then combines those factor scores into one overall_score the same way every
time for a given (scoring_version, macro_regime) pair, so the number that
lands on HoldingAnalysis.overall_score is application code's arithmetic,
never the LLM's (§28 rule 4: "never use an LLM to calculate a metric that
application code can calculate reliably" — the *scores* are the LLM's job,
but any *blend* of them is not). Business quality, financial strength, and
valuation stay visible individually as their own FactorAssessment rows —
this module only produces their weighted blend, it doesn't replace tracking
them separately (§14).

Regime-conditional weighting (§13.1): "Fixed weights implicitly assume
macro/geopolitical factors matter the same amount in every environment...
define a small set of named weight profiles (e.g. baseline, stagflation,
crisis)... with a macro_regime field on the analysis run." A scoring
version's config can define either a flat `factor_weights` mapping (v1 —
always "baseline", regime-blind) or a `factor_weight_profiles` mapping of
named profiles plus `regime_classification` thresholds (v2+) —
`load_scoring_config` normalizes the former into a single-profile shape so
every call site only ever deals with profiles, and an older scoring version
keeps behaving exactly as it did before this module supported profiles.
"""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache

import yaml

from app.config.paths import SCORING_DIR

_CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}
_CONFIDENCE_BY_RANK = {v: k for k, v in _CONFIDENCE_RANK.items()}

# The profile every scoring version must define — a flat v1-style
# `factor_weights` mapping is loaded as this one profile, and
# classify_macro_regime always falls back to it (§21: never guess a
# regime when the classifying data isn't there).
BASELINE_REGIME = "baseline"

_THRESHOLD_COMPARATORS = {
    "_at_least": lambda value, threshold: value >= threshold,
    "_at_most": lambda value, threshold: value <= threshold,
}


class UnknownScoringVersionError(Exception):
    def __init__(self, version: str):
        self.version = version
        super().__init__(f"scoring version '{version}' has no config file under scoring/versions/")


@dataclass(frozen=True)
class ScoringConfig:
    version: str
    # {profile_name: {factor: weight}} — always has at least "baseline".
    factor_weight_profiles: dict[str, dict[str, Decimal]]
    # {regime_name: {threshold_key: value}}, checked in file order (§28 rule
    # 8: order is data, not an if/elif chain) — empty for a scoring version
    # with no regime_classification section (e.g. v1), so
    # classify_macro_regime always returns "baseline" for it.
    regime_classification: dict[str, dict[str, Decimal]] = field(default_factory=dict)
    confidence_aggregation: str = "minimum"

    @property
    def factor_weights(self) -> dict[str, Decimal]:
        """Pre-ECON-002 shape, kept for callers that only ever cared about
        one blend: the baseline profile's weights."""
        return self.factor_weight_profiles.get(BASELINE_REGIME, {})

    def weights_for_regime(self, regime: str) -> dict[str, Decimal]:
        """Falls back to baseline for a regime name this config doesn't
        define a profile for — a scoring version is never required to
        define every possible regime name (§21: degrade to the known-safe
        default rather than error on an unrecognized-but-harmless input)."""
        return self.factor_weight_profiles.get(regime) or self.factor_weight_profiles[BASELINE_REGIME]


@lru_cache
def load_scoring_config(version: str) -> ScoringConfig:
    path = SCORING_DIR / f"{version}.yaml"
    if not path.exists():
        raise UnknownScoringVersionError(version)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))

    if "factor_weight_profiles" in raw:
        profiles = {
            profile_name: {factor: Decimal(str(w)) for factor, w in weights.items()}
            for profile_name, weights in raw["factor_weight_profiles"].items()
        }
    else:
        # v1-style flat mapping — always exactly one profile, "baseline".
        profiles = {BASELINE_REGIME: {factor: Decimal(str(w)) for factor, w in raw["factor_weights"].items()}}

    regime_classification = {
        regime_name: {key: Decimal(str(value)) for key, value in thresholds.items()}
        for regime_name, thresholds in (raw.get("regime_classification") or {}).items()
    }

    return ScoringConfig(
        version=raw["version"],
        factor_weight_profiles=profiles,
        regime_classification=regime_classification,
        confidence_aggregation=raw.get("confidence_aggregation", "minimum"),
    )


def classify_macro_regime(latest_macro_values: dict[str, Decimal], scoring_version: str) -> str:
    """Deterministic regime classification against whatever macro series a
    scoring version's `regime_classification` section names — currently
    `us_real_yield_10y`/`us_headline_cpi_yoy` (research/versions/v1.yaml,
    app.services.research.macro.get_latest_macro_snapshot — pass its
    `.observations` reshaped to `{series_key: value}`).

    Regimes are checked in the config's file order and the first match
    wins (v2.yaml lists "crisis" before "stagflation" so a reading
    qualifying for both is classified as the more severe one). Falls back
    to BASELINE_REGIME whenever a candidate regime's required series
    aren't in `latest_macro_values` (no macro refresh has run yet, or an
    older scoring version defines no regimes at all) rather than guessing
    (§21) — this is also v1's only profile, so a pre-ECON-002 scoring
    version behaves exactly as before.
    """
    config = load_scoring_config(scoring_version)
    for regime_name, thresholds in config.regime_classification.items():
        if _regime_thresholds_met(latest_macro_values, thresholds):
            return regime_name
    return BASELINE_REGIME


def _regime_thresholds_met(latest_macro_values: dict[str, Decimal], thresholds: dict[str, Decimal]) -> bool:
    for key, threshold in thresholds.items():
        for suffix, comparator in _THRESHOLD_COMPARATORS.items():
            if key.endswith(suffix):
                series_key = key[: -len(suffix)]
                value = latest_macro_values.get(series_key)
                if value is None or not comparator(value, threshold):
                    return False
                break
        else:
            raise ValueError(f"unrecognized regime-classification threshold key '{key}'")
    return True


def compute_overall_score(
    factor_scores: dict[str, int], scoring_version: str, regime: str = BASELINE_REGIME
) -> Decimal | None:
    """Weighted average of 1-10 factor scores, per scoring/versions/{version}.yaml's
    weight profile for `regime` (defaults to "baseline" — a pre-ECON-002
    caller that never passes `regime` gets exactly its old behavior).

    Returns None — never a fabricated number — if a factor the resolved
    weight profile expects is missing from `factor_scores`: an incomplete
    score set has no meaningful blended value (§13.3/§21).
    """
    config = load_scoring_config(scoring_version)
    weights = config.weights_for_regime(regime)
    if set(weights) - set(factor_scores):
        return None

    total_weight = sum(weights.values())
    if total_weight == 0:
        return None

    weighted_sum = sum(
        (Decimal(factor_scores[factor]) * weight for factor, weight in weights.items()),
        Decimal("0"),
    )
    return (weighted_sum / total_weight).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def aggregate_confidence(confidences: list[str], scoring_version: str) -> str:
    """Conservative aggregation (§21: never overstate certainty) — the
    default (and only implemented) rule takes the lowest confidence among
    the inputs. `scoring_version` is accepted so a future scoring version's
    `confidence_aggregation` setting can change this rule without a
    call-site change, even though only "minimum" exists today. Independent
    of macro regime — regime conditions the factor *weights*, not how
    confidence is aggregated."""
    config = load_scoring_config(scoring_version)
    ranks = [_CONFIDENCE_RANK[c] for c in confidences if c in _CONFIDENCE_RANK]
    if not ranks:
        return "low"
    if config.confidence_aggregation == "minimum":
        return _CONFIDENCE_BY_RANK[min(ranks)]
    raise NotImplementedError(
        f"confidence_aggregation '{config.confidence_aggregation}' is not implemented"
    )
