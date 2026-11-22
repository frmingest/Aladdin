"""app/config/log_hygiene.py: no API key in logs or tracebacks, yfinance's pandas warning hidden, others kept."""
from __future__ import annotations

import io
import logging
import warnings

import pytest

from app.config.log_hygiene import quiet_noisy_libraries, redact

FRED_URL = (
    "HTTP Request: GET https://api.stlouisfed.org/fred/series/observations"
    "?series_id=IRLTLT01NOM156N&api_key=SECRETKEY123&file_type=json&limit=12"
)


@pytest.fixture
def captured():
    """Install the hygiene, log through a fresh logger into a buffer, restore the factory after."""
    original = logging.getLogRecordFactory()
    quiet_noisy_libraries()
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    log = logging.getLogger("test_log_hygiene")
    log.setLevel(logging.INFO)
    log.addHandler(handler)
    yield log, stream
    log.removeHandler(handler)
    logging.setLogRecordFactory(original)


def test_redact_blanks_api_key_but_keeps_the_rest_of_the_url() -> None:
    text = redact(FRED_URL)
    assert "SECRETKEY123" not in text
    assert "api_key=REDACTED" in text
    assert "series_id=IRLTLT01NOM156N" in text and "limit=12" in text


def test_free_text_key_and_token_are_not_blanked() -> None:
    assert redact("cited key=E12 and token=7") == "cited key=E12 and token=7"


def test_message_with_percent_style_args_is_redacted(captured) -> None:
    log, stream = captured
    log.info("HTTP Request: GET %s", "https://x.test/?api_key=SECRETKEY123")
    assert "SECRETKEY123" not in stream.getvalue()
    assert "api_key=REDACTED" in stream.getvalue()


def test_traceback_text_is_redacted(captured) -> None:
    log, stream = captured
    try:
        raise RuntimeError("failed for url 'https://x.test/?a=1&api_key=SECRETKEY123'")
    except RuntimeError:
        log.exception("job crashed")
    out = stream.getvalue()
    assert "job crashed" in out and "RuntimeError" in out
    assert "SECRETKEY123" not in out


def test_clean_messages_are_untouched(captured) -> None:
    log, stream = captured
    log.info("worker started")
    assert "INFO test_log_hygiene: worker started" in stream.getvalue()


def test_httpx_info_is_silenced_and_install_is_idempotent() -> None:
    original = logging.getLogRecordFactory()
    try:
        quiet_noisy_libraries()
        first = logging.getLogRecordFactory()
        quiet_noisy_libraries()
        assert logging.getLogRecordFactory() is first
        assert logging.getLogger("httpx").level == logging.WARNING
        assert logging.getLogger("httpcore").level == logging.WARNING
    finally:
        logging.setLogRecordFactory(original)


def _emit(message: str, module_name: str) -> list[warnings.WarningMessage]:
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        quiet_noisy_libraries()  # adds the ignore rule on top of "always"
        warnings.warn_explicit(
            message, DeprecationWarning, filename=f"/x/{module_name}.py", lineno=1, module=module_name
        )
    return caught


def test_yfinance_inplace_warning_is_hidden() -> None:
    assert _emit("The inplace keyword in DataFrame.sort_index is deprecated", "yfinance.utils") == []


def test_same_warning_from_our_code_is_still_shown() -> None:
    assert len(_emit("The inplace keyword in DataFrame.sort_index is deprecated", "app.services.x")) == 1


def test_other_yfinance_warnings_are_still_shown() -> None:
    assert len(_emit("something else entirely", "yfinance.utils")) == 1
