"""Unit tests for FredRiskFreeRateProvider, mocking httpx.get (no real
network call, no real FRED quota spent)."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.providers.base import RiskFreeRateUnavailableError
from app.providers.fred_risk_free_rate_provider import FredRiskFreeRateProvider


def _provider(**overrides) -> FredRiskFreeRateProvider:
    kwargs = {"api_key": "test-key", "series_version": "v1"}
    kwargs.update(overrides)
    return FredRiskFreeRateProvider(**kwargs)


def _fake_response(observations: list[dict]) -> MagicMock:
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"observations": observations}
    return response


def test_missing_api_key_raises_immediately():
    provider = _provider(api_key="")
    with pytest.raises(RiskFreeRateUnavailableError, match="FRED_API_KEY"):
        provider.get_risk_free_rate("USD")


def test_unmapped_currency_raises_before_any_call():
    provider = _provider()
    with patch("app.providers.fred_risk_free_rate_provider.httpx.get") as mock_get:
        with pytest.raises(RiskFreeRateUnavailableError, match="No FRED series mapped"):
            provider.get_risk_free_rate("JPY")
        mock_get.assert_not_called()


def test_returns_the_latest_real_observation():
    provider = _provider()
    response = _fake_response([{"date": "2026-09-01", "value": "4.25"}])
    with patch("app.providers.fred_risk_free_rate_provider.httpx.get", return_value=response) as mock_get:
        rate = provider.get_risk_free_rate("usd")
    assert rate.currency == "USD"
    assert rate.rate == Decimal("4.25")
    assert rate.provider == "fred"
    assert rate.source_series_id == "DGS10"
    called_params = mock_get.call_args.kwargs["params"]
    assert called_params["series_id"] == "DGS10"
    assert called_params["api_key"] == "test-key"


def test_skips_missing_value_sentinel_and_uses_next_real_observation():
    provider = _provider()
    response = _fake_response(
        [
            {"date": "2026-09-01", "value": "."},
            {"date": "2026-08-01", "value": "4.10"},
        ]
    )
    with patch("app.providers.fred_risk_free_rate_provider.httpx.get", return_value=response):
        rate = provider.get_risk_free_rate("USD")
    assert rate.rate == Decimal("4.10")


def test_raises_when_every_observation_is_missing():
    provider = _provider()
    response = _fake_response([{"date": "2026-09-01", "value": "."}])
    with (
        patch("app.providers.fred_risk_free_rate_provider.httpx.get", return_value=response),
        pytest.raises(RiskFreeRateUnavailableError, match="no usable"),
    ):
        provider.get_risk_free_rate("USD")


def test_http_error_raises_risk_free_rate_unavailable():
    import httpx

    provider = _provider()
    with patch(
        "app.providers.fred_risk_free_rate_provider.httpx.get",
        side_effect=httpx.ConnectError("boom"),
    ), pytest.raises(RiskFreeRateUnavailableError):
        provider.get_risk_free_rate("USD")


def test_norwegian_krone_maps_to_oecd_series():
    provider = _provider()
    response = _fake_response([{"date": "2026-09-01", "value": "3.90"}])
    with patch("app.providers.fred_risk_free_rate_provider.httpx.get", return_value=response) as mock_get:
        rate = provider.get_risk_free_rate("NOK")
    assert rate.source_series_id == "IRLTLT01NOM156N"
    assert mock_get.call_args.kwargs["params"]["series_id"] == "IRLTLT01NOM156N"
