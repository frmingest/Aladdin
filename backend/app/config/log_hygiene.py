"""Keep third-party log and warning noise from leaking secrets or burying real output.

Two things this fixes, both seen in the local worker's terminal (2026-11-22):

* `httpx` logs every request URL at INFO. The FRED provider
  (app/providers/fred_risk_free_rate_provider.py) sends its key as the `api_key`
  query parameter, so the full key was printed on every call. `httpx` and
  `httpcore` are held at WARNING, and a filter blanks any `api_key=` value that
  still reaches a log line (an error message that embeds a URL, say).
* yfinance 1.7.0 uses `inplace=True` internally, which pandas 3.1 flags with a
  `Pandas4Warning` on every fetch. It is the library's code, not ours, and it only
  matters when pandas 4 removes `inplace`; the filter hides that one warning and
  leaves every other warning alone.
"""
from __future__ import annotations

import logging
import re
import warnings

_QUIET_LOGGERS = ("httpx", "httpcore")
_SECRET_PARAM = re.compile(r"(?i)\b(api_key|apikey|key|token)=[^&\s\"']+")


class RedactSecretsFilter(logging.Filter):
    """Blank the value of secret-looking query parameters in a log message."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        redacted = _SECRET_PARAM.sub(lambda m: f"{m.group(1)}=REDACTED", message)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


def quiet_noisy_libraries() -> None:
    """Call once at process start, after logging is configured. Safe to call twice."""
    for name in _QUIET_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    root = logging.getLogger()
    if not any(isinstance(f, RedactSecretsFilter) for f in root.filters):
        root.addFilter(RedactSecretsFilter())
    for handler in root.handlers:
        if not any(isinstance(f, RedactSecretsFilter) for f in handler.filters):
            handler.addFilter(RedactSecretsFilter())
    warnings.filterwarnings(
        "ignore",
        message=r"The inplace keyword in DataFrame\.",
        module=r"yfinance(\..*)?",
    )
