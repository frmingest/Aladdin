"""Versioned currency -> FRED series-id mapping for the DCF discount rate's
risk-free-rate term (Sprint 3 — see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md).

CLAUDE.md Rule 3: a change that could alter a real analysis output is a
*new* version, never an in-place edit of one already used for a real run —
so this is a versioned mapping (`_V1`, `_V2`, ...), selected by
Settings.active_risk_free_rate_series_version, not a single mutable dict.

v1 uses FRED for every currency, including non-US ones, rather than a
separate Norges Bank integration: FRED republishes the OECD's own
long-term (10-year) government bond yield series for most economies
(monthly, "Main (Including Benchmark)" methodology, series pattern
IRLTLT01<country><M156N>) alongside the US's own daily 10-Year Treasury
series (DGS10) — one vendor, one API key, covers the portfolio's actual
currency mix (USD/NOK/EUR/GBP) without a second integration. This is a
deliberate simplification versus the sprint plan Backlog's "Numeric macro
data & scheduler" candidate (FRED *and* Norges Bank), which is a
different, broader, still-deferred subsystem (macro_observations) — the
DCF discount rate only ever needs one number per currency, not a full
central-bank data pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RiskFreeRateSeries:
    series_id: str
    frequency: str  # "daily" | "monthly" — informational, surfaced in API output


_V1: dict[str, RiskFreeRateSeries] = {
    # 10-Year Treasury Constant Maturity Rate — daily.
    "USD": RiskFreeRateSeries(series_id="DGS10", frequency="daily"),
    # OECD Main Economic Indicators — Long-Term Government Bond Yields:
    # 10-Year: Main (Including Benchmark) — monthly.
    "NOK": RiskFreeRateSeries(series_id="IRLTLT01NOM156N", frequency="monthly"),
    "EUR": RiskFreeRateSeries(series_id="IRLTLT01EZM156N", frequency="monthly"),
    "GBP": RiskFreeRateSeries(series_id="IRLTLT01GBM156N", frequency="monthly"),
}

RISK_FREE_RATE_SERIES_VERSIONS: dict[str, dict[str, RiskFreeRateSeries]] = {"v1": _V1}


def get_series_map(version: str) -> dict[str, RiskFreeRateSeries]:
    try:
        return RISK_FREE_RATE_SERIES_VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown risk-free-rate series version: {version!r}") from exc
