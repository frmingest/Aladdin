"""Removes embedded media (base64 images and fonts) from an inline-XBRL file.

ESEF annual reports are one self-contained .xhtml: every photo, chart and
font is inlined as a ``data:<mime>;base64,...`` URI. That is most of the
file (Orkla 2025: ~99 MB), none of it is a tagged fact or report text, and
it is what pushed large reports over the upload limit, the object-storage
file limit and the parser's memory.

What is removed: only the base64 payload of a data URI (in ``src``/``href``
attributes and CSS ``url(...)``). The URI stays, empty
(``data:image/png;base64,``), so the markup is still well-formed and valid.
Every ix: tag, context, unit and text node is untouched, so the extracted
facts and page text are identical to those from the original file (tested).

Payloads under ``MIN_PAYLOAD_BYTES`` are left alone (tiny icons; not worth
changing the file for).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

MIN_PAYLOAD_BYTES = 1_024

# data:<type>/<subtype>[;param=value]*;base64,<payload>
# The payload may be wrapped over several lines, or carry XML character
# references for those line breaks (&#10; &#13; &#xA; &#xD;) when it sits in
# an attribute. Base64 never contains a quote, '<', '&' (other than those
# references) or ')', so the match can't run past the end of the attribute
# or the CSS url(...).
_DATA_URI = re.compile(
    rb"(data:[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+(?:;[A-Za-z0-9.+=-]+)*;base64,)"
    rb"((?:[A-Za-z0-9+/=\s]+|&#(?:1[03]|x[aAdD]);)+)"
)


@dataclass(frozen=True)
class SlimResult:
    content: bytes
    removed_count: int
    removed_bytes: int
    original_bytes: int

    def as_flag(self) -> dict[str, int]:
        return {
            "items": self.removed_count,
            "bytes_removed": self.removed_bytes,
            "original_size_bytes": self.original_bytes,
            "stored_size_bytes": len(self.content),
        }


def strip_embedded_media(content: bytes) -> SlimResult:
    removed_count = 0
    removed_bytes = 0

    def _empty(match: re.Match[bytes]) -> bytes:
        nonlocal removed_count, removed_bytes
        payload = match.group(2)
        if len(payload) < MIN_PAYLOAD_BYTES:
            return match.group(0)
        removed_count += 1
        removed_bytes += len(payload)
        return match.group(1)

    if b"base64," not in content:
        return SlimResult(content, 0, 0, len(content))
    slim = _DATA_URI.sub(_empty, content)
    if removed_count == 0:
        return SlimResult(content, 0, 0, len(content))
    return SlimResult(slim, removed_count, removed_bytes, len(content))
