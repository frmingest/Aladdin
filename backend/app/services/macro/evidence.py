"""Macro indicator items for the analysis evidence packets (company v5,
fund-v2). One item per indicator, numbers already computed by
app/services/macro/indicators.py (CLAUDE.md Rule 1), each citing the
publisher's series (Rule 2)."""
from __future__ import annotations

import logging
from collections.abc import Callable
from decimal import Decimal

from sqlalchemy.orm import Session

from app.providers.macro_data_providers import MacroDataProvider
from app.services.macro.indicators import (
    IndicatorSnapshot,
    MacroIndicators,
    get_macro_indicators,
)
from app.services.macro.refresh import refresh_macro_data

logger = logging.getLogger(__name__)

CATEGORY = "macro_indicator"


def _fmt_value(snap: IndicatorSnapshot, value: Decimal) -> str:
    if snap.display_unit == "%":
        return f"{value}%"
    if snap.display_unit == "pp":
        return f"{value} pp"
    return f"{value} {snap.display_unit}"


def _fmt_change(snap: IndicatorSnapshot, change: Decimal) -> str:
    sign = "+" if change > 0 else ""
    return f"{sign}{change} {'pp' if snap.change_kind == 'pp' else '%'}"


def describe(snap: IndicatorSnapshot) -> str:
    if snap.value is None:
        return "No observations stored yet."
    as_of = snap.observed_on.strftime("%Y-%m") if snap.frequency == "monthly" else snap.observed_on.isoformat()
    parts = [f"{_fmt_value(snap, snap.value)} as of {as_of}"]
    if snap.derived and snap.formula:
        parts[0] += f" (computed: {snap.formula})"
    else:
        parts[0] += f" ({snap.frequency})"
    for months, earlier, change in ((3, snap.value_3m_ago, snap.change_3m), (12, snap.value_12m_ago, snap.change_12m)):
        if earlier is not None and change is not None:
            parts.append(f"{months} months earlier: {_fmt_value(snap, earlier)} (change {_fmt_change(snap, change)})")
    text = "; ".join(parts) + "."
    if snap.stale:
        text += f" STALE: latest observation is {snap.age_days} days old."
    if snap.description:
        text += f" {snap.description}"
    return text


def ensure_macro_fresh(db: Session, provider: MacroDataProvider | None) -> None:
    """Best effort: refresh stale series before a packet is built. Never
    raises; a failure leaves the stored values (flagged stale if old)."""
    if provider is None:
        return
    try:
        refresh_macro_data(db, provider, only_stale=True)
    except Exception:
        logger.exception("macro refresh before analysis failed")
        db.rollback()


def add_macro_indicator_evidence(
    db: Session, add: Callable, unavailable_reasons: list[str]
) -> MacroIndicators:
    indicators = get_macro_indicators(db)
    if not indicators.any_available:
        add(
            CATEGORY,
            "Numeric macro indicators",
            "No policy-rate, yield, inflation or FX observations have been captured yet.",
        )
        unavailable_reasons.append("macro indicators: none captured yet (Macro page -> Refresh data)")
        return indicators
    missing = []
    for snap in indicators.indicators:
        if snap.value is None:
            missing.append(snap.label)
            continue
        add(
            CATEGORY,
            f"{snap.label} ({snap.region})",
            describe(snap),
            citation=f"{snap.source_name} — series {snap.source_series_id} — {snap.source_url}",
        )
    for snap in indicators.derived:
        if snap.value is not None:
            add(CATEGORY, f"{snap.label} ({snap.region}, computed)", describe(snap))
    if missing:
        unavailable_reasons.append(f"macro indicators missing: {', '.join(missing)}")
    stale = [s.label for s in indicators.indicators if s.stale]
    if stale:
        unavailable_reasons.append(f"macro indicators stale: {', '.join(stale)}")
    return indicators
