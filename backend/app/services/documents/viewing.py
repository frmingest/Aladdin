"""How a stored filing can be shown back to the user in a browser."""
from __future__ import annotations

from dataclasses import dataclass

_HTML_EXTENSIONS = (".xhtml", ".html", ".htm")


@dataclass(frozen=True)
class Viewing:
    media_type: str
    inline: bool  # a browser can render it; otherwise it is a download
    is_html: bool


def describe_viewing(filename: str, stored_mime_type: str | None) -> Viewing:
    """Decided from the file extension, not the client-supplied mime type
    (which is whatever the browser guessed at upload time)."""
    name = filename.lower()
    if name.endswith(".pdf"):
        return Viewing("application/pdf", inline=True, is_html=False)
    if name.endswith(_HTML_EXTENSIONS):
        # XHTML is served as text/html on purpose: the sandbox CSP applies
        # either way, and text/html renders forgivingly.
        return Viewing("text/html; charset=utf-8", inline=True, is_html=True)
    if name.endswith(".csv"):
        return Viewing("text/csv; charset=utf-8", inline=False, is_html=False)
    return Viewing(stored_mime_type or "application/octet-stream", inline=False, is_html=False)
