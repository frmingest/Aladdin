"""SHA-256 hashing + basic per-type readability checks (§6.1)."""

import hashlib
import io

from app.domain.errors import UnreadableFileError

PORTFOLIO_EXTENSIONS: tuple[str, ...] = (".csv", ".xlsx")
HOLDING_DOCUMENT_EXTENSIONS: tuple[str, ...] = (".pdf", ".pptx", ".xlsx")


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def extension_of(filename: str) -> str:
    idx = filename.rfind(".")
    return filename[idx:].lower() if idx != -1 else ""


def check_basic_readability(filename: str, content: bytes) -> None:
    """Cheap "can we even open this" check, run before storing (§6.1).
    Deep structured extraction happens later and is allowed to fail per-page
    without rejecting the whole upload (§6.4); this only rejects files that
    aren't the format they claim to be at all."""
    ext = extension_of(filename)
    try:
        if ext == ".csv":
            # Mirrors app.services.portfolio.parser._decode_csv_text: a
            # canonical-schema upload is UTF-8, but the real Nordnet export
            # (decision 0003) is UTF-16 with a BOM despite the .csv
            # extension. This check runs before that parser sees the file
            # at all (§6.1), so it needs the same tolerance or every real
            # Nordnet upload is rejected here as "unreadable" before
            # parsing ever gets a chance to prove otherwise.
            for encoding in ("utf-8-sig", "utf-16"):
                try:
                    content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise UnicodeDecodeError("utf-8-sig/utf-16", content, 0, 1, "not valid UTF-8 or UTF-16 text")
        elif ext == ".xlsx":
            import openpyxl

            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            wb.close()
        elif ext == ".pdf":
            import fitz

            doc = fitz.open(stream=content, filetype="pdf")
            if doc.page_count < 1:
                raise ValueError("PDF has no pages")
            doc.close()
        elif ext == ".pptx":
            from pptx import Presentation

            Presentation(io.BytesIO(content))
        else:
            raise ValueError(f"no readability check defined for extension '{ext}'")
    except UnicodeDecodeError as exc:
        raise UnreadableFileError(filename, f"not valid UTF-8 text: {exc}") from exc
    except Exception as exc:  # noqa: BLE001 — any parser failure means "unreadable"
        raise UnreadableFileError(filename, str(exc)) from exc
