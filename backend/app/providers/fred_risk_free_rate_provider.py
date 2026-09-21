"""FRED-backed RiskFreeRateProvider (Sprint 3 — DCF discount rate).

Calls FRED's public `series/observations` endpoint for the mapped series
(app/domain/risk_free_rate_series.py) and returns its most recent *real*
observation. FRED marks a not-yet-published period with "." (their own
documented missing-value sentinel, not zero) — skipped in favor of the
next most recent actual value, never treated as a rate of 0%.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import httpx

from app.domain.risk_free_rate_series import get_series_map
from app.providers.base import (
    RiskFreeRate,
    RiskFreeRateProvider,
    RiskFreeRateUnavailableError,
)

_PROVIDER_NAME = "fred"
_FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
_MISSING_VALUE_SENTINEL = "."


class FredRiskFreeRateProvider(RiskFreeRateProvider):
    name = _PROVIDER_NAME

    def __init__(
        self, *, api_key: str, series_version: str = "v1", timeout_seconds: float = 10.0
    ) -> None:
        self._api_key = api_key
        self._series_map = get_series_map(series_version)
        self._timeout_seconds = timeout_seconds

    def get_risk_free_rate(self, currency: str) -> RiskFreeRate:
        currency = currency.upper()
        series = self._series_map.get(currency)
        if series is None:
            raise RiskFreeRateUnavailableError(
                f"No FRED series mapped for currency {currency!r} "
                "(app/domain/risk_free_rate_series.py) — add one before requesting this currency."
            )
        if not self._api_key:
            raise RiskFreeRateUnavailableError(
                "FRED_API_KEY is not set — get a free key at "
                "https://fred.stlouisfed.org/docs/api/api_key.html"
            )

        try:
            response = httpx.get(
                _FRED_OBSERVATIONS_URL,
                params={
                    "series_id": series.series_id,
                    "api_key": self._api_key,
                    "file_type": "json",
                    "sort_order": "desc",
                    "limit": 12,  # a year of headroom in case recent months are still "."
                },
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as exc:
            raise RiskFreeRateUnavailableError(
                f"FRED request failed for {series.series_id}: {exc}"
            ) from exc

        for observation in payload.get("observations", []):
            raw_value = observation.get("value")
            if raw_value is None or raw_value == _MISSING_VALUE_SENTINEL:
                continue
            try:
                rate = Decimal(raw_value)
            except InvalidOperation:
                continue
            return RiskFreeRate(
                currency=currency,
                rate=rate,
                observed_at=_parse_date(observation.get("date")),
                provider=self.name,
                source_series_id=series.series_id,
            )

        raise RiskFreeRateUnavailableError(
            f"FRED series {series.series_id} returned no usable (non-missing) observations"
        )


def _parse_date(raw_date: str | None) -> datetime:
    if not raw_date:
        return datetime.now(timezone.utc)
    try:
        return datetime.strptime(raw_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)
