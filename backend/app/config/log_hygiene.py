"""Keep third-party log and warning noise from leaking secrets or burying real output.

Two things this fixes, both seen in the local worker's terminal (2026-11-22):

* `httpx` logs every request URL at INFO. The FRED provider
  (app/providers/fred_risk_free_rate_provider.py) sends its key as the `api_key`
  query parameter, so the full key was printed on every call. `httpx` and
  `httpcore` are held at WARNING, and a log-record factory redacts `api_key=` style values at record
  creation, including in traceback text (an `httpx` status error embeds the full URL).
* yfinance 1.7.0 uses `inplace=True` internally, which pandas 3.1 flags with a
  `Pandas4Warning` on every fetch. It is the library's code, not ours, and it only
  matters when pandas 4 removes `inplace`; the warning filter hides that one warning and
  leaves every other warning alone.
"""
from __future__ import annotations

import logging
import re
import warnings

_QUIET_LOGGERS = ("httpx", "httpcore")
# Only query-string parameters (`?api_key=...`, `&token=...`), so free text such as
# `cited key=E12` is never blanked.
_SECRET_PARAM = re.compile(r"(?i)(?<=[?&])(api_key|apikey|key|token)=[^&\s\"']+")
_INSTALLED_FLAG = "_aladdin_redacting"


def redact(text: str) -> str:
    return _SECRET_PARAM.sub(lambda m: f"{m.group(1)}=REDACTED", text)


def _redacting_factory(previous):
    """A LogRecord factory that redacts at creation, so it covers every logger and handler
    (uvicorn's included, whenever they are set up) and the traceback text too."""

    def factory(*args, **kwargs) -> logging.LogRecord:
        record = previous(*args, **kwargs)
        try:
            message = record.getMessage()
        except Exception:  # noqa: BLE001 - a malformed log call must fail where logging reports it, not here
            message = None
        if message is not None:
            redacted = redact(message)
            if redacted != message:
                record.msg = redacted
                record.args = ()
        if record.exc_info and record.exc_info[0] is not None:
            # The Formatter adds the traceback later; fixing exc_text now means it never sees the key.
            record.exc_text = redact(logging.Formatter().formatException(record.exc_info))
        return record

    setattr(factory, _INSTALLED_FLAG, True)
    return factory


def quiet_noisy_libraries() -> None:
    """Call once at process start. Safe to call twice."""
    for name in _QUIET_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    current = logging.getLogRecordFactory()
    if not getattr(current, _INSTALLED_FLAG, False):
        logging.setLogRecordFactory(_redacting_factory(current))
    warnings.filterwarnings(
        "ignore",
        message=r"The inplace keyword in DataFrame\.",
        module=r"yfinance(\..*)?",
    )
