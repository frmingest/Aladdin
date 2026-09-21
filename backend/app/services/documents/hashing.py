"""SHA-256 hashing + basic per-type readability checks.

The readability check is a cheap "can we even open this" gate run before
storing (see ingestion.intake_raw_file) — deep structured extraction happens
later and is allowed to fail per-page without rejecting the whole upload;
this only rejects a file that isn't the format it claims to be at all.
"""
from __future__ import annotations

import hashlib
import io

from app.domain.errors import UnreadableFileError

HOLDING_DOCUMENT_EXTENSIONS: tuple[str, ...] = (".pdf", ".pptx", ".xlsx")


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def extension_of(filename: str) -> str:
    idx = filename.rfind(".")
    return filename[idx:].lower() if idx != -1 else ""


def check_basic_readability(filename: str, content: bytes) -> None:
    ext = extension_of(filename)
    try:
        if ext == ".xlsx":
            import openpyxl

            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            wb.close()
        elif ext == ".pdf":
            import pymupdf

            doc = pymupdf.open(stream=content, filetype="pdf")
            try:
                if doc.page_count < 1:
                    raise ValueError("PDF has no pages")
            finally:
                doc.close()
        elif ext == ".pptx":
            from pptx import Presentation

            Presentation(io.BytesIO(content))
        else:
            raise ValueError(f"no readability check defined for extension '{ext}'")
    except Exception as exc:
        raise UnreadableFileError(filename, str(exc)) from exc
