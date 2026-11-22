"""app/config/log_hygiene.py: no API key in logs, yfinance's pandas warning hidden, others kept."""
from __future__ import annotations

import logging
import warnings

from app.config.log_hygiene import RedactSecretsFilter, quiet_noisy_libraries

FRED_URL = (
    "HTTP Request: GET https://api.stlouisfed.org/fred/series/observations"
    "?series_id=IRLTLT01NOM156N&api_key=SECRETKEY123&file_type=json&limit=12"
)


def _record(msg: str, *args: object) -> logging.LogRecord:
    return logging.LogRecord("httpx", logging.INFO, __file__, 1, msg, args or None, None)


def test_filter_blanks_api_key_but_keeps_the_rest_of_the_url() -> None:
    record = _record(FRED_URL)
    assert RedactSecretsFilter().filter(record) is True
    text = record.getMessage()
    assert "SECRETKEY123" not in text
    assert "api_key=REDACTED" in text
    assert "series_id=IRLTLT01NOM156N" in text and "limit=12" in text


def test_filter_handles_percent_style_args() -> None:
    record = _record("HTTP Request: GET %s", "https://x.test/?api_key=SECRETKEY123")
    RedactSecretsFilter().filter(record)
    assert "SECRETKEY123" not in record.getMessage()


def test_filter_leaves_clean_messages_alone() -> None:
    record = _record("worker started")
    RedactSecretsFilter().filter(record)
    assert record.getMessage() == "worker started"


def test_httpx_info_is_silenced_and_call_is_idempotent() -> None:
    quiet_noisy_libraries()
    quiet_noisy_libraries()
    assert logging.getLogger("httpx").level == logging.WARNING
    assert logging.getLogger("httpcore").level == logging.WARNING
    root_filters = [f for f in logging.getLogger().filters if isinstance(f, RedactSecretsFilter)]
    assert len(root_filters) == 1


def _emit(message: str, module_name: str) -> list[warnings.WarningMessage]:
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        quiet_noisy_libraries()  # adds the ignore rule on top of "always"
        warnings.warn_explicit(
            message, DeprecationWarning, filename=f"/x/{module_name}.py", lineno=1, module=module_name
        )
    return caught


def test_yfinance_inplace_warning_is_hidden() -> None:
    caught = _emit("The inplace keyword in DataFrame.sort_index is deprecated", "yfinance.utils")
    assert caught == []


def test_same_warning_from_our_code_is_still_shown() -> None:
    caught = _emit("The inplace keyword in DataFrame.sort_index is deprecated", "app.services.x")
    assert len(caught) == 1


def test_other_yfinance_warnings_are_still_shown() -> None:
    caught = _emit("something else entirely", "yfinance.utils")
    assert len(caught) == 1
