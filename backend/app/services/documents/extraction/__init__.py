from app.domain.errors import UnsupportedFileTypeError
from app.services.documents.extraction.base import (
    ExtractedFact,
    ExtractedPage,
    ExtractionResult,
)
from app.services.documents.extraction.csv_statement import extract_csv
from app.services.documents.extraction.ixbrl import extract_ixbrl
from app.services.documents.extraction.pdf import extract_pdf
from app.services.documents.extraction.pptx import extract_pptx
from app.services.documents.extraction.xlsx import extract_xlsx

__all__ = ["ExtractedFact", "ExtractedPage", "ExtractionResult", "extract"]

IXBRL_EXTENSIONS = (".xhtml", ".html", ".htm")


def extract(extension: str, content: bytes, *, filename: str = "") -> ExtractionResult:
    if extension == ".pdf":
        return extract_pdf(content)
    if extension == ".pptx":
        return extract_pptx(content)
    if extension == ".xlsx":
        return extract_xlsx(content)
    if extension == ".csv":
        # The file name is the only title a CSV has ("...Income statement.csv").
        stem = filename.rsplit(".", 1)[0] if filename else ""
        return extract_csv(content, sheet_name=stem)
    if extension in IXBRL_EXTENSIONS:
        return extract_ixbrl(content)
    raise UnsupportedFileTypeError(
        f"*{extension}", (".pdf", ".pptx", ".xlsx", ".csv", *IXBRL_EXTENSIONS)
    )
