"""Sovereign Stress Index — pure calculation, no I/O (ported from CWO's
sovereign_stress_calculator.py with the fixes listed in
app/domain/country_risk_assumptions/v1.py).

Every input is optional. A component with no input is left out and the
SSI is the weighted mean of the components that remain (CWO's
partial-coverage reweighting), with a `data_quality` flag and the list of
missing components — a missing figure stays missing, it is never replaced
by a neutral placeholder (CWO's fetcher used 5.0 for missing political
stability; that is exactly the kind of fallback this port leaves behind).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from app.domain.country_risk_assumptions import CountryRiskAssumptions

COMPONENT_LABELS: dict[str, str] = {
    "debt_trajectory": "Debt level and trajectory",
    "fiscal_deficit": "Fiscal deficit",
    "current_account": "Current account",
    "reserve_coverage": "Reserve coverage",
    "political_stability": "Political stability",
    "growth": "Real growth (latest actual)",
}


@dataclass(frozen=True)
class SSIInputs:
    debt_to_gdp: Decimal | None = None
    debt_to_gdp_3y_avg: Decimal | None = None
    fiscal_balance_gdp: Decimal | None = None  # + surplus / - deficit (World Bank sign)
    fiscal_balance_change: Decimal | None = None  # pp change in the balance over the window; + = improving
    current_account_gdp: Decimal | None = None
    reserves_months_imports: Decimal | None = None
    external_debt_to_reserves_pct: Decimal | None = None
    political_stability_score: Decimal | None = None  # 1..10, higher = more stable
    gdp_growth_latest: Decimal | None = None
    gdp_growth_3y_avg: Decimal | None = None


@dataclass
class SSIResult:
    score: Decimal | None
    band: str | None
    components: dict[str, Decimal] = field(default_factory=dict)
    missing: list[str] = field(default_factory=list)
    data_quality: str = "insufficient"  # high (>=5 components) | medium (>=3) | low | insufficient
    assumptions_version: str = "v1"


def _band_below(value: Decimal, bands: tuple[tuple[Decimal, int], ...], above: int) -> int:
    for upper, stress in bands:
        if value < upper:
            return stress
    return above


def _band_above(value: Decimal, bands: tuple[tuple[Decimal, int], ...], below: int) -> int:
    for lower, stress in bands:
        if value > lower:
            return stress
    return below


def _clamp(value: Decimal) -> Decimal:
    return max(Decimal(0), min(Decimal(100), value))


def debt_stress(a: CountryRiskAssumptions, debt: Decimal | None, avg3: Decimal | None) -> Decimal | None:
    if debt is None:
        return None
    stress = Decimal(_band_below(debt, a.debt_gdp_bands, a.debt_gdp_above_top))
    if avg3 is not None:
        rise = debt - avg3
        for threshold, bump in a.debt_trajectory_adjustments:
            if rise > threshold:
                stress += bump
                break
        else:
            if rise < a.debt_falling_threshold:
                stress += a.debt_falling_adjustment
    return _clamp(stress)


def deficit_stress(a: CountryRiskAssumptions, balance: Decimal | None, change: Decimal | None) -> Decimal | None:
    if balance is None:
        return None
    # ECON-F22-11: a surplus is a zero deficit, not |surplus|.
    deficit = max(Decimal(0), -balance)
    stress = Decimal(_band_below(deficit, a.deficit_bands, a.deficit_above_top))
    if change is not None:
        # CWO's trend rule, in balance terms: the balance falling by >2pp
        # (deficit widening) +10, by >1pp +5; improving by >1pp -10.
        if change < -2:
            stress += 10
        elif change < -1:
            stress += 5
        elif change > 1:
            stress -= 10
    return _clamp(stress)


def current_account_stress(a: CountryRiskAssumptions, ca: Decimal | None) -> Decimal | None:
    if ca is None:
        return None
    return Decimal(_band_above(ca, a.current_account_bands, a.current_account_below_all))


def reserve_stress(
    a: CountryRiskAssumptions, months: Decimal | None, ext_debt_reserves: Decimal | None
) -> Decimal | None:
    parts: list[Decimal] = []
    if months is not None:
        parts.append(Decimal(_band_above(months, a.reserve_months_bands, a.reserve_months_below_all)))
    if ext_debt_reserves is not None:
        parts.append(
            Decimal(_band_below(ext_debt_reserves, a.external_debt_reserves_bands, a.external_debt_reserves_above_all))
        )
    return sum(parts) / len(parts) if parts else None


def political_stress(score: Decimal | None) -> Decimal | None:
    if score is None:
        return None
    return _clamp(Decimal(100) - score * 10)


def growth_stress(a: CountryRiskAssumptions, latest: Decimal | None, avg3: Decimal | None) -> Decimal | None:
    if latest is None:
        return None
    stress = Decimal(_band_above(latest, a.growth_bands, a.growth_below_all))
    if avg3 is not None:
        decel = avg3 - latest
        if decel > 2:
            stress += 10
        elif decel > 1:
            stress += 5
    return _clamp(stress)


def compute_ssi(inputs: SSIInputs, assumptions: CountryRiskAssumptions) -> SSIResult:
    a = assumptions
    raw = {
        "debt_trajectory": debt_stress(a, inputs.debt_to_gdp, inputs.debt_to_gdp_3y_avg),
        "fiscal_deficit": deficit_stress(a, inputs.fiscal_balance_gdp, inputs.fiscal_balance_change),
        "current_account": current_account_stress(a, inputs.current_account_gdp),
        "reserve_coverage": reserve_stress(a, inputs.reserves_months_imports, inputs.external_debt_to_reserves_pct),
        "political_stability": political_stress(inputs.political_stability_score),
        "growth": growth_stress(a, inputs.gdp_growth_latest, inputs.gdp_growth_3y_avg),
    }
    components = {k: v for k, v in raw.items() if v is not None}
    missing = [k for k, v in raw.items() if v is None]
    result = SSIResult(score=None, band=None, components=components, missing=missing, assumptions_version=a.version)
    if not components:
        return result
    total_weight = sum(a.weights[k] for k in components)
    score = sum(components[k] * a.weights[k] for k in components) / total_weight
    score = score.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    result.score = score
    for upper, label in a.stress_bands:
        if score < upper:
            result.band = label
            break
    n = len(components)
    result.data_quality = "high" if n >= 5 else "medium" if n >= 3 else "low"
    return result
