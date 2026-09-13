"""
Deterministic scoring aggregation (architecture §13.2, §26 Phase 3).

The LLM assigns each factor's score/confidence/reasoning — that is
qualitative judgment, the one place §2.2 explicitly allows it. This module
then combines those factor scores into one overall_score the same way every
time for a given scoring_version, so the number that lands on
HoldingAnalysis.overall_score is application code's arithmetic, never the
LLM's (§28 rule 4: "never use an LLM to calculate a metric that application
code can calculate reliably" — the *scores* are the LLM's job, but any
*blend* of them is not). Business quality, financial strength, and
valuation stay visible individually as their own FactorAssessment rows —
this module only produces their weighted blend, it doesn't replace tracking
them separately (§14).
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache

import yaml

from app.config.paths import SCORING_DIR

_CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}
_CONFIDENCE_BY_RANK = {v: k for k, v in _CONFIDENCE_RANK.items()}


class UnknownScoringVersionError(Exception):
    def __init__(self, version: str):
        self.version = version
        super().__init__(f"scoring version '{version}' has no config file under scoring/versions/")


@dataclass(frozen=True)
class ScoringConfig:
    version: str
    factor_weights: dict[str, Decimal]
    confidence_aggregation: str


@lru_cache
def load_scoring_config(version: str) -> ScoringConfig:
    path = SCORING_DIR / f"{version}.yaml"
    if not path.exists():
        raise UnknownScoringVersionError(version)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    weights = {key: Decimal(str(value)) for key, value in raw["factor_weights"].items()}
    return ScoringConfig(
        version=raw["version"],
        factor_weights=weights,
        confidence_aggregation=raw.get("confidence_aggregation", "minimum"),
    )


def compute_overall_score(factor_scores: dict[str, int], scoring_version: str) -> Decimal | None:
    """Weighted average of 1-10 factor scores, per scoring/versions/{version}.yaml.

    Returns None — never a fabricated number — if a factor the scoring
    config expects is missing from `factor_scores`: an incomplete score set
    has no meaningful blended value (§13.3/§21).
    """
    config = load_scoring_config(scoring_version)
    if set(config.factor_weights) - set(factor_scores):
        return None

    total_weight = sum(config.factor_weights.values())
    if total_weight == 0:
        return None

    weighted_sum = sum(
        (Decimal(factor_scores[factor]) * weight for factor, weight in config.factor_weights.items()),
        Decimal("0"),
    )
    return (weighted_sum / total_weight).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def aggregate_confidence(confidences: list[str], scoring_version: str) -> str:
    """Conservative aggregation (§21: never overstate certainty) — the
    default (and only implemented) rule takes the lowest confidence among
    the inputs. `scoring_version` is accepted so a future scoring version's
    `confidence_aggregation` setting can change this rule without a
    call-site change, even though only "minimum" exists today."""
    config = load_scoring_config(scoring_version)
    ranks = [_CONFIDENCE_RANK[c] for c in confidences if c in _CONFIDENCE_RANK]
    if not ranks:
        return "low"
    if config.confidence_aggregation == "minimum":
        return _CONFIDENCE_BY_RANK[min(ranks)]
    raise NotImplementedError(
        f"confidence_aggregation '{config.confidence_aggregation}' is not implemented"
    )
